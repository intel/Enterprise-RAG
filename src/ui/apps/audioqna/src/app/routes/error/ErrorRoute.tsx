// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { AppError } from "@intel-enterprise-rag-ui/layouts";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

import { paths } from "@/config/paths";

const ErrorRoute = () => {
  const error = useRouteError();

  return isRouteErrorResponse(error) ? (
    <AppError
      status={error.status}
      statusText={error.statusText}
      homePath={paths.chat}
    />
  ) : (
    <AppError homePath={paths.chat} />
  );
};

export default ErrorRoute;
