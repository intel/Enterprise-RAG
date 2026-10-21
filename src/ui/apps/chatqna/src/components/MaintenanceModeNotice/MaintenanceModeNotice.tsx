// Copyright (C) 2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Link } from "react-router-dom";

import { paths } from "@/config/paths";
import { getChatQnAAppEnv } from "@/utils";

const MAINTENANCE_MODE_REASON = getChatQnAAppEnv("MAINTENANCE_MODE_REASON");

const adminPanelLink = <Link to={paths.adminPanel}>Admin Panel</Link>;

// "no-llm" is set by the deployment when the pipeline composes no LLM step, so chat is
// permanently unavailable rather than temporarily down. Telling the user to check back
// later would be untrue in that case.
const MaintenanceModeNotice = () =>
  MAINTENANCE_MODE_REASON === "no-llm" ? (
    <div className="flex h-screen flex-col items-center justify-center p-8 text-center">
      <h2>Chat Not Available</h2>
      <p>
        This deployment runs a pipeline without a text generation step, so chat
        answers cannot be generated. Only the {adminPanelLink} is accessible,
        where documents and pipeline settings can still be managed.
      </p>
    </div>
  ) : (
    <div className="flex h-screen flex-col items-center justify-center p-8 text-center">
      <h2>Maintenance Mode</h2>
      <p>
        The Chat QnA application is currently under maintenance. Only{" "}
        {adminPanelLink} is accessible. Please check back later.
      </p>
    </div>
  );

export default MaintenanceModeNotice;
