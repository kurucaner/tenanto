import Link from "next/link";

import { Reveal } from "@/components/landing/reveal";
import { type TMarketingLink } from "@/lib/marketing-content";

type RelatedLinksProps = Readonly<{
  links: TMarketingLink[];
}>;

export function RelatedLinks({ links }: RelatedLinksProps) {
  if (links.length === 0) return null;

  return (
    <section className="border-t border-mist/8 py-16">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="mb-6 text-mist/40 text-xs tracking-[0.25em] uppercase">Related</p>
          <div className="flex flex-wrap gap-4">
            {links.map((link) => (
              <Link
                className="rounded-full border border-mist/15 px-5 py-2.5 font-display text-mist/70 text-sm transition-colors duration-300 hover:border-mist/40 hover:text-mist"
                href={link.href}
                key={link.href}
              >
                {link.label} →
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
