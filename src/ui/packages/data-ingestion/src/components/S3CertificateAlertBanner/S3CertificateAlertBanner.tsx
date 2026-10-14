// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Anchor,
  Button,
} from "@intel-enterprise-rag-ui/components";
import { ErrorIcon } from "@intel-enterprise-rag-ui/icons";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { resetS3ApiStateAction, selectS3ApiState } from "@/api/s3Api";

const isFetchError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "status" in error &&
  (error as { status: unknown }).status === "FETCH_ERROR";

interface S3CertificateAlertBannerProps {
  getAppEnv: (key: string) => string | undefined;
  appApiErrors?: unknown[];
  onResetAppApiState?: () => void;
}

const S3CertificateAlertBanner = ({
  getAppEnv,
  appApiErrors = [],
  onResetAppApiState,
}: S3CertificateAlertBannerProps) => {
  const [hasErrors, setHasErrors] = useState(false);

  const s3ApiState = useSelector(selectS3ApiState);
  const dispatch = useDispatch();

  const s3Url = getAppEnv("S3_URL");

  const s3Errors = [
    ...Object.values(s3ApiState.queries).map((q) => q?.error),
    ...Object.values(s3ApiState.mutations).map((m) => m?.error),
  ];
  const allFetchErrors = [...s3Errors, ...appApiErrors].filter(isFetchError);

  useEffect(() => {
    setHasErrors(allFetchErrors.length > 0);
  }, [allFetchErrors.length]);

  const handleS3UrlPress = () => {
    dispatch(resetS3ApiStateAction());
    onResetAppApiState?.();
  };

  const handleDismissBtnPress = () => {
    setHasErrors(false);
    dispatch(resetS3ApiStateAction());
    onResetAppApiState?.();
  };

  if (!hasErrors) {
    return null;
  }

  return (
    <Alert
      variant="error"
      className="mb-4"
      data-testid="s3-certificate-alert-banner"
    >
      <ErrorIcon />
      <AlertTitle>Certificate error</AlertTitle>
      <AlertDescription>
        <p>
          It seems there was an error with your file action, possibly due to a
          self-signed certificate issue.
          <br /> Please click the link below to accept the certificate, then try
          the action again.
        </p>
        <Anchor
          data-testid="s3-certificate-link"
          href={s3Url}
          onPress={handleS3UrlPress}
        >
          {s3Url}
        </Anchor>
        <p className="my-2">
          If you believe this is a false positive, you can dismiss this alert
          using the button below.
        </p>
      </AlertDescription>
      <Button
        data-testid="dismiss-s3-certificate-alert-button"
        variant="outline"
        size="sm"
        onPress={handleDismissBtnPress}
        className="mt-2"
      >
        Dismiss
      </Button>
    </Alert>
  );
};

export default S3CertificateAlertBanner;
