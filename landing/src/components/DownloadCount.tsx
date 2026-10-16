"use client";

import { useEffect, useState } from "react";

/**
 * Live download counter — GitHub Releases tracks per-asset downloads, so no
 * backend is needed. Sums every APK across all releases. Stays hidden if the
 * request fails or the count is zero (never shows a fake number).
 */
export default function DownloadCount() {
  const [count, setCount] = useState<number | null>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("https://api.github.com/repos/Awomoon/shoka/releases")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rels: { assets?: { download_count?: number }[] }[]) => {
        if (cancelled) return;
        let n = 0;
        for (const rel of rels) for (const a of rel.assets ?? []) n += a.download_count ?? 0;
        if (n > 0) setCount(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (count === null) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(count);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 800);
      setShown(Math.round(count * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [count]);

  if (count === null) return null;

  return (
    <p className="mb-1.5 text-sm text-[#A9C6B8]">
      ⬇{" "}
      <b className="font-display text-base font-bold text-gold">{shown.toLocaleString()}</b>{" "}
      downloads and counting
    </p>
  );
}
