import { slug } from "github-slugger";
import Link from "next/link";

interface Props {
  text: string;
}

export const Tag = ({ text }: Props) => {
  return (
    <Link
      href={`/tags/${slug(text)}`}
      className="relative mr-3 mb-2 inline-flex min-h-[44px] items-center overflow-hidden bg-transparent px-2 py-1.5 text-xs font-bold tracking-wide text-foreground uppercase transition-all duration-300 before:absolute before:bottom-0 before:left-0 before:-z-10 before:h-2 before:w-full before:bg-[var(--gold)]/40 before:transition-all before:duration-500 hover:text-foreground hover:before:h-full hover:before:bg-[var(--gold)]/60"
    >
      {text.split(" ").join("-")}
    </Link>
  );
};
