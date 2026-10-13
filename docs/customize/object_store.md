# Object Store Configuration

[← Customize](../README.md#customize)

Intel® AI for Enterprise RAG supports multiple object store backends for storing ingested documents. The choice of backend affects where files are stored and how they are accessed by the EDP (Enhanced Data Preparation) service.

This matters when your documents already live somewhere: pointing EDP at an existing bucket or array means you ingest from the system of record instead of copying corpora into the cluster, and it decides who is responsible for retention and backup of the source files.

## Storage backends

Set `edp_storage_type` in `env/<name>/config.erag.yaml`:

| Backend | When to use |
|---------|-------------|
| `seaweedfs` (default) | In-cluster object storage, suitable for single-node and multi-node deployments |
| `s3` | AWS S3 or another S3-compatible service with SQS event notifications |
| `s3compatible` | S3-compatible storage without SQS (e.g. NetApp ONTAP S3, MinIO outside the cluster) |

The backend determines which credentials and endpoints are rendered into the EDP Helm values.

### SeaweedFS (default)

```yaml
edp_storage_type: "seaweedfs"
```

Deploys SeaweedFS in-cluster. No additional configuration required. Files are accessible at `https://seaweedfs.<base_domain_name>` (in `subdomain` routing mode) or `https://<base_domain_name>/seaweedfs` (in `path` routing mode).

Storage capacity: Default persistent volume size is 5GB. To increase:

1. Edit `deployment/components/edp/values.yaml`
2. Under the `persistence` section, set `size: 100Gi` (or your desired size)
3. Redeploy

> **Note:** Vector store storage should be larger than file storage because it contains both extracted text and vector embeddings for that data.

### External S3

```yaml
edp_storage_type: "s3"
edp_s3_region: "us-east-1"
edp_s3_access_key_id: "<your-access-key>"
edp_s3_secret_access_key: "<your-secret-key>"
edp_s3_sqs_event_queue_url: "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue"
edp_s3_bucket_name_regex_filter: ""  # optional: restrict which buckets EDP tracks
```

Requires SQS event notifications configured on the S3 bucket for automatic ingestion. To create the buckets, the queue, and the IAM user with the AWS CLI, see [AWS S3 and SQS Setup](aws_s3.md).

### S3-compatible (without SQS)

```yaml
edp_storage_type: "s3compatible"
edp_s3_compatible_region: "us-east-1"
edp_s3_compatible_access_key_id: "<your-access-key>"
edp_s3_compatible_secret_access_key: "<your-secret-key>"
edp_s3_compatible_internal_url: "https://s3.example.com"
edp_s3_compatible_external_url: "https://s3.example.com"
edp_s3_compatible_bucket_name_regex_filter: ""  # optional
```

S3-compatible storage without SQS event notifications requires scheduled synchronization to detect new files. See [Scheduled synchronization](#scheduled-synchronization).

---

## NetApp ONTAP S3 integration

Intel AI for Enterprise RAG can use a NetApp ONTAP object-store server as the document store instead of the in-cluster SeaweedFS.

> **Note:** Persistent volume storage is a separate decision made by Enterprise AI Solutions (`storage_backend: netapp-trident` in `env/<name>/global_config.yaml`). This section covers only the object store used by EDP.

### Why a reverse proxy is needed

EDP hands the browser a presigned SigV4 URL, and the browser PUTs the file directly to it. The ONTAP object-store data LIF sits on the storage network where browsers cannot reach it. Publishing the endpoint through the platform Envoy Gateway means EDP needs two endpoints for the same bucket:

- **Internal:** `https://<ontap_s3_data_lif>:<port>` (for EDP pods)
- **External:** `https://s3.<base_domain_name>` (for browsers)

Getting these out of step is the most common way to break ingestion. The role derives both automatically.

The reverse proxy objects (`Service`/`EndpointSlice` or an Envoy Gateway `Backend`, an `HTTPRoute`, and a route-scoped `SecurityPolicy`) are created in the `edp` namespace by `roles/app_edp/tasks/ontap_s3_proxy.yaml`.

### Configuration

Set the following in the Enterprise AI Solutions `env/<name>/global_config.yaml`:

```yaml
ontap_s3_data_lif: "10.0.0.102"     # Object-store data LIF, NOT the NFS LIF
ontap_s3_port: "443"                # default: 443
ontap_s3_tls: true                  # default: true
```

Set the following in `env/<name>/config.erag.yaml`:

```yaml
edp_s3_compatible_access_key_id: "<access-key>"
edp_s3_compatible_secret_access_key: "<secret-key>"
```

`edp_storage_type` is automatically derived as `s3compatible` when `ontap_s3_data_lif` is set on a `netapp-trident` cluster. You can override it explicitly, but the role will reject a value that contradicts an active ONTAP S3 proxy.

Deploy or redeploy:

```bash
./es_auto_installer.sh install erag --env <name>
```

The installer prints the derived values at install time so a deployment can be read back from the log.

### What is derived

The following values are automatically computed by `roles/app_edp/tasks/ontap_s3_resolve.yaml`:

| Value | Derivation |
|-------|------------|
| `edp_storage_type` | `s3compatible` (from the ONTAP S3 LIF + access key on a `netapp-trident` cluster) |
| `edp_s3_compatible_internal_url` | `https://<ontap_s3_data_lif>:<ontap_s3_port>` (or `http://` in `plaintext` mode) |
| `edp_s3_compatible_external_url` | `https://s3.<base_domain_name>` (subdomain mode) or `https://<base_domain_name>/s3` (path mode) |
| `edp_s3_compatible_external_cert_verify` | `false` (ONTAP presents a self-signed certificate) |
| `edp_s3_compatible_internal_cert_verify` | `false` (certificate issued to the SVM, not the data LIF) |
| `edp_scheduled_sync_enabled` | `true` (ONTAP S3 has no bucket event notifications) |

> [!IMPORTANT]
> `edp_rbac_enabled` must stay `false` with ONTAP S3. The role asserts this rather than silently overriding it, so an install with RBAC enabled will fail rather than half-work.

`edp_rbac_enabled` must stay `false` because RBAC mode signs object-store requests as the logged-in user through MinIO's `WebIdentityProvider`, which needs STS (Security Token Service). ONTAP S3 has no STS endpoint. `false` is the default, and the role asserts it rather than silently overriding.

### Upstream TLS modes

`edp_ontap_s3_tls_mode` selects how the gateway talks to the array. All three modes terminate client TLS at the gateway with the platform certificate; the difference is the second hop:

| Mode | Mechanism | Trade-off |
|------|-----------|-----------|
| `insecure` (default) | Envoy Gateway `Backend` with `tls.insecureSkipVerify` and `alpnProtocols: [http/1.1]` | The hop to the array is unverified. ONTAP's certificate is normally self-signed and issued to the SVM, not the data LIF, so verification would fail on the name even with a trusted issuer. |
| `ca` | Gateway API `BackendTLSPolicy` (`v1alpha3`) validating against a ConfigMap built from `ontap_s3_ca_cert_file` | The only verified option. Needs the experimental-channel CRD and a real CA plus an SNI name the certificate matches (`edp_ontap_s3_sni_hostname`). |
| `plaintext` | No upstream TLS. Also selected by `ontap_s3_tls: false`. | Simplest, defensible on a trusted storage VLAN, but object bytes cross the cluster network unencrypted. |

To use `ca` mode:

1. Place the CA certificate in PEM format on the installer host
2. Set in `env/<name>/config.erag.yaml`:

   ```yaml
   edp_ontap_s3_tls_mode: "ca"
   ontap_s3_ca_cert_file: "/path/to/ca.pem"
   edp_ontap_s3_sni_hostname: "svm.example.com"
   ```

3. Redeploy

### Optional settings

| Option | Default | Description |
|--------|---------|-------------|
| `edp_ontap_s3_reverse_proxy` | `""` (auto) | `true`/`false` decides activation explicitly instead of by inference |
| `edp_ontap_s3_request_timeout` | `3600s` | Route timeout for large uploads |
| `edp_s3_compatible_bucket_name_regex_filter` | `""` | Restrict which buckets EDP tracks |
| `edp_s3_domain_prefix` | `gateway_s3_subdomain` (`s3`) | Hostname label for the browser-facing endpoint |
| `edp_ontap_s3_validate_reachability` | `true` | `false` skips the curl probe through the gateway during validation |

### Limitations

- **Object keys containing `//`, `/../`, or `%2F` cannot be served through the gateway.** SigV4 signs the path verbatim and Envoy normalizes it, so the array recomputes a different signature and answers `SignatureDoesNotMatch`. EDP refuses to presign such names, so the UI path is unaffected, but keys created by other tools are not reachable.
- **`routing_mode: path` gets no dedicated listener** because the S3 API then shares the apex hostname with the UI. Use `subdomain` mode.
- **No ONTAP-side provisioning.** The object-store server, the bucket, and the S3 user must exist, and the access keys are inputs. Nothing here creates them.

For the complete end-to-end flow (from `configure` through `init erag` to `install erag`), array-side prerequisites, and the `ontap_*` values themselves, see `docs/NETAPP_ONTAP.md` in Enterprise AI Solutions repository.

---

## Scheduled synchronization

S3-compatible storage without SQS event notifications requires scheduled synchronization to detect new files. Enable it in `env/<name>/config.erag.yaml`:

```yaml
edp_scheduled_sync_enabled: true
edp_scheduled_sync_period_seconds: "60"
```

| Option | Default | Description |
|--------|---------|-------------|
| `edp_scheduled_sync_enabled` | `false` | Registers the Celery beat periodic tasks |
| `edp_scheduled_sync_period_seconds` | `"60"` | Interval between sync tasks (in seconds) |

The scheduled task polls buckets for changes at the specified interval and ingests any new or updated files.

## Related docs

| Topic | Link |
|-------|------|
| AWS S3 and SQS setup with the AWS CLI | [aws_s3.md](aws_s3.md) |
| SharePoint integration (another EDP storage source) | [sharepoint.md](sharepoint.md) |
| NetApp ONTAP persistent volumes | [NetApp ONTAP and Trident](https://github.com/intel/enterprise-ai-solutions/blob/main/docs/deploy/netapp_ontap.md) |
| EDP source code and detailed settings | [`src/edp/README.md`](../../src/edp/README.md) |
