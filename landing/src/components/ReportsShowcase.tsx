import CountUp from "./CountUp";
import Reveal from "./Reveal";
import { WhatsAppIcon } from "./icons";
import { Eyebrow, SectionTitle } from "./ui";

const bullets = [
  { head: "Today and this week", body: "at a glance — the money counts up the moment you open Reports." },
  { head: "Top sellers ranked", body: "so you restock what actually moves, not what you guess moves." },
  { head: "A restock list that writes itself", body: "from your own low-stock thresholds." },
  { head: "Owed to you", body: "every credit sale tracked until the customer pays." },
  { head: "One-tap daily summary", body: "share the day's figures to WhatsApp before you close." },
];

const topSellers = [
  { name: "Coke 50cl", amount: "₦12,500" },
  { name: "Indomie (carton)", amount: "₦11,200" },
  { name: "Peak Milk 170g", amount: "₦8,550" },
];

export default function ReportsShowcase() {
  return (
    <section id="money" className="bg-white py-18 max-md:py-14">
      <div className="mx-auto grid max-w-[1060px] items-center gap-12 px-5 md:grid-cols-[0.9fr_1.1fr]">
        {/* Reports screen mockup */}
        <Reveal className="max-md:order-2">
          <div className="relative mx-auto w-[280px] max-md:w-[250px]" aria-hidden="true">
            <div className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(11_93_59/0.1),transparent)]" />
            <div className="rounded-[36px] bg-[#101311] p-3 shadow-[0_24px_60px_rgb(0_0_0/0.25)]">
              <div className="screen-sheen relative overflow-hidden rounded-[26px] bg-[#161A17] text-[0.72rem]">
                <div className="px-3.5 pb-2 pt-3.5 text-[#EDEFEA]">
                  <div className="font-display text-[0.86rem] font-semibold">Reports</div>
                  <div className="text-[0.68rem] text-[#8FA096]">Friday, 10 July</div>
                </div>

                <div className="mx-3 mb-2.5 rounded-[14px] bg-brand px-3.5 py-3 text-white">
                  <div className="text-[0.66rem] uppercase tracking-wide text-[#A9C6B8]">Today</div>
                  <CountUp value={57300} prefix="₦" className="font-display text-[1.45rem] font-bold text-gold" />
                  <div className="text-[0.66rem] text-[#A9C6B8]">23 sales · 61 items</div>
                </div>

                <div className="mx-3 mb-2.5 flex items-center justify-between rounded-[14px] bg-[#1F241F] px-3.5 py-2.5 text-[#EDEFEA]">
                  <span className="text-[#8FA096]">This week</span>
                  <span className="font-display font-bold text-[#4CC38A]">₦312,450</span>
                </div>

                <div className="mx-3 mb-2.5 rounded-[14px] bg-[#1F241F] px-3.5 py-2.5 text-[#EDEFEA]">
                  <div className="mb-1.5 text-[0.66rem] uppercase tracking-wide text-[#8FA096]">Top sellers</div>
                  {topSellers.map((s) => (
                    <div key={s.name} className="flex items-center justify-between py-0.5">
                      <span>{s.name}</span>
                      <span className="font-display font-semibold text-[#4CC38A]">{s.amount}</span>
                    </div>
                  ))}
                </div>

                <div className="mx-3 mb-2.5 flex items-center justify-between rounded-[14px] bg-[#1F241F] px-3.5 py-2.5">
                  <span className="text-[#8FA096]">Owed to you</span>
                  <span className="font-display font-bold text-gold">₦4,500 · 3 customers</span>
                </div>

                <div className="font-display mx-3 mb-3.5 flex items-center justify-center gap-1.5 rounded-2xl bg-brand px-3.5 py-3 font-semibold text-white">
                  <WhatsAppIcon className="h-3.5 w-3.5 text-gold" />
                  Share today&rsquo;s summary
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal className="max-md:order-1">
          <Eyebrow bars={3}>Know your money</Eyebrow>
          <SectionTitle>The night-time question, answered before you ask.</SectionTitle>
          <ul className="mt-6 space-y-3.5">
            {bullets.map((b) => (
              <li key={b.head} className="flex gap-3">
                <span className="mt-1 font-bold text-brand">✓</span>
                <p className="text-[0.98rem] text-[#333]">
                  <strong className="font-semibold text-ink">{b.head}</strong> {b.body}
                </p>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
