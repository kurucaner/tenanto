import Link from "next/link";

import { APP_NAME } from "@/packages/shared";

const COLUMNS = [
  {
    links: [
      { href: "#platform", label: "Platform" },
      { href: "/security", label: "Security" },
    ],
    title: "Product",
  },
  {
    links: [{ href: "/contact", label: "Contact" }],
    title: "Company",
  },
  {
    links: [
      { href: "/privacy-policy", label: "Privacy" },
      { href: "/terms-of-service", label: "Terms" },
    ],
    title: "Resources",
  },
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t border-mist/8 bg-ink-2">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <a className="flex items-center gap-2.5 font-display text-lg font-bold" href="#">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-ember to-glow text-ink">
              ⌂
            </span>
            {APP_NAME}
          </a>
          <p className="mt-4 max-w-xs text-mist/45 text-sm">
            The operating system for modern residence management.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="mb-4 font-display text-mist/80 text-sm font-semibold">{col.title}</p>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("/") ? (
                    <Link
                      className="text-mist/45 text-sm transition-colors duration-300 hover:text-mist"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      className="text-mist/45 text-sm transition-colors duration-300 hover:text-mist"
                      href={link.href}
                    >
                      {link.label}
                    </a>
                  )}
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
