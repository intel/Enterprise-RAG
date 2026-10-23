// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./UploadDataDialog.css";

import {
  addNotification,
  Dialog,
  DialogRef,
  IconButton,
  Label,
  SelectInput,
  Tooltip,
} from "@intel-enterprise-rag-ui/components";
import {
  S3BucketIcon,
  SharePointSiteIcon,
} from "@intel-enterprise-rag-ui/icons";
import { useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";

import {
  useGetS3BucketsListQuery,
  useGetSharePointSitesQuery,
  useLazyGetFilesQuery,
  useLazyGetLinksQuery,
  usePostLinksMutation,
  usePostSharePointUploadMutation,
} from "@/api/edpApi";
import FilesIngestionPanel from "@/components/FilesIngestionPanel/FilesIngestionPanel";
import LinksIngestionPanel from "@/components/LinksIngestionPanel/LinksIngestionPanel";
import UploadDataDialogFooter from "@/components/UploadDataDialogFooter/UploadDataDialogFooter";
import { ERROR_MESSAGES } from "@/config/api";
import useIsSharePointEnabled from "@/hooks/useIsSharePointEnabled";
import { GetFilePresignedUrl, LinkForIngestion, UploadErrors } from "@/types";
import { createToBeUploadedMessage, isUploadDisabled } from "@/utils";
import { getErrorMessage } from "@/utils/api";

const initialUploadErrors = {
  files: "",
  links: "",
};

type DestinationItem =
  | { type: "s3"; value: string; label: string }
  | { type: "sharepoint"; value: string; label: string };

interface UploadDataDialogProps {
  getAppEnv: (key: string) => string | undefined;
  getFilePresignedUrl: GetFilePresignedUrl;
  postFile: (args: { url: string; file: File }) => Promise<{ error?: unknown }>;
}

const UploadDataDialog = ({
  getAppEnv,
  getFilePresignedUrl,
  postFile,
}: UploadDataDialogProps) => {
  const [getFiles] = useLazyGetFilesQuery();
  const [getLinks] = useLazyGetLinksQuery();
  const [postLinks] = usePostLinksMutation();
  const [postSharePointUpload] = usePostSharePointUploadMutation();

  const { data: bucketsList, isFetching: isFetchingBuckets } =
    useGetS3BucketsListQuery();
  const { data: spSites } = useGetSharePointSitesQuery();
  const isSharePointEnabled = useIsSharePointEnabled();
  const hasSites = isSharePointEnabled && spSites && spSites.length > 0;

  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<LinkForIngestion[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadErrors, setUploadErrors] =
    useState<UploadErrors>(initialUploadErrors);

  const dialogRef = useRef<DialogRef>(null);

  const dispatch = useDispatch();

  const destinationItems = useMemo<DestinationItem[]>(() => {
    const buckets = (bucketsList ?? []).map<DestinationItem>((b) => ({
      type: "s3",
      value: `s3::${b}`,
      label: b,
    }));
    if (!hasSites) return buckets;
    const sites = spSites!.map<DestinationItem>((s) => ({
      type: "sharepoint",
      value: `sp::${s.display_name || s.name}`,
      label: s.display_name || s.name,
    }));
    return [...buckets, ...sites];
  }, [bucketsList, spSites, hasSites]);

  const effectiveBucket = useMemo(() => {
    const item = destinationItems.find((d) => d.value === selectedDestination);
    if (!item || item.type !== "s3") return "";
    return item.label;
  }, [selectedDestination, destinationItems]);

  const selectedSharePointSiteId = useMemo(() => {
    const item = destinationItems.find((d) => d.value === selectedDestination);
    if (!item || item.type !== "sharepoint") return "";
    const site = spSites?.find(
      (s) => (s.display_name || s.name) === item.label,
    );
    return site?.id ?? "";
  }, [selectedDestination, destinationItems, spSites]);

  const isSharePointDestination = selectedSharePointSiteId !== "";

  const hasFileTarget = effectiveBucket !== "" || isSharePointDestination;

  const resetUploadErrors = () => {
    setUploadErrors(initialUploadErrors);
  };

  const onDialogClose = () => {
    setFiles([]);
    setLinks([]);
    resetUploadErrors();
    dialogRef.current?.close();
  };

  const submitUploadData = async () => {
    resetUploadErrors();
    setIsUploading(true);

    let filesUploadError = "";
    let linksUploadError = "";

    if (files.length && hasFileTarget) {
      let error;

      if (isSharePointDestination) {
        for (const file of files) {
          const { error: uploadError } = await postSharePointUpload({
            site_id: selectedSharePointSiteId,
            file,
          });

          if (uploadError) {
            error = uploadError;
            break;
          }
        }
      } else {
        for (const file of files) {
          const { data: presignedUrl, error: getFilePresignedUrlError } =
            await getFilePresignedUrl({
              fileName: file.name,
              method: "PUT",
              bucketName: effectiveBucket,
            });

          if (getFilePresignedUrlError) {
            error = getFilePresignedUrlError;
            break;
          }

          if (presignedUrl) {
            const { error: postFileError } = await postFile({
              url: presignedUrl,
              file,
            });

            if (postFileError) {
              error = postFileError;
              break;
            }
          }
        }
      }

      if (error) {
        filesUploadError = getErrorMessage(error, ERROR_MESSAGES.POST_FILES);
      } else {
        setFiles([]);
      }
    }

    if (links.length) {
      const linksUrls = links.map(({ value }) => value);
      const { error } = await postLinks(linksUrls);

      if (error) {
        linksUploadError = getErrorMessage(error, ERROR_MESSAGES.POST_LINKS);
      } else {
        setLinks([]);
      }
    }

    if (filesUploadError || linksUploadError) {
      setUploadErrors({
        links: linksUploadError,
        files: filesUploadError,
      });
    } else {
      setUploadErrors(initialUploadErrors);
      onDialogClose();
      dispatch(
        addNotification({
          text: "Successful data upload!",
          severity: "success",
        }),
      );
      Promise.all([getFiles().refetch(), getLinks().refetch()]);
    }

    setIsUploading(false);
  };

  const toBeUploadedMessage = createToBeUploadedMessage(
    files,
    hasFileTarget ? "selected" : "",
    links,
  );

  const isSelectDisabled = isFetchingBuckets || destinationItems.length === 0;
  const isSelectInvalid = files.length > 0 && !selectedDestination;

  return (
    <Dialog
      ref={dialogRef}
      data-testid="upload-data-dialog"
      trigger={
        <Tooltip
          title="Upload Data"
          trigger={
            <IconButton
              data-testid="upload-data-trigger-button"
              icon="upload"
              variant="contained"
            />
          }
        />
      }
      footer={
        <UploadDataDialogFooter
          uploadErrors={uploadErrors}
          toBeUploadedMessage={toBeUploadedMessage}
          isUploadDisabled={isUploadDisabled(
            files,
            hasFileTarget ? "selected" : "",
            links,
            isUploading,
          )}
          isUploading={isUploading}
          onSubmit={submitUploadData}
          getAppEnv={getAppEnv}
        />
      }
      title="Upload Data"
      onClose={onDialogClose}
    >
      <div className="upload-dialog__content">
        <div className="upload-dialog__destination-label">
          <Label>Upload to</Label>
          {hasSites && (
            <div className="upload-dialog__legend">
              <span className="upload-dialog__legend-item">
                <S3BucketIcon aria-hidden="true" /> S3 Bucket
              </span>
              <span className="upload-dialog__legend-item">
                <SharePointSiteIcon aria-hidden="true" /> SharePoint Site
              </span>
            </div>
          )}
        </div>
        <SelectInput
          data-testid="destination-dropdown"
          value={selectedDestination || null}
          items={destinationItems.map((d) => d.value)}
          onChange={(v) => setSelectedDestination(String(v))}
          isDisabled={isSelectDisabled}
          isInvalid={isSelectInvalid}
          aria-label="Upload destination"
          placeholder="Please select destination to upload files"
          className="upload-dialog__destination-select"
          renderValue={(key) => {
            const item = destinationItems.find((d) => d.value === key);
            if (!item) return null;
            return (
              <span className="upload-dialog__destination-option">
                {item.type === "s3" ? (
                  <S3BucketIcon aria-hidden="true" />
                ) : (
                  <SharePointSiteIcon aria-hidden="true" />
                )}
                {item.label}
              </span>
            );
          }}
          renderItem={(value) => {
            const item = destinationItems.find((d) => d.value === value);
            if (!item) return value;
            return (
              <span className="upload-dialog__destination-option">
                {item.type === "s3" ? (
                  <S3BucketIcon aria-hidden="true" />
                ) : (
                  <SharePointSiteIcon aria-hidden="true" />
                )}
                {item.label}
              </span>
            );
          }}
          getItemTextValue={(value) => {
            const item = destinationItems.find((d) => d.value === value);
            return item?.label ?? value;
          }}
        />
        <div className="upload-dialog__ingestion-panels-grid">
          <FilesIngestionPanel files={files} setFiles={setFiles} />
          <LinksIngestionPanel links={links} setLinks={setLinks} />
        </div>
        {isUploading && <div className="upload-dialog__blur-overlay"></div>}
      </div>
    </Dialog>
  );
};
export default UploadDataDialog;
