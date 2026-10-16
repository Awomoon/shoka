import type { ReactNode } from "react";
import { TallyMark } from "./icons";

/** Section label: tally-mark motif + uppercase kicker. */
export function Eyebrow({
  bars,
  children,
  light = false,
}: {
  bars: number;
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <div className="mb-3.5 flex items-center gap-3">
      <TallyMark bars={bars} light={light} />
      <span
        className={`font-display text-xs font-semibold uppercase tracking-[0.12em] ${
          light ? "text-gold" : "text-brand"
        }`}
      >
        {children}
      </span>
    </div>
  );
}

export function SectionTitle({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <h2
      className={`font-display max-w-[22ch] text-[clamp(1.5rem,3.4vw,2.2rem)] font-bold leading-tight tracking-[-0.01em] ${
        light ? "text-white" : "text-ink"
      }`}
    >
      {children}
    </h2>
  );
}

const btnBase =
  "btn-sheen font-display inline-flex items-center gap-2.5 rounded-full px-6.5 py-3.5 text-base font-semibold no-underline transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:flex-none";

export function GoldButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className={`${btnBase} btn-gold text-brand-deep`}>
      {children}
    </a>
  );
}

export function GhostButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className={`${btnBase} border-2 border-white/55 bg-white/5 text-white backdrop-blur-sm`}
    >
      {children}
    </a>
  );
}
