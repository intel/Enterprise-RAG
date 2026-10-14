// Copyright (C) 2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { keycloakService } from "@intel-enterprise-rag-ui/auth";
import { Button } from "@intel-enterprise-rag-ui/components";

const UnauthorizedRoute = () => {
  const handleLogout = () => {
    keycloakService.redirectToLogout();
  };

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Access Required</h1>
      <p className="text-foreground max-w-md text-center text-sm">
        Your account does not have the required permissions to access this
        application. Please contact your administrator to request an admin,
        user, or maintainer role.
      </p>
      <Button variant="outline" onPress={handleLogout}>
        Sign Out
      </Button>
    </div>
  );
};

export default UnauthorizedRoute;
