# Setting Up S3 Buckets and SQS for EDP on AWS

This guide creates the AWS resources EDP needs to use external S3 storage:

- three S3 buckets (one read-only, two read-write),
- an SQS queue that receives object created/removed notifications from those buckets,
- an IAM user with an access key that EDP uses to read the buckets and the queue.

## Prerequisites
 - **AWS CLI v2** and **jq** must be installed.
 - **AWS credentials** must be properly configured in your `~/.aws/credentials` file. Ensure they are associated with sufficient IAM permissions to create and manage S3 buckets, SQS queues, and associated resources.

### Required IAM Permissions
The following IAM policy outlines the minimum required permissions to create and later remove the resources:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:CreateQueue",
        "sqs:DeleteQueue",
        "sqs:GetQueueUrl",
        "sqs:GetQueueAttributes",
        "sqs:SetQueueAttributes",
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:ListBucket",
        "s3:DeleteObject",
        "s3:PutBucketPublicAccessBlock",
        "s3:PutBucketCORS",
        "s3:PutBucketNotification",
        "iam:CreateUser",
        "iam:DeleteUser",
        "iam:CreatePolicy",
        "iam:DeletePolicy",
        "iam:AttachUserPolicy",
        "iam:DetachUserPolicy",
        "iam:CreateAccessKey",
        "iam:ListAccessKeys",
        "iam:DeleteAccessKey"
      ],
      "Resource": "*"
    }
  ]
}
```
✅ Tip: If possible, assign this policy to a dedicated IAM role or user specifically for infrastructure provisioning, to follow the principle of least privilege.

## Configuration
Set the region and a random suffix that keeps the bucket names globally unique. Write down the suffix, it is needed for cleanup.

```bash
export AWS_REGION=us-west-2
SUFFIX=$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 8)
echo "SUFFIX=$SUFFIX"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
READ_ONLY_BUCKET=edp-s3-read-only-bucket-$SUFFIX
READ_WRITE_BUCKET_1=edp-s3-read-write-bucket-1-$SUFFIX
READ_WRITE_BUCKET_2=edp-s3-read-write-bucket-2-$SUFFIX
BUCKETS="$READ_ONLY_BUCKET $READ_WRITE_BUCKET_1 $READ_WRITE_BUCKET_2"
QUEUE_NAME=edp-s3-notification-queue-$SUFFIX
USER_NAME=edp-iam-user-$SUFFIX
POLICY_NAME=edp-s3-access-policy-$SUFFIX
```

Replace `https://erag.com` in the CORS rule below with the address your Intel® AI for Enterprise RAG UI is served from.

## Usage

### 1. Create the S3 buckets
```bash
for bucket in $BUCKETS; do
  if [ "$AWS_REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$bucket"
  else
    aws s3api create-bucket --bucket "$bucket" \
      --create-bucket-configuration LocationConstraint="$AWS_REGION"
  fi

  aws s3api put-public-access-block --bucket "$bucket" \
    --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

  aws s3api put-bucket-cors --bucket "$bucket" --cors-configuration '{
    "CORSRules": [{
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": ["https://erag.com"],
      "MaxAgeSeconds": 3000
    }]
  }'
done
```

### 2. Create the SQS queue
```bash
QUEUE_URL=$(aws sqs create-queue --queue-name "$QUEUE_NAME" \
  --attributes SqsManagedSseEnabled=true --query QueueUrl --output text)
QUEUE_ARN=$(aws sqs get-queue-attributes --queue-url "$QUEUE_URL" \
  --attribute-names QueueArn --query Attributes.QueueArn --output text)
```

Allow the buckets to send notifications to the queue:

```bash
cat > edp-queue-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowEdpBucketNotifications",
    "Effect": "Allow",
    "Principal": { "Service": "s3.amazonaws.com" },
    "Action": "sqs:SendMessage",
    "Resource": "$QUEUE_ARN",
    "Condition": {
      "ArnLike": {
        "aws:SourceArn": [
          "arn:aws:s3:::$READ_ONLY_BUCKET",
          "arn:aws:s3:::$READ_WRITE_BUCKET_1",
          "arn:aws:s3:::$READ_WRITE_BUCKET_2"
        ]
      },
      "StringEquals": { "aws:SourceAccount": "$ACCOUNT_ID" }
    }
  }]
}
EOF

aws sqs set-queue-attributes --queue-url "$QUEUE_URL" \
  --attributes "$(jq -c -n --rawfile policy edp-queue-policy.json '{Policy: $policy}')"
```

### 3. Send bucket events to the queue
The queue policy from the previous step must exist first, otherwise S3 rejects the configuration.

```bash
for bucket in $BUCKETS; do
  aws s3api put-bucket-notification-configuration --bucket "$bucket" \
    --notification-configuration "{
      \"QueueConfigurations\": [{
        \"QueueArn\": \"$QUEUE_ARN\",
        \"Events\": [\"s3:ObjectCreated:*\", \"s3:ObjectRemoved:*\"]
      }]
    }"
done
```

### 4. Create the IAM user for EDP
The policy grants read access to the read-only bucket, read-write access to the other two buckets, permission to consume the queue, and denies any S3 request that does not use TLS.

```bash
cat > edp-user-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:ListAllMyBuckets",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$READ_ONLY_BUCKET/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::$READ_WRITE_BUCKET_1/*",
        "arn:aws:s3:::$READ_WRITE_BUCKET_2/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["sqs:ReceiveMessage", "sqs:DeleteMessage"],
      "Resource": "$QUEUE_ARN"
    },
    {
      "Effect": "Deny",
      "Action": "s3:*",
      "Resource": "*",
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    }
  ]
}
EOF

aws iam create-user --user-name "$USER_NAME"
POLICY_ARN=$(aws iam create-policy --policy-name "$POLICY_NAME" \
  --policy-document file://edp-user-policy.json --query Policy.Arn --output text)
aws iam attach-user-policy --user-name "$USER_NAME" --policy-arn "$POLICY_ARN"

aws iam create-access-key --user-name "$USER_NAME" \
  --query 'AccessKey.{accessKey: AccessKeyId, secretKey: SecretAccessKey}'
```

> [!IMPORTANT]
> The secret key is shown only once. Store it securely; if it is lost, delete the access key and create a new one.

### Passing the Values to Intel® AI for Enterprise RAG Deployment
To use them in [deployment](../../../deployment/README.md), print the queue URL and region:

```bash
echo "sqsQueue: $QUEUE_URL"
echo "region:   $AWS_REGION"
```

Then insert these values, together with the access key and secret key from step 4, into config.yaml like this:

```yaml
edp:
  enabled: true
  storageType: s3
  s3:
    accessKey: "<paste accessKey here>"
    secretKey: "<paste secretKey here>"
    sqsQueue: "<paste sqsQueue here>"
    region: "<paste region here>"
    bucketNameRegexFilter: ".*"
```

Then run deployment as usual, an example for installation from the Enterprise AI Solution installer root:
```bash
./es_auto_installer.sh install erag --env <name>
```

## Cleanup
To remove the created resources, set `AWS_REGION` and `SUFFIX` to the values used during setup, re-run the variable definitions from [Configuration](#configuration) except the `SUFFIX=` line, then run:

> [!WARNING]
> `aws s3 rb --force` permanently deletes all documents stored in the buckets.

```bash
QUEUE_URL=$(aws sqs get-queue-url --queue-name "$QUEUE_NAME" --query QueueUrl --output text)
POLICY_ARN=arn:aws:iam::$ACCOUNT_ID:policy/$POLICY_NAME

for key in $(aws iam list-access-keys --user-name "$USER_NAME" \
    --query 'AccessKeyMetadata[].AccessKeyId' --output text); do
  aws iam delete-access-key --user-name "$USER_NAME" --access-key-id "$key"
done
aws iam detach-user-policy --user-name "$USER_NAME" --policy-arn "$POLICY_ARN"
aws iam delete-policy --policy-arn "$POLICY_ARN"
aws iam delete-user --user-name "$USER_NAME"

for bucket in $BUCKETS; do
  aws s3 rb "s3://$bucket" --force
done
aws sqs delete-queue --queue-url "$QUEUE_URL"

rm -f edp-queue-policy.json edp-user-policy.json
```
