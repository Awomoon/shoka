import { CHANNEL_URL, WA_DISPLAY, WA_PLAIN } from "@/lib/links";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-brand-deep py-6.5 text-sm text-[#9FB8AB]">
      <div className="mx-auto flex max-w-[1060px] flex-wrap justify-between gap-2.5 px-5">
        <span>
          Shoka — a <strong className="text-white">Moontech</strong> product · Oyo State, Nigeria
        </span>
        <span>
          <a href={WA_PLAIN} className="text-gold no-underline hover:underline">
            WhatsApp {WA_DISPLAY}
          </a>{" "}
          ·{" "}
          <a href={CHANNEL_URL} className="text-gold no-underline hover:underline">
            Updates channel
          </a>
        </span>
      </div>
    </footer>
  );
}
