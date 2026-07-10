import Link from "next/link";

type BreadcrumbNavProps = Readonly<{
  current: string;
}>;

export function BreadcrumbNav({ current }: BreadcrumbNavProps) {
  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-6 pt-24">
      <ol className="flex items-center gap-2 text-mist/40 text-xs tracking-wide">
        <li>
          <Link className="transition-colors hover:text-mist/70" href="/">
            Home
          </Link>
        </li>
        <li aria-hidden>/</li>
        <li className="text-mist/70">{current}</li>
      </ol>
    </nav>
  );
}
