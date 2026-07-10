import Link from "next/link";

interface PaginationProps {
  totalPages: number;
  currentPage: number;
  basePath: string;
}

export function Pagination({ totalPages, currentPage, basePath }: Readonly<PaginationProps>) {
  const prevPage = currentPage - 1 > 0;
  const nextPage = currentPage + 1 <= totalPages;

  const getPageUrl = (page: number) => {
    if (page === 1) {
      return basePath;
    }
    return `${basePath}/${page}`;
  };

  return (
    <div className="space-y-2 pt-6 pb-8 md:space-y-5">
      <nav className="flex justify-between">
        {!prevPage && (
          <button
            className="cursor-auto text-foreground/40 disabled:opacity-50"
            disabled={!prevPage}
          >
            Previous
          </button>
        )}
        {prevPage && (
          <Link
            href={getPageUrl(currentPage - 1)}
            rel="prev"
            className="text-[var(--gold)] hover:opacity-80"
          >
            Previous
          </Link>
        )}
        <span className="text-foreground/60">
          {currentPage} of {totalPages}
        </span>
        {!nextPage && (
          <button
            className="cursor-auto text-foreground/40 disabled:opacity-50"
            disabled={!nextPage}
          >
            Next
          </button>
        )}
        {nextPage && (
          <Link
            href={getPageUrl(currentPage + 1)}
            rel="next"
            className="text-[var(--gold)] hover:opacity-80"
          >
            Next
          </Link>
        )}
      </nav>
    </div>
  );
}
