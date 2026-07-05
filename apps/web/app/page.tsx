import { APP_NAME } from "@/packages/shared";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-5xl font-semibold tracking-tight">{APP_NAME}</h1>
      <p className="text-muted-foreground max-w-sm text-lg">Coming soon.</p>
    </main>
  );
}
