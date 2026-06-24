import Link from "next/link";
import { PulseMark } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="pulse-glow flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <PulseMark className="size-9" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">That answer doesn&apos;t exist (yet). Ask Pulse a question instead.</p>
      </div>
      <Button asChild size="sm">
        <Link href="/home">Back to Pulse</Link>
      </Button>
    </div>
  );
}
