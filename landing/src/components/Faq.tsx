"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import { Eyebrow, SectionTitle } from "./ui";
import { faqs } from "@/lib/faqs";

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="bg-brand-tint py-18 max-md:py-14">
      <div className="mx-auto max-w-[1060px] px-5">
        <Reveal>
          <Eyebrow bars={2}>Questions, answered</Eyebrow>
          <SectionTitle>Before you download</SectionTitle>
        </Reveal>
        <Reveal className="mt-8.5">
          <div className="divide-y divide-brand/10 rounded-[22px] bg-white px-6 shadow-(--shadow-pop) max-md:px-4.5">
            {faqs.map((f, i) => {
              const isOpen = open === i;
              return (
                <div key={f.q}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    className="font-display flex w-full items-center justify-between gap-4 py-5 text-left text-[1.02rem] font-semibold text-ink"
                  >
                    {f.q}
                    <span
                      aria-hidden="true"
                      className={`flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-tint text-brand transition-transform duration-300 ${
                        isOpen ? "rotate-45" : ""
                      }`}
                    >
                      +
                    </span>
                  </button>
                  <div className={`acc-panel ${isOpen ? "open" : ""}`}>
                    <div>
                      <p className="max-w-[70ch] pb-5 text-[0.95rem] text-moss">{f.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
