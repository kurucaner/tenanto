import Image from "next/image";
import Link from "next/link";

import { FOOTER_COLUMNS } from "@/lib/marketing-content";
import { APP_NAME } from "@/packages/shared";

export function LandingFooter() {
  return (
    <footer className="border-t border-mist/8 bg-ink-2">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <Link className="flex items-center gap-2.5 font-display text-lg font-bold" href="/">
            <Image
              alt={`${APP_NAME} logo`}
              className="h-9 w-9 rounded-xl"
              height={36}
              src="/brand-icon.webp"
              width={36}
            />
            {APP_NAME}
          </Link>
          <p className="mt-4 max-w-xs text-mist/45 text-sm">
            Property accounting for short-term and long-term rental operators.
          </p>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="mb-4 font-display text-mist/80 text-sm font-semibold">{col.title}</p>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    className="text-mist/45 text-sm transition-colors duration-300 hover:text-mist"
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-mist/8 py-6 text-center text-mist/30 text-xs">
        © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
      </div>
    </footer>
  );
}
