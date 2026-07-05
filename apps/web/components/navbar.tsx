"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ThemeSwitcher } from "@/components/theme-switcher";

const SCROLL_THRESHOLD = 80;

const NAV_LINKS = [{ href: "/", label: "Home" }] as const;

export function Navbar() {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const pathname = usePathname();

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;

    if (currentScrollY < SCROLL_THRESHOLD) {
      setIsVisible(true);
    } else if (currentScrollY > lastScrollY.current) {
      setIsVisible(false);
    } else {
      setIsVisible(true);
    }

    lastScrollY.current = currentScrollY;
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-center border-b border-[var(--navbar-border)] bg-[var(--navbar-bg)] backdrop-blur-lg transition-transform duration-300 md:h-16"
      style={{
        transform: isVisible ? "translateY(0)" : "translateY(-100%)",
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-6 md:gap-8">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium uppercase tracking-widest transition-colors md:text-base ${
                  isActive ? "text-[var(--gold)]" : "text-[var(--navbar-link)] hover:text-[var(--gold)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <ThemeSwitcher />
      </div>
    </nav>
  );
}
