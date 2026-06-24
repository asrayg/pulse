import { PulseMark } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pulse-glow relative flex min-h-screen flex-col items-center justify-center px-4">
      <div className="pulse-grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative z-10 mb-8 flex items-center gap-2">
        <PulseMark className="size-7" />
        <span className="text-lg font-semibold tracking-tight">Pulse</span>
      </div>
      <div className="relative z-10 w-full max-w-sm">{children}</div>
      <p className="relative z-10 mt-8 max-w-xs text-center text-xs text-muted-foreground">
        PowerBI if it was built for people who actually need answers.
      </p>
    </div>
  );
}
