// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { keycloakService } from "@intel-enterprise-rag-ui/auth";
import {
  SidePanelFooter,
  SidePanelHeader,
} from "@intel-enterprise-rag-ui/layouts";

import { resetStore } from "@/store/utils";
import { getAudioQnAAppEnv } from "@/utils";

const APP_DISPLAY_NAME = "AudioQnA";
const PROJECT_NAME = "Intel® AI for Enterprise RAG";
const APP_VERSION =
  getAudioQnAAppEnv("ERAG_VERSION") || import.meta.env.VITE_APP_VERSION;
const USER_GUIDE_URL = `https://github.com/opea-project/Enterprise-RAG/blob/release-${APP_VERSION}/docs/Intel_AI_for_Enterprise_RAG_AudioQnA_User_Guide.pdf`;

/** Rendered as the side panel's own top header row — see SidePanelHeader. */
export const SidePanelHeaderContent = () => (
  <SidePanelHeader
    title={APP_DISPLAY_NAME}
    subtitle={`${PROJECT_NAME} v${APP_VERSION}`}
    appName={PROJECT_NAME}
    appVersion={APP_VERSION}
    userGuideUrl={USER_GUIDE_URL}
  />
);

/** Rendered in the side panel's footer (not the header) — see SidePanelFooter. */
export const SidePanelFooterContent = () => (
  <SidePanelFooter
    username={keycloakService.getUsername()}
    userEmail={keycloakService.getEmail()}
    onLogout={() => {
      resetStore();
      keycloakService.redirectToLogout();
    }}
  />
);
