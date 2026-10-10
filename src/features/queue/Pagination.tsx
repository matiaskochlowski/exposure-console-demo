import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '../../ui/index.js';
import { PAGE_SIZE } from './filters.js';

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, pages, total, onPage }: PaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2"
    >
      <p className="text-sm text-muted tabular-nums">
        {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          aria-label="First page"
          disabled={page <= 1}
          onClick={() => onPage(1)}
        >
          <ChevronsLeft aria-hidden="true" className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Button>
        <span className="px-2 text-sm tabular-nums" aria-current="page">
          Page {page.toLocaleString()} of {pages.toLocaleString()}
        </span>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Last page"
          disabled={page >= pages}
          onClick={() => onPage(pages)}
        >
          <ChevronsRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
