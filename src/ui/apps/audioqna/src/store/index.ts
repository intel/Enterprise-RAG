// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import {
  chatHistoryReducer,
  chatSidebarReducer,
} from "@intel-enterprise-rag-ui/chat";
import { colorSchemeReducer } from "@intel-enterprise-rag-ui/components";
import {
  createDataIngestionApiMiddleware,
  dataIngestionSettingsReducer,
  edpApi,
} from "@intel-enterprise-rag-ui/data-ingestion";
import { combineReducers, configureStore } from "@reduxjs/toolkit";

import { appApi } from "@/api";
import { controlPlaneApi } from "@/features/admin-panel/control-plane/api";
import audioQnAGraphReducer from "@/features/admin-panel/control-plane/store/audioQnAGraph.slice";
import { s3Api } from "@/features/admin-panel/data-ingestion/api/s3Api";
import { asrApi } from "@/features/chat/api/asr.api";
import { audioQnAApi } from "@/features/chat/api/audioQnA.api";
import { chatHistoryApi } from "@/features/chat/api/chatHistory.api";
import { ttsApi } from "@/features/chat/api/tts.api";
import viewNavigationReducer from "@/store/viewNavigation.slice";

const dataIngestionApiMiddleware = createDataIngestionApiMiddleware(
  s3Api.endpoints.deleteFile.matchFulfilled,
);

const rootReducer = combineReducers({
  chatSidebar: chatSidebarReducer,
  chatHistory: chatHistoryReducer,
  colorScheme: colorSchemeReducer,
  audioQnAGraph: audioQnAGraphReducer,
  dataIngestionSettings: dataIngestionSettingsReducer,
  viewNavigation: viewNavigationReducer,
  [appApi.reducerPath]: appApi.reducer,
  [asrApi.reducerPath]: asrApi.reducer,
  [audioQnAApi.reducerPath]: audioQnAApi.reducer,
  [chatHistoryApi.reducerPath]: chatHistoryApi.reducer,
  [controlPlaneApi.reducerPath]: controlPlaneApi.reducer,
  [edpApi.reducerPath]: edpApi.reducer,
  [s3Api.reducerPath]: s3Api.reducer,
  [ttsApi.reducerPath]: ttsApi.reducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      appApi.middleware,
      asrApi.middleware,
      audioQnAApi.middleware,
      chatHistoryApi.middleware,
      controlPlaneApi.middleware,
      edpApi.middleware,
      s3Api.middleware,
      ttsApi.middleware,
      dataIngestionApiMiddleware,
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;
