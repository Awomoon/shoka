import Reveal from "./Reveal";
import {
  AlertIcon,
  BellIcon,
  ClockIcon,
  GridIcon,
  MoonIcon,
  ReceiptIcon,
  ShieldIcon,
  TagIcon,
  TrendingIcon,
  UndoIcon,
} from "./icons";
import { Eyebrow, SectionTitle } from "./ui";

const features: { icon: typeof BellIcon; title: string; body: string; badge?: string }[] = [
  {
    icon: TrendingIcon,
    title: "Your bestsellers, first",
    body: "The Sell screen learns what your shop actually moves and floats those products to the top — no scrolling, no typing.",
    badge: "New in 1.8",
  },
  {
    icon: BellIcon,
    title: "Smart reminders",
    body: "An 8:00 pm nudge to check today's money, and a tray alert the moment a sale leaves an item running low.",
  },
  {
    icon: GridIcon,
    title: "Sell 10 at once",
    body: "Long-press any product for the quantity pad — cartons and bulk orders go in with one tap.",
  },
  {
    icon: TagIcon,
    title: "Haggle-friendly prices",
    body: "Customer priced it down? Adjust the price for that sale only — your records stay honest.",
  },
  {
    icon: ClockIcon,
    title: "Credit sales",
    body: "“I go pay later” is now a button. Mark a sale as credit and Reports show exactly who still owes you.",
  },
  {
    icon: ReceiptIcon,
    title: "WhatsApp receipts",
    body: "Send a clean receipt right after any sale — straight to the customer's WhatsApp.",
  },
  {
    icon: AlertIcon,
    title: "Low-stock colour strips",
    body: "Every product carries a colour strip — green, yellow, red — so you see what's finishing before it finishes.",
  },
  {
    icon: ShieldIcon,
    title: "Backup & restore",
    body: "Your whole shop in one file, sent to your own WhatsApp or email. New phone? Everything comes back.",
  },
  {
    icon: UndoIcon,
    title: "Void a sale",
    body: "Wrong entry at the counter? Void it — stock returns automatically and your totals stay correct.",
  },
  {
    icon: MoonIcon,
    title: "Light & dark themes",
    body: "Follows your phone or your choice — built to stay readable on everyday screens.",
  },
];

export default function Features() {
  return (
    <section id="features" className="bg-chalk py-18 max-md:py-14">
      <div className="mx-auto max-w-[1060px] px-5">
        <Reveal>
          <Eyebrow bars={4}>Everything your counter needs</Eyebrow>
          <SectionTitle>Small app. Serious bookkeeping.</SectionTitle>
          <p className="mt-2.5 max-w-[52ch] text-moss">
            No accounting degree required — Shoka does the arithmetic while you face your customers.
          </p>
        </Reveal>
        <div className="mt-8.5 grid gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <div className="group h-full rounded-[18px] bg-white p-5.5 shadow-(--shadow-card) transition-[transform,box-shadow] duration-250 hover:-translate-y-1 hover:shadow-(--shadow-card-hover)">
                <div className="mb-3.5 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-tint text-brand transition-colors duration-250 group-hover:bg-brand group-hover:text-gold">
                    <f.icon className="h-5 w-5" />
                  </span>
                  {f.badge && (
                    <span className="font-display rounded-full bg-gold-soft px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-[#8a6d00]">
                      {f.badge}
                    </span>
                  )}
                </div>
                <h3 className="font-display mb-1.5 text-[1.02rem] font-bold text-ink">{f.title}</h3>
                <p className="text-[0.92rem] text-moss">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
