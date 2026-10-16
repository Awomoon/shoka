import DownloadCount from "./DownloadCount";
import PhoneMockup from "./PhoneMockup";
import { AndroidIcon, WhatsAppIcon } from "./icons";
import { APK_URL, WA_DEMO } from "@/lib/links";
import { GhostButton, GoldButton } from "./ui";

const newChips = [
  "Daily closing-time reminder",
  "Low-stock alerts",
  'Credit sales ("I go pay later")',
  "WhatsApp receipts",
];

export default function Hero() {
  return (
    <div className="hero-glow relative overflow-hidden bg-brand pt-14 text-white">
      {/* slow-drifting ambient blobs (desktop only — kind to cheap phone GPUs) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
        <div className="blob blob-gold -top-24 right-[10%] h-80 w-80" />
        <div className="blob blob-mint -left-20 bottom-[-35%] h-96 w-96" />
      </div>

      <div className="relative mx-auto grid max-w-[1060px] items-end gap-10 px-5 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h1 className="fade-up font-display text-[clamp(2rem,5.2vw,3.3rem)] font-bold leading-[1.12] tracking-[-0.02em]">
            Know your shop&rsquo;s money.
            <br />
            <span className="text-gold">Even without internet.</span>
          </h1>

          <p className="fade-up mb-6 mt-4.5 max-w-[34ch] text-[1.06rem] text-[#DCEAE2] [animation-delay:120ms]">
            Shoka records every sale in seconds and counts your stock down automatically — on the
            phone you already own.
          </p>

          <div className="fade-up mb-5.5 flex flex-wrap gap-2 [animation-delay:220ms]" aria-label="New in version 1.7">
            {newChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#EAF4EE] shadow-[inset_0_1px_0_rgb(255_255_255/0.15)] backdrop-blur-md"
              >
                <b className="font-bold text-gold">New</b> · {chip}
              </span>
            ))}
          </div>

          <div className="fade-up mb-3.5 flex flex-wrap gap-3 [animation-delay:320ms]">
            <GoldButton href={APK_URL}>
              <AndroidIcon />
              Download for Android
            </GoldButton>
            <GhostButton href={WA_DEMO}>
              <WhatsAppIcon />
              Chat on WhatsApp
            </GhostButton>
          </div>

          <DownloadCount />

          <p className="fade-up pb-11 text-[0.82rem] text-[#A9C6B8] [animation-delay:420ms]">
            Available for Android today · iOS on the roadmap · Works fully offline
          </p>
        </div>

        <div className="fade-up [animation-delay:250ms]">
          <PhoneMockup />
        </div>
      </div>
    </div>
  );
}
