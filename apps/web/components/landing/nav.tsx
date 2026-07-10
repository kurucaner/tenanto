"use client";

import { motion, useMotionValueEvent, useScroll } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { FEATURE_NAV_LINKS, PRIMARY_NAV_LINKS } from "@/lib/marketing-content";
import { APP_NAME } from "@/packages/shared";

export function LandingNav() {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(latest > prev && latest > 240);
    setScrolled(latest > 40);
  });

  const closeMobile = () => setMobileOpen(false);

  return (
    <motion.header
      animate={{ y: hidden ? "-110%" : "0%" }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
        scrolled ? "glass" : "bg-transparent"
      }`}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
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

        <div className="hidden items-center gap-6 lg:flex">
          {PRIMARY_NAV_LINKS.slice(0, 1).map((link) => (
            <Link
              className={`text-sm transition-colors duration-300 ${
                pathname === link.href ? "text-mist" : "text-mist/60 hover:text-mist"
              }`}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}

          <div
            className="relative"
            onMouseEnter={() => setFeaturesOpen(true)}
            onMouseLeave={() => setFeaturesOpen(false)}
          >
            <button
              aria-expanded={featuresOpen}
              className="text-mist/60 text-sm transition-colors duration-300 hover:text-mist"
              type="button"
            >
              Features
            </button>
            {featuresOpen ? (
              <div className="absolute top-full left-1/2 z-50 mt-3 w-56 -translate-x-1/2 rounded-2xl border border-mist/10 bg-ink-2/95 p-2 shadow-xl backdrop-blur-xl">
                {FEATURE_NAV_LINKS.map((link) => (
                  <Link
                    className="block rounded-xl px-4 py-2.5 text-mist/70 text-sm transition-colors hover:bg-mist/5 hover:text-mist"
                    href={link.href}
                    key={link.href}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {PRIMARY_NAV_LINKS.slice(1).map((link) => (
            <Link
              className={`text-sm transition-colors duration-300 ${
                pathname === link.href ? "text-mist" : "text-mist/60 hover:text-mist"
              }`}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            className="hidden rounded-full bg-mist px-5 py-2.5 font-display text-ink text-sm font-semibold transition-transform duration-300 hover:scale-105 sm:inline-block"
            href="/contact"
          >
            Get started
          </Link>
          <button
            aria-expanded={mobileOpen}
            aria-label="Open menu"
            className="rounded-lg border border-mist/15 p-2 text-mist/70 lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            type="button"
          >
            <span className="block h-0.5 w-5 bg-current" />
            <span className="mt-1.5 block h-0.5 w-5 bg-current" />
            <span className="mt-1.5 block h-0.5 w-5 bg-current" />
          </button>
        </div>
      </nav>

      {mobileOpen ? (
        <div className="border-t border-mist/8 bg-ink-2/98 px-6 py-6 lg:hidden">
          <div className="space-y-6">
            <div>
              <p className="mb-3 text-mist/40 text-xs tracking-widest uppercase">Product</p>
              <div className="space-y-2">
                <Link
                  className="block text-mist/70 text-sm"
                  href="/platform"
                  onClick={closeMobile}
                >
                  Platform
                </Link>
                {FEATURE_NAV_LINKS.map((link) => (
                  <Link
                    className="block text-mist/70 text-sm"
                    href={link.href}
                    key={link.href}
                    onClick={closeMobile}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-mist/40 text-xs tracking-widest uppercase">Company</p>
              <div className="space-y-2">
                {PRIMARY_NAV_LINKS.slice(1).map((link) => (
                  <Link
                    className="block text-mist/70 text-sm"
                    href={link.href}
                    key={link.href}
                    onClick={closeMobile}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  className="block text-mist/70 text-sm"
                  href="/security"
                  onClick={closeMobile}
                >
                  Security
                </Link>
                <Link
                  className="block text-mist/70 text-sm"
                  href="/reliability"
                  onClick={closeMobile}
                >
                  Reliability
                </Link>
              </div>
            </div>
            <Link
              className="inline-block rounded-full bg-mist px-5 py-2.5 font-display text-ink text-sm font-semibold"
              href="/contact"
              onClick={closeMobile}
            >
              Get started
            </Link>
          </div>
        </div>
      ) : null}
    </motion.header>
  );
}
