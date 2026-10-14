// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { IconProps } from "@phosphor-icons/react";
import { ComponentType } from "react";

import { AdminPanelIcon } from "@/icons/AdminPanelIcon";
import { AiIcon } from "@/icons/AiIcon";
import { BucketSynchronizationIcon } from "@/icons/BucketSynchronizationIcon";
import { ChatIcon } from "@/icons/ChatIcon";
import { CheckboxCheckIcon } from "@/icons/CheckboxCheckIcon";
import { ClearIcon } from "@/icons/ClearIcon";
import { CloseIcon } from "@/icons/CloseIcon";
import { ConfigurableServiceIcon } from "@/icons/ConfigurableServiceIcon";
import { ControlPlaneIcon } from "@/icons/ControlPlaneIcon";
import { CopyErrorIcon } from "@/icons/CopyErrorIcon";
import { CopyIcon } from "@/icons/CopyIcon";
import { CopySuccessIcon } from "@/icons/CopySuccessIcon";
import { DarkModeIcon } from "@/icons/DarkModeIcon";
import { DataPrepIcon } from "@/icons/DataPrepIcon";
import { DeleteIcon } from "@/icons/DeleteIcon";
import { DisclosureIcon } from "@/icons/DisclosureIcon";
import { DownloadIcon } from "@/icons/DownloadIcon";
import { EditIcon } from "@/icons/EditIcon";
import { EmbeddingIcon } from "@/icons/EmbeddingIcon";
import { ExportIcon } from "@/icons/ExportIcon";
import { ExternalLinkIcon } from "@/icons/ExternalLinkIcon";
import { FileCsvIcon } from "@/icons/FileCsvIcon";
import { FileDocIcon } from "@/icons/FileDocIcon";
import { FileDocxIcon } from "@/icons/FileDocxIcon";
import { FileHtmlIcon } from "@/icons/FileHtmlIcon";
import { FileIcon } from "@/icons/FileIcon";
import { FileImageIcon } from "@/icons/FileImageIcon";
import { FileJpegIcon } from "@/icons/FileJpegIcon";
import { FileJpgIcon } from "@/icons/FileJpgIcon";
import { FileMdIcon } from "@/icons/FileMdIcon";
import { FilePdfIcon } from "@/icons/FilePdfIcon";
import { FilePngIcon } from "@/icons/FilePngIcon";
import { FilePptIcon } from "@/icons/FilePptIcon";
import { FilePptxIcon } from "@/icons/FilePptxIcon";
import { FileSvgIcon } from "@/icons/FileSvgIcon";
import { FileTextIcon } from "@/icons/FileTextIcon";
import { FileTxtIcon } from "@/icons/FileTxtIcon";
import { FileXlsIcon } from "@/icons/FileXlsIcon";
import { FileXlsxIcon } from "@/icons/FileXlsxIcon";
import { FilterActiveIcon } from "@/icons/FilterActiveIcon";
import { FilterIcon } from "@/icons/FilterIcon";
import { FitViewIcon } from "@/icons/FitViewIcon";
import { HistoryIcon } from "@/icons/HistoryIcon";
import { IdentityProviderIcon } from "@/icons/IdentityProviderIcon";
import { InfoFilledIcon } from "@/icons/InfoFilledIcon";
import { InfoIcon } from "@/icons/InfoIcon";
import { LightModeIcon } from "@/icons/LightModeIcon";
import { LinkIcon } from "@/icons/LinkIcon";
import { LoadingIcon } from "@/icons/LoadingIcon";
import { LogoutIcon } from "@/icons/LogoutIcon";
import { MicrophoneIcon } from "@/icons/MicrophoneIcon";
import { MicrophoneRecordingIcon } from "@/icons/MicrophoneRecordingIcon";
import { MinusIcon } from "@/icons/MinusIcon";
import { MoreOptionsIcon } from "@/icons/MoreOptionsIcon";
import { NewChatIcon } from "@/icons/NewChatIcon";
import { PanelHideIcon } from "@/icons/PanelHideIcon";
import { PanelShowIcon } from "@/icons/PanelShowIcon";
import { PinFilledIcon } from "@/icons/PinFilledIcon";
import { PinIcon } from "@/icons/PinIcon";
import { PlainTextIcon } from "@/icons/PlainTextIcon";
import { PlusIcon } from "@/icons/PlusIcon";
import { PromptSendIcon } from "@/icons/PromptSendIcon";
import { PromptStopIcon } from "@/icons/PromptStopIcon";
import { RefreshIcon } from "@/icons/RefreshIcon";
import { S3BucketIcon } from "@/icons/S3BucketIcon";
import { ScrollToBottomIcon } from "@/icons/ScrollToBottomIcon";
import { SearchIcon } from "@/icons/SearchIcon";
import { SelectInputArrowIcon } from "@/icons/SelectInputArrowIcon";
import { SettingsIcon } from "@/icons/SettingsIcon";
import { SharePointSiteIcon } from "@/icons/SharePointSiteIcon";
import { SidebarToggleIcon } from "@/icons/SidebarToggleIcon";
import { SortDownIcon } from "@/icons/SortDownIcon";
import { SortUpDownIcon } from "@/icons/SortUpDownIcon";
import { SortUpIcon } from "@/icons/SortUpIcon";
import { SpeakerIcon } from "@/icons/SpeakerIcon";
import { SuccessIcon } from "@/icons/SuccessIcon";
import { TelemetryIcon } from "@/icons/TelemetryIcon";
import { UploadIcon } from "@/icons/UploadIcon";
import { WarningIcon } from "@/icons/WarningIcon";

export const icons: Record<string, ComponentType<IconProps>> = {
  "admin-panel": AdminPanelIcon,
  "bucket-synchronization": BucketSynchronizationIcon,
  ai: AiIcon,
  chat: ChatIcon,
  "checkbox-check": CheckboxCheckIcon,
  disclosure: DisclosureIcon,
  clear: ClearIcon,
  close: CloseIcon,
  "configurable-service": ConfigurableServiceIcon,
  "control-plane": ControlPlaneIcon,
  "copy-error": CopyErrorIcon,
  copy: CopyIcon,
  "copy-success": CopySuccessIcon,
  "dark-mode": DarkModeIcon,
  "data-prep": DataPrepIcon,
  delete: DeleteIcon,
  download: DownloadIcon,
  edit: EditIcon,
  embedding: EmbeddingIcon,
  export: ExportIcon,
  "fit-view": FitViewIcon,
  file: FileIcon,
  "file-md": FileMdIcon,
  "file-doc": FileDocIcon,
  "file-docx": FileDocxIcon,
  "file-pdf": FilePdfIcon,
  "file-html": FileHtmlIcon,
  "file-txt": FileTxtIcon,
  "file-ppt": FilePptIcon,
  "file-pptx": FilePptxIcon,
  "file-xls": FileXlsIcon,
  "file-xlsx": FileXlsxIcon,
  "file-csv": FileCsvIcon,
  "file-jpg": FileJpgIcon,
  "file-jpeg": FileJpegIcon,
  "file-png": FilePngIcon,
  "file-svg": FileSvgIcon,
  "file-image": FileImageIcon,
  filter: FilterIcon,
  "filter-active": FilterActiveIcon,
  pin: PinIcon,
  "pin-filled": PinFilledIcon,
  history: HistoryIcon,
  "identity-provider": IdentityProviderIcon,
  info: InfoIcon,
  "info-filled": InfoFilledIcon,
  "light-mode": LightModeIcon,
  link: LinkIcon,
  loading: LoadingIcon,
  logout: LogoutIcon,
  microphone: MicrophoneIcon,
  "microphone-recording": MicrophoneRecordingIcon,
  minus: MinusIcon,
  "more-options": MoreOptionsIcon,
  "new-chat": NewChatIcon,
  "panel-hide": PanelHideIcon,
  "panel-show": PanelShowIcon,
  "plain-text": PlainTextIcon,
  plus: PlusIcon,
  "prompt-send": PromptSendIcon,
  "prompt-stop": PromptStopIcon,
  refresh: RefreshIcon,
  "sidebar-toggle": SidebarToggleIcon,
  "scroll-to-bottom": ScrollToBottomIcon,
  search: SearchIcon,
  "select-input-arrow": SelectInputArrowIcon,
  settings: SettingsIcon,
  "sort-down": SortDownIcon,
  "sort-up-down": SortUpDownIcon,
  "sort-up": SortUpIcon,
  success: SuccessIcon,
  telemetry: TelemetryIcon,
  "file-text": FileTextIcon,
  upload: UploadIcon,
  "s3-bucket": S3BucketIcon,
  "sharepoint-site": SharePointSiteIcon,
  speaker: SpeakerIcon,
  warning: WarningIcon,
  "external-link": ExternalLinkIcon,
};

export type IconName = keyof typeof icons;
