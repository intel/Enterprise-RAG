// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { createSlice } from "@reduxjs/toolkit";

export interface ChatSidebarState {
  isChatSidebarOpen: boolean;
}

const initialState: ChatSidebarState = {
  isChatSidebarOpen: false,
};

const chatSidebarSlice = createSlice({
  name: "chatSidebar",
  initialState,
  reducers: {
    toggleChatSidebar: (state) => {
      state.isChatSidebarOpen = !state.isChatSidebarOpen;
    },
    resetChatSidebarSlice: () => initialState,
  },
});

export const { toggleChatSidebar, resetChatSidebarSlice } =
  chatSidebarSlice.actions;

export const selectIsChatSidebarOpen = (state: {
  chatSidebar: ChatSidebarState;
}) => state.chatSidebar.isChatSidebarOpen;

export const chatSidebarReducer = chatSidebarSlice.reducer;
