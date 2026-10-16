import Reveal from "./Reveal";
import { AndroidIcon, BoltIcon, ShieldIcon, TallyMark, UndoIcon, WhatsAppIcon } from "./icons";
import { Eyebrow, GhostButton, GoldButton, SectionTitle } from "./ui";
import { APK_URL, CHANNEL_URL, WA_QUESTION, WA_SETUP } from "@/lib/links";

const wrap = "mx-auto max-w-[1060px] px-5";

export function Problem() {
  return (
    <section className="py-18 max-md:py-14">
      <Reveal className={wrap}>
        <Eyebrow bars={1}>The daily question</Eyebrow>
        <SectionTitle>&ldquo;How much did I really sell today?&rdquo;</SectionTitle>
        <blockquote className="mt-6.5 max-w-[56ch] rounded-r-[18px] border-l-[5px] border-gold bg-white px-6.5 py-5.5 text-lg shadow-[0_6px_24px_rgb(11_93_59/0.07)]">
          Notebooks get lost. Memory gets tired. And every month, money quietly leaks away through
          miscounted stock, forgotten sales and guesswork restocking.{" "}
          <strong className="text-brand">Shoka answers the question — exactly, every day.</strong>
        </blockquote>
      </Reveal>
    </section>
  );
}

const steps = [
  {
    bars: 1,
    title: "Sell in seconds",
    body: "Tap the item, tap complete. A sale is recorded in under 5 seconds — even with a customer waiting and a queue behind them.",
  },
  {
    bars: 2,
    title: "Stock counts itself",
    body: "Every sale reduces your stock automatically. Get a warning before any item finishes — your restock list writes itself.",
  },
  {
    bars: 3,
    title: "Know your money",
    body: "Today's total, weekly figures, best sellers — check from the shop, or from home at night. Share your daily summary to WhatsApp in one tap.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-brand-tint py-18 max-md:py-14">
      <div className={wrap}>
        <Reveal>
          <Eyebrow bars={2}>How it works</Eyebrow>
          <SectionTitle>Sell. Stock. Know.</SectionTitle>
        </Reveal>
        <div className="mt-8.5 grid gap-4.5 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 90}>
              <div className="h-full rounded-[18px] bg-white p-6 shadow-(--shadow-card) transition-[transform,box-shadow] duration-250 hover:-translate-y-1 hover:shadow-(--shadow-card-hover)">
                <TallyMark bars={s.bars} />
                <h3 className="font-display mb-2 mt-3 text-[1.06rem] font-bold text-brand">{s.title}</h3>
                <p className="text-[0.95rem] text-moss">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const offlineFeatures = [
  {
    icon: BoltIcon,
    title: "100% offline",
    body: "Everything saves on your phone. No subscription data costs just to sell.",
  },
  {
    icon: ShieldIcon,
    title: "Your records, protected",
    body: "Back up your whole shop to a file and send it to your own WhatsApp. Phone lost? Restore everything on a new one.",
  },
  {
    icon: UndoIcon,
    title: "Mistake at the counter?",
    body: "Void a wrong sale — stock returns automatically and your numbers stay honest.",
  },
];

export function Offline() {
  return (
    <section id="offline" className="bg-brand py-18 text-white max-md:py-14">
      <div className={wrap}>
        <Reveal>
          <Eyebrow bars={5} light>
            Built for here
          </Eyebrow>
          <SectionTitle light>No light? No data? No problem.</SectionTitle>
          <p className="mt-2.5 max-w-[52ch] text-[#C9DED3]">
            Shoka was built in Nigeria, for how business really works here.
          </p>
        </Reveal>
        <div className="mt-8.5 grid gap-4.5 md:grid-cols-3">
          {offlineFeatures.map((f, i) => (
            <Reveal key={f.title} delay={i * 90}>
              <div className="h-full rounded-[18px] border border-white/20 bg-white/5 p-5.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] backdrop-blur-md transition-[background,transform] duration-250 hover:-translate-y-0.75 hover:bg-white/10">
                <f.icon className="mb-2.5 block h-6.5 w-6.5 text-gold" />
                <strong className="font-display mb-1.5 block text-gold">{f.title}</strong>
                <p className="text-[0.94rem] text-[#C9DED3]">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const included = [
  "App installed and set up in person",
  "All your products and prices loaded for you",
  "You and your staff trained until comfortable",
  "Support one WhatsApp message away",
  "Updates and new features as Shoka grows",
];

export function Pricing() {
  return (
    <section id="pricing" className="py-18 max-md:py-14">
      <Reveal className={wrap}>
        <Eyebrow bars={4}>Simple pricing</Eyebrow>
        <SectionTitle>One setup. One small monthly. No surprises.</SectionTitle>
        <div className="mt-8.5 grid overflow-hidden rounded-[22px] bg-white shadow-(--shadow-pop) md:grid-cols-2">
          <div className="px-7.5 py-8.5">
            <div className="font-display text-[2rem] font-bold text-brand">
              ₦100,000 <span className="font-sans text-sm font-normal text-moss">one-time setup</span>
            </div>
            <div className="font-display mt-1.5 text-[1.4rem] font-bold text-brand">
              ₦7,500 <span className="font-sans text-sm font-normal text-moss">/ month after</span>
            </div>
            <ul className="mt-4.5 space-y-2.5">
              {included.map((item) => (
                <li
                  key={item}
                  className="relative pl-6.5 text-[0.96rem] text-[#333] before:absolute before:left-0 before:font-bold before:text-brand before:content-['✓']"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel-sheen flex flex-col justify-center gap-3.5 bg-gold-soft px-7.5 py-8.5">
            <span className="font-display self-start rounded-full bg-brand px-4 py-2 text-xs font-semibold tracking-[0.06em] text-white">
              FREE TO DOWNLOAD
            </span>
            <p className="text-[0.95rem] text-[#5a5340]">
              Shoka is free to download today — in-app purchases are coming soon, so early users get
              in first. Want it set up for you in person? That&rsquo;s what we do.
            </p>
            <div>
              <GoldButton href={WA_SETUP}>
                <WhatsAppIcon />
                Start my free week
              </GoldButton>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function Channel() {
  return (
    <section className="pb-18 max-md:pb-14">
      <Reveal className={wrap}>
        <div className="flex flex-wrap items-center justify-between gap-5.5 rounded-[22px] bg-brand p-7.5 text-white shadow-[0_10px_36px_rgb(11_93_59/0.18)]">
          <div>
            <h3 className="font-display text-xl font-bold">Be first to know 📢</h3>
            <p className="mt-1 max-w-[46ch] text-[0.95rem] text-[#C9DED3]">
              New features, update alerts and shop tips land in the Shoka WhatsApp Channel first.
              Free to join — announcements only, no group chatter, your number stays private.
            </p>
          </div>
          <GoldButton href={CHANNEL_URL}>
            <WhatsAppIcon />
            Join the Shoka channel
          </GoldButton>
        </div>
      </Reveal>
    </section>
  );
}

export function FinalCta() {
  return (
    <section id="download" className="bg-brand-deep py-18 text-center text-white max-md:py-14">
      <Reveal className={wrap}>
        <h2 className="font-display mx-auto max-w-[22ch] text-[clamp(1.5rem,3.4vw,2.2rem)] font-bold leading-tight tracking-[-0.01em] text-white">
          Your shop&rsquo;s money, finally clear.
        </h2>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <GoldButton href={APK_URL}>
            <AndroidIcon />
            Download Shoka for Android
          </GoldButton>
          <GhostButton href={WA_QUESTION}>
            <WhatsAppIcon />
            Ask a question
          </GhostButton>
        </div>

        <ol className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-x-10 gap-y-4 text-left">
          {[
            "Tap Download — a direct APK, about 95 MB.",
            "Allow “install unknown apps” if your phone asks.",
            "Open Shoka, add your products, sell.",
          ].map((step, i) => (
            <li key={step} className="flex max-w-[240px] items-start gap-3">
              <span className="font-display flex h-7 w-7 flex-none items-center justify-center rounded-full bg-gold text-sm font-bold text-brand-deep">
                {i + 1}
              </span>
              <span className="text-sm text-[#C9DED3]">{step}</span>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  );
}
