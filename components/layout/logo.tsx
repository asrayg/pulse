import { cn } from "@/lib/utils";

/** Pulse mark — an EKG/pulse line in a rounded square. */
export function PulseMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-md bg-gradient-to-br from-primary to-accent text-white", className)}>
      <svg viewBox="0 0 24 24" fill="none" className="size-[70%]" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h4l2.5-6 4 12L16 9l1.5 3H22" />
      </svg>
    </div>
  );
}
