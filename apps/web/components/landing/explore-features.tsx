import Link from "next/link";

import { FeatureGrid } from "@/components/landing/feature-grid";
import { Reveal } from "@/components/landing/reveal";
import { HOME_FEATURE_HREFS, HOME_FEATURE_LINKS } from "@/lib/marketing-content";

export function ExploreFeatures() {
  return (
    <section className="relative py-32 md:py-44">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mb-16 text-center">
          <p className="mb-4 text-ember text-xs font-medium tracking-[0.3em] uppercase">
            Explore features
          </p>
          <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
            Everything operators need
            <br />
            <span className="text-stroke">to close the books.</span>
          </h2>
        </Reveal>
        <FeatureGrid features={HOME_FEATURE_LINKS} hrefs={HOME_FEATURE_HREFS} />
        <Reveal className="mt-12 text-center">
          <Link
            className="font-display text-mist/60 text-sm transition-colors hover:text-mist"
            href="/platform"
          >
            See how it all connects →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
