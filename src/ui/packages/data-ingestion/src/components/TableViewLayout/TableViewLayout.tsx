// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import { Outlet } from "react-router-dom";

/**
 * Copy of DataIngestionLayout's own wrapper, nested one level deeper (inside
 * DataIngestionLayout's `<Outlet/>`) for the two views that render a full-width `DataTable`
 * (Files, Links). DataIngestionLayout still owns the shared banners — this layout only exists to
 * cancel its `px-16` (via a matching negative inline margin) so a table rendered inside can reach
 * the true edge of the available view; callers restore breathing room where they actually need it
 * (e.g. the table's pinned edge columns), not by re-padding the whole view.
 */
export const TableViewLayout = () => (
  <div className="-mx-16 flex h-full min-h-0 flex-1 flex-col">
    <Outlet />
  </div>
);

export default TableViewLayout;
