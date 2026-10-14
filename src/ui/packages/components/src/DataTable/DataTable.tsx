// Copyright (C) 2024-2026 Intel Corporation
// SPDX-License-Identifier: Apache-2.0

import "./DataTable.css";

import {
  FilterIcon,
  LoadingIcon,
  SortDownIcon,
  SortUpDownIcon,
  SortUpIcon,
} from "@intel-enterprise-rag-ui/icons";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  Header,
  RowData,
  RowSelectionState,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import classNames from "classnames";
import {
  ChangeEvent,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Checkbox } from "@/Checkbox/Checkbox";
import { Combobox } from "@/Combobox/Combobox";
import { Input } from "@/Input/Input";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Options for a header-level exact-match filter dropdown, keyed to the column's filtered value */
    filterOptions?: string[];
    /** Header-level filter control type. Defaults to "select" when filterOptions is set. */
    filterVariant?: "select" | "text" | "range";
    /** Bounds for a "range" filterVariant's native range input */
    filterRange?: { min: number; max: number; step?: number };
    /** Pin the column to the given edge; it stays fixed while other columns scroll horizontally */
    pin?: "left" | "right";
  }
}

interface DataTableProps<T extends object> {
  /** Default data for the table */
  defaultData: T[];
  /** Column definitions for the table */
  columns: ColumnDef<T>[];
  /** Flag indicating if data is currently loading */
  isDataLoading: boolean;
  /** If true, applies a denser layout */
  dense?: boolean;
  /** Controlled global filter value */
  globalFilter?: string;
  /** Callback when the global filter changes */
  onGlobalFilterChange?: (value: string) => void;
  /** Additional class names for the table */
  className?: string;
  /** Enable row selection with checkboxes */
  enableRowSelection?: boolean;
  /** Controlled row selection state */
  rowSelection?: RowSelectionState;
  /** Callback when row selection changes */
  onRowSelectionChange?: (rowSelection: RowSelectionState) => void;
  /** Function to get the row id */
  getRowId?: (row: T) => string;
  /** Grow to fill the height of the parent flex container instead of capping at a fixed height */
  fillHeight?: boolean;
  /**
   * Controls the header filter row's visibility. When omitted, it shows automatically whenever
   * any column defines `meta.filterOptions`/`meta.filterVariant` (previous default behavior).
   */
  showFilterRow?: boolean;
}

export const DataTable = <T extends object>({
  defaultData,
  columns,
  isDataLoading,
  dense,
  globalFilter,
  onGlobalFilterChange,
  className = "",
  enableRowSelection = false,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  getRowId,
  fillHeight = false,
  showFilterRow,
}: DataTableProps<T>) => {
  const [data, setData] = useState(() => defaultData);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [internalGlobalFilter, setInternalGlobalFilter] = useState("");
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});

  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const handleRowSelectionChange =
    onRowSelectionChange ?? setInternalRowSelection;

  // Compute estimated row height based on dense prop
  // Dense mode: h-8 = 32px, Normal mode: h-12 = 48px
  const estimatedRowHeight = useMemo(() => (dense ? 32 : 48), [dense]);

  useEffect(() => {
    setData(defaultData);
  }, [defaultData]);

  useEffect(() => {
    if (enableRowSelection && controlledRowSelection === undefined) {
      setInternalRowSelection({});
    }
  }, [defaultData, enableRowSelection, controlledRowSelection]);

  const effectiveGlobalFilter = useMemo(
    () => globalFilter ?? internalGlobalFilter,
    [globalFilter, internalGlobalFilter],
  );

  const columnsWithSelection = useMemo(() => {
    if (!enableRowSelection) return columns;

    const selectionColumn: ColumnDef<T> = {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          isSelected={table.getIsAllRowsSelected()}
          isIndeterminate={table.getIsSomeRowsSelected()}
          onChange={() => table.toggleAllRowsSelected()}
          aria-label="Select all rows"
          dense
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          isSelected={row.getIsSelected()}
          onChange={() => row.toggleSelected()}
          aria-label="Select row"
          dense
        />
      ),
      enableSorting: false,
      enableGlobalFilter: false,
      meta: { pin: "left" },
    };

    return [selectionColumn, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: columnsWithSelection,
    state: {
      sorting,
      columnFilters,
      globalFilter: effectiveGlobalFilter,
      ...(enableRowSelection && { rowSelection }),
    },
    enableRowSelection,
    onRowSelectionChange: (updater) => {
      const newSelection =
        typeof updater === "function" ? updater(rowSelection) : updater;
      handleRowSelectionChange(newSelection);
    },
    getRowId,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: onGlobalFilterChange ?? setInternalGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const scrollParentRef = useRef<HTMLTableSectionElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 6,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() -
        virtualItems[virtualItems.length - 1].end
      : 0;

  const tableClassNames = classNames(
    "data-table",
    { "data-table--dense": dense },
    className,
  );

  // Helper function to render table content
  const renderTableContent = useCallback(() => {
    if (isDataLoading) {
      return (
        <tr className="loading-row">
          <td colSpan={100} className="py-4">
            <div className="flex items-center justify-center">
              <LoadingIcon className="mr-2 text-sm" />
              <p>Loading data...</p>
            </div>
          </td>
        </tr>
      );
    }

    if (rows.length === 0) {
      return (
        <tr className="empty-row">
          <td colSpan={columns.length}>
            <p className="text-center">No data</p>
          </td>
        </tr>
      );
    }

    return (
      <>
        {paddingTop > 0 && (
          <tr className="virtual-row-spacer">
            <td
              style={{ height: `${paddingTop}px` }}
              colSpan={columns.length}
            />
          </tr>
        )}
        {virtualItems.map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <tr key={row.id} data-index={virtualRow.index}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} data-pin={cell.column.columnDef.meta?.pin}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          );
        })}
        {paddingBottom > 0 && (
          <tr className="virtual-row-spacer">
            <td
              style={{ height: `${paddingBottom}px` }}
              colSpan={columns.length}
            />
          </tr>
        )}
      </>
    );
  }, [
    isDataLoading,
    columns.length,
    paddingTop,
    virtualItems,
    paddingBottom,
    rows,
  ]);

  const hasFilterableColumns = useMemo(
    () =>
      columnsWithSelection.some(
        (column) => column.meta?.filterOptions || column.meta?.filterVariant,
      ),
    [columnsWithSelection],
  );
  const isFilterRowVisible = showFilterRow ?? hasFilterableColumns;

  const renderFilterCell = useCallback((header: Header<T, unknown>) => {
    const meta = header.column.columnDef.meta;

    if (header.column.id === "select") {
      return <FilterIcon aria-hidden="true" className="text-sm" />;
    }

    if (meta?.filterOptions) {
      return (
        <Combobox
          size="sm"
          className="mb-0"
          items={["All", ...meta.filterOptions]}
          value={(header.column.getFilterValue() as string) ?? "All"}
          onChange={(value) =>
            header.column.setFilterValue(value === "All" ? undefined : value)
          }
          aria-label={`Filter by ${
            typeof header.column.columnDef.header === "string"
              ? header.column.columnDef.header
              : header.column.id
          }`}
          data-testid={`${header.column.id}-filter-combobox`}
        />
      );
    }

    if (meta?.filterVariant === "text") {
      return (
        <Input
          name={`${header.column.id}-filter`}
          size="sm"
          className="mb-0"
          value={(header.column.getFilterValue() as string) ?? ""}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            header.column.setFilterValue(
              event.target.value === "" ? undefined : event.target.value,
            )
          }
          aria-label={`Filter by ${
            typeof header.column.columnDef.header === "string"
              ? header.column.columnDef.header
              : header.column.id
          }`}
          data-testid={`${header.column.id}-filter-input`}
        />
      );
    }

    if (meta?.filterVariant === "range" && meta.filterRange) {
      const { min, max, step } = meta.filterRange;
      const filterValue = header.column.getFilterValue() as number | undefined;
      return (
        <input
          type="range"
          className="data-table-filter-row__range"
          min={min}
          max={max}
          step={step ?? 1}
          value={filterValue ?? max}
          onChange={(event) =>
            header.column.setFilterValue(Number(event.target.value))
          }
          aria-label={`Filter by ${
            typeof header.column.columnDef.header === "string"
              ? header.column.columnDef.header
              : header.column.id
          }`}
          data-testid={`${header.column.id}-filter-range`}
        />
      );
    }

    return null;
  }, []);

  const renderTableHeader = useCallback(() => {
    return table.getHeaderGroups().map((headerGroup) => (
      <Fragment key={headerGroup.id}>
        <tr>
          {headerGroup.headers.map((header) => (
            <th
              key={header.id}
              className={header.column.getCanSort() ? "sortable" : ""}
              aria-sort={
                header.column.getIsSorted()
                  ? header.column.getIsSorted() === "asc"
                    ? "ascending"
                    : "descending"
                  : undefined
              }
              onClick={header.column.getToggleSortingHandler()}
              data-pin={header.column.columnDef.meta?.pin}
            >
              {!header.isPlaceholder && (
                <div className="flex items-center gap-1">
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                  {header.column.getCanSort() && (
                    <span className="sort-indicator">
                      {header.column.getIsSorted() === "asc" ? (
                        <SortUpIcon />
                      ) : header.column.getIsSorted() === "desc" ? (
                        <SortDownIcon />
                      ) : (
                        <SortUpDownIcon />
                      )}
                    </span>
                  )}
                </div>
              )}
            </th>
          ))}
        </tr>
        {isFilterRowVisible && (
          <tr className="data-table-filter-row">
            {headerGroup.headers.map((header) => (
              <th
                key={`${header.id}-filter`}
                data-pin={header.column.columnDef.meta?.pin}
              >
                {renderFilterCell(header)}
              </th>
            ))}
          </tr>
        )}
      </Fragment>
    ));
  }, [table, isFilterRowVisible, renderFilterCell]);

  return (
    <div
      className={classNames("data-table-wrapper", {
        "data-table-wrapper--fill": fillHeight,
      })}
    >
      <table className={tableClassNames}>
        <thead>{renderTableHeader()}</thead>
        <tbody ref={scrollParentRef} className="data-table-body">
          {renderTableContent()}
        </tbody>
      </table>
    </div>
  );
};

export type { RowSelectionState } from "@tanstack/react-table";
