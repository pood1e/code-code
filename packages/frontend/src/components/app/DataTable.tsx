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
      />
    );
  }

  return (
    <div className="space-y-4">
      {mobileCardRenderer ? (
        <div className="space-y-3 md:hidden">
          {table.getRowModel().rows.map((row) => (
            <div
              key={row.id}
              className="rounded-[calc(var(--radius)*1.05)] border border-border/70 bg-card/80 p-4"
            >
              {mobileCardRenderer(row.original)}
            </div>
          ))}
        </div>
      ) : null}

      <div className={mobileCardRenderer ? 'hidden md:block' : undefined}>
        <div className="overflow-hidden rounded-[calc(var(--radius)*1.05)] border border-border/70 bg-card/80">
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="border-border/70 hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="h-11 bg-muted/45 px-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
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
                    className="group border-border/70 transition-colors hover:bg-muted/20"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="px-4 py-4 align-top"
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
        <div className="rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs font-semibold text-muted-foreground">
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
    </div>
  );
}
