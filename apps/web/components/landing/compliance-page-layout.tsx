import Image from "next/image";
import Link from "next/link";

import { APP_NAME } from "@/packages/shared";

type CompliancePageLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export function CompliancePageLayout({ children }: CompliancePageLayoutProps) {
  return (
    <div className="min-h-screen bg-ink text-mist">
      <header className="border-b border-mist/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link className="flex items-center gap-2.5 font-display text-lg font-bold" href="/">
            <Image
              alt={`${APP_NAME} logo`}
              className="h-9 w-9 rounded-xl"
              height={36}
              priority
              src="/brand-icon.webp"
              width={36}
            />
            {APP_NAME}
          </Link>
          <Link
            className="text-sm font-medium text-ember underline-offset-4 hover:underline"
            href="/privacy-policy"
          >
            Privacy Policy
          </Link>
        </div>
      </header>

      <main className="px-6 py-12 md:py-16">{children}</main>

      <footer className="border-t border-mist/10 px-6 py-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 text-sm text-mist/70">
          <span>
            © {new Date().getFullYear()} {APP_NAME}
          </span>
          <Link className="text-ember underline-offset-4 hover:underline" href="/privacy-policy">
            Privacy Policy
          </Link>
          <Link className="text-ember underline-offset-4 hover:underline" href="/terms-of-service">
            Terms of Service
          </Link>
          <Link className="text-ember underline-offset-4 hover:underline" href="/contact">
            Contact
          </Link>
        </div>
      </footer>
    </div>
  );
}
