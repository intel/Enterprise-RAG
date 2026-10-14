// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  Select,
  SelectChangeHandler,
} from "@intel-enterprise-rag-ui/components";
import { useEffect } from "react";
import { toast } from "sonner";

import { useGetS3BucketsListQuery } from "@/api/edpApi";
import { ERROR_MESSAGES } from "@/config/api";
import { getErrorMessage } from "@/utils/api";

interface BucketsDropdownProps {
  selectedBucket: string;
  files: File[];
  onBucketChange: SelectChangeHandler<string>;
}

const BucketsDropdown = ({
  selectedBucket,
  files,
  onBucketChange,
}: BucketsDropdownProps) => {
  const { data: bucketsList, error, isFetching } = useGetS3BucketsListQuery();

  useEffect(() => {
    if (error) {
      const errorMessage = getErrorMessage(
        error,
        ERROR_MESSAGES.GET_S3_BUCKETS_LIST,
      );
      toast.error(errorMessage);
    }
  }, [error]);

  const isInvalid = files.length > 0 && !selectedBucket;
  const isDisabled = isFetching || !bucketsList || bucketsList.length === 0;

  return (
    <Select
      data-testid="s3-bucket-dropdown"
      value={selectedBucket}
      items={bucketsList}
      name="s3-bucket"
      label="S3 Bucket"
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      placeholder="Please select bucket to upload files"
      className="px-4 pt-3"
      onChange={onBucketChange}
    />
  );
};

export default BucketsDropdown;
