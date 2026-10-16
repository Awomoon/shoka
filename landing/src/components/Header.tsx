"use client";

import { useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/links";

const navLinks = [
  { id: "how", label: "How it works" },
  { id: "features", label: "Features" },
  { id: "offline", label: "Built for here" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight the nav link of the section currently in the middle of the viewport.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    for (const l of navLinks) {
      const el = document.getElementById(l.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 bg-brand/70 backdrop-blur-xl backdrop-saturate-150 transition-shadow ${
        scrolled ? "shadow-[0_8px_30px_rgb(6,51,31,0.35)]" : "shadow-[0_1px_0_rgb(255,255,255,0.08)]"
      }`}
    >
      <div className="mx-auto flex max-w-[1060px] items-center justify-between px-5 py-3.5">
        <a href="#top" aria-label="Shoka home" className="flex items-center gap-2.5 no-underline">
          {/* eslint-disable-next-line @next/next/no-img-element -- unoptimized export; next/image drops basePath */}
          <img
            src={`${BASE_PATH}/logo-mark.png`}
            alt=""
            width={34}
            height={26}
            className="logo-in h-auto w-[34px]"
          />
          <span className="font-display text-xl font-bold text-white">
            Sho<em className="not-italic text-gold">ka</em>
          </span>
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {navLinks.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              className={`text-sm font-medium transition-colors hover:text-gold ${
                active === l.id ? "text-gold" : "text-[#DCEAE2]"
              }`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <a
          href="#download"
          className="btn-sheen font-display rounded-full bg-gold px-4.5 py-2.25 text-sm font-semibold text-brand-deep"
        >
          Get the app
        </a>
      </div>
    </header>
  );
}
