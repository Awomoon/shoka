// Must match basePath in next.config.ts — next/image skips basePath when
// images are unoptimized, so static assets are referenced through this.
export const BASE_PATH = "/shoka";

export const APK_URL = "https://github.com/Awomoon/shoka/releases/latest/download/shoka.apk";

const WA_NUMBER = "2347068367213";
export const WA_DISPLAY = "+234 706 836 7213";

export const waLink = (text: string) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

export const WA_DEMO = waLink("Hi Raphael, I want a free Shoka demo");
export const WA_SETUP = waLink("Hi Raphael, I want Shoka set up for my shop");
export const WA_QUESTION = waLink("Hi Raphael, I have a question about Shoka");
export const WA_PLAIN = `https://wa.me/${WA_NUMBER}`;

export const CHANNEL_URL = "https://whatsapp.com/channel/0029Vb91wsFJ3jurisQ2CJ1X";
