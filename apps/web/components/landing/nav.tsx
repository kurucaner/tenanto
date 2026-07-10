"use client";

import { motion, useMotionValueEvent, useScroll } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { APP_NAME } from "@/packages/shared";

const LINKS = [
  { href: "#about", label: "About" },
  { href: "#platform", label: "Platform" },
  { href: "#features", label: "Features" },
  { href: "/privacy-policy", label: "Privacy" },
] as const;

export function LandingNav() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden(latest > prev && latest > 240);
    setScrolled(latest > 40);
  });

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

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) =>
            link.href.startsWith("/") ? (
              <Link
                key={link.label}
                className="text-mist/60 text-sm transition-colors duration-300 hover:text-mist"
                href={link.href}
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                className="text-mist/60 text-sm transition-colors duration-300 hover:text-mist"
                href={link.href}
              >
                {link.label}
              </a>
            )
          )}
        </div>

        <a
          className="rounded-full bg-mist px-5 py-2.5 font-display text-ink text-sm font-semibold transition-transform duration-300 hover:scale-105"
          href="#cta"
        >
          Get started
        </a>
      </nav>
    </motion.header>
  );
}
