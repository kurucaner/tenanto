import { type ReactNode } from "react";

type LegalProseProps = Readonly<{
  children: ReactNode;
  title: string;
}>;

export function LegalProse({ children, title }: LegalProseProps) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <h1 className="mb-12 font-display text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
      <div className="space-y-6 text-mist/75 leading-relaxed [&_a]:text-ember [&_a]:transition-colors [&_a:hover]:text-mist [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-mist [&_h2]:text-xl [&_h2]:font-semibold [&_li]:leading-relaxed [&_ol]:list-decimal [&_ol]:space-y-3 [&_ol]:pl-6 [&_strong]:text-mist">
        {children}
      </div>
    </article>
  );
}
