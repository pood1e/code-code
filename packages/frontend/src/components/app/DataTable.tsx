import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/app/EmptyState';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

type DataTableProps<TData> = {
  columns: Array<ColumnDef<TData>>;
  data: TData[];
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
  isLoading?: boolean;
  pageSize?: number;
  mobileCardRenderer?: (item: TData) => ReactNode;
};

export function DataTable<TData>({
  columns,
  data,
  emptyTitle,
  emptyDescription,
  emptyAction,
  isLoading = false,
  pageSize = 8,
  mobileCardRenderer
}: DataTableProps<TData>) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [sorting, setSorting] = useState<SortingState>([]);
  const pagination = useMemo(
    () => ({
      pageIndex: 0,
      pageSize
    }),
    [pageSize]
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table is the intended state owner for this grid component.
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting
    },
    initialState: {
      pagination
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        size="compact"
      />
    );
  }

  return (
    <div className="space-y-4">
      {mobileCardRenderer && isMobile ? (
        <div className="space-y-3">
          {table.getRowModel().rows.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-border/40 bg-card p-4"
            >
              {mobileCardRenderer(row.original)}
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="border-border/40 hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="h-10 bg-muted/40 px-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                        style={{
                          width: header.column.columnDef.size
                            ? `${header.column.columnDef.size}px`
                            : undefined
                        }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="group border-border/40 transition-colors hover:bg-muted/30"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="px-4 py-3 align-top"
                        style={{
                          width: cell.column.columnDef.size
                            ? `${cell.column.columnDef.size}px`
                            : undefined
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        </div>
      )}

      {table.getPageCount() > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <div className="px-3 py-1 text-xs text-muted-foreground">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
