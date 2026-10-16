const items = [
  "Sales in under 5 seconds",
  "Low-stock alerts",
  "Credit tracking",
  "WhatsApp receipts",
  "Daily WhatsApp summary",
  "Backup & restore",
  "Haggle-friendly prices",
  "₦ Naira-native",
];

/** Infinite feature marquee under the hero (static strip under reduced motion). */
export default function Ticker() {
  return (
    <div className="marquee border-y border-white/10 bg-brand-deep py-3.5" aria-hidden="true">
      <div className="marquee-track">
        {[0, 1].map((copy) => (
          <ul
            key={copy}
            className="font-display flex items-center text-sm font-semibold tracking-wide text-[#9FB8AB]"
          >
            {items.map((t) => (
              <li key={t} className="flex items-center">
                <span className="px-5">{t}</span>
                <i className="h-1.5 w-1.5 rounded-full bg-gold/70" />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
