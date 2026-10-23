// Copyright (C) 2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./UnauthorizedRoute.css";

import { keycloakService } from "@intel-enterprise-rag-ui/auth";
import { Button } from "@intel-enterprise-rag-ui/components";

const UnauthorizedRoute = () => {
  const handleLogout = () => {
    keycloakService.redirectToLogout();
  };

  return (
    <div className="unauthorized-route__layout">
      <h1>Access Required</h1>
      <p>
        Your account does not have the required permissions to access this
        application. Please contact your administrator to request an admin,
        user, or maintainer role.
      </p>
      <Button variant="outlined" onPress={handleLogout}>
        Sign Out
      </Button>
    </div>
  );
};

export default UnauthorizedRoute;
