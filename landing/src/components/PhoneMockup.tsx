"use client";

import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "./icons";

const products = [
  { id: "coke", name: "Coke 50cl", price: "₦500", stock: "48 left" },
  { id: "indomie", name: "Indomie (carton)", price: "₦11,200", stock: "6 left" },
  { id: "milk", name: "Peak Milk 170g", price: "₦950", stock: "23 left" },
];

// Looping demo of a sale being rung up: each step is one "tap" at the counter.
type Step = { qty: Record<string, number>; items?: string; total?: string; tap?: string; done?: boolean };
const steps: Step[] = [
  { qty: { coke: 2 }, items: "2 items", total: "₦1,000" },
  { qty: { coke: 2, milk: 1 }, items: "3 items", total: "₦1,950", tap: "milk" },
  { qty: { coke: 2, milk: 2 }, items: "4 items", total: "₦2,900", tap: "milk" },
  { qty: { coke: 2, milk: 2, indomie: 1 }, items: "5 items", total: "₦14,100", tap: "indomie" },
  { qty: {}, done: true },
];

/** Pure-CSS mockup of the Sell screen, playing a short sale on loop. */
export default function PhoneMockup() {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    // Only animate while the phone is on screen.
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !timer) {
        timer = setInterval(() => setI((n) => (n + 1) % steps.length), 1700);
      } else if (!entry.isIntersecting && timer) {
        clearInterval(timer);
        timer = undefined;
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearInterval(timer);
    };
  }, []);

  const step = steps[i];

  return (
    <div ref={ref} className="phone-float relative mx-auto w-[280px] max-md:w-[250px]" aria-hidden="true">
      {/* soft gold glow behind the phone */}
      <div className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(245_183_0/0.22),transparent)]" />

      <div className="rounded-[36px] bg-[#101311] p-3 shadow-[0_24px_60px_rgb(0_0_0/0.35)]">
        <div className="screen-sheen relative overflow-hidden rounded-[26px] bg-[#161A17] text-[0.72rem]">
          <div className="px-3.5 pb-2.5 pt-3.5 text-[#EDEFEA]">
            <div className="font-display text-[0.86rem] font-semibold">DebbyRR Stores</div>
            <div className="text-[0.68rem] text-[#8FA096]">Friday, 10 July</div>
          </div>

          <div className="mx-3 mb-2.5 flex items-center gap-2 rounded-full bg-[#232823] px-3 py-2 text-[#8FA096]">
            <SearchIcon className="h-[13px] w-[13px] flex-none" />
            Search products…
          </div>

          {products.map((p) => {
            const qty = step.qty[p.id];
            return (
              <div
                key={p.name}
                className="relative mx-3 mb-2.5 rounded-[14px] bg-[#1F241F] px-3 py-2.5 text-[#EDEFEA]"
              >
                {step.tap === p.id && <span key={i} className="tap-ripple" />}
                {qty && (
                  <span
                    key={qty}
                    className="pop-in absolute -top-[7px] -right-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-gold font-bold text-brand-deep"
                  >
                    {qty}
                  </span>
                )}
                <div className="font-semibold">{p.name}</div>
                <div className="font-display text-base font-bold text-[#4CC38A]">{p.price}</div>
                <div className="text-[0.66rem] text-[#8FA096]">{p.stock}</div>
              </div>
            );
          })}

          <div className="font-display mx-3 mb-3.5 mt-6 flex items-center justify-between rounded-2xl bg-brand px-3.5 py-3 font-semibold text-white">
            {step.done ? (
              <span key="done" className="pop-in mx-auto text-gold">
                ✓ Sale recorded
              </span>
            ) : (
              <>
                <span>{step.items} ▸</span>
                <span key={step.total} className="pop-in text-gold">
                  {step.total}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
