# ShopTally — UI Polish & GitHub Plan

Follow-up to `shoptally-build-plan.md`. Three parts, in order: **A) modern UI pass, B) animation upgrade, C) push to GitHub.**

Ground rules carry over: theme tokens only (no hardcoded colors), 56pt+ touch targets, must stay fast on cheap Androids. Modern ≠ heavy — no blur effects, no full-screen gradients, no heavy shadow stacks; those tank performance on low-end devices.

---

## Part A — Modern UI pass

### A1. Design token upgrade (`src/theme.js`)
1. Add a `radius` scale: `sm: 10, md: 16, lg: 20, pill: 999`. Cards use `md`/`lg`. Nothing square-cornered remains except full-width dividers.
2. Add an `elevation` recipe per theme: light mode uses soft shadows (`shadowOpacity` ~0.06–0.08, radius 12, offset y=4, plus `elevation: 3` for Android); dark mode uses **surface color steps instead of shadows** (card `#1E1E1E`, raised `#262626`) — shadows are invisible on dark backgrounds.
3. Typography rhythm: screen titles 24pt bold, section labels 13pt medium uppercase with letter-spacing in `muted`, prices stay the 28–36pt hero.

### A2. Screen headers
Replace default navigation headers with a custom header component: screen title on the left, contextual action on the right (theme toggle on Reports, "+ Add" on Stock). On Sell, the header is a slim greeting row: "Good morning" + today's date, small and quiet — the products are the stars.

### A3. Sell screen
1. Search becomes a **pill-shaped input** with a search icon, sitting in a sticky bar under the header.
2. Product cards: rounded-`lg` white/raised cards with the elevation recipe, product name 15pt medium, price big and bold in primary, stock as a small muted line. In-cart qty badge becomes a filled yellow circle on the card's top-right corner.
3. Cart becomes a proper **bottom sheet** (use `@gorhom/bottom-sheet` — install with `npx expo install @gorhom/bottom-sheet react-native-gesture-handler`): drag up from the cart bar, snap points at ~50% and 90%, rounded top corners, drag handle. Line items with +/− steppers, subtotal, and the big green Complete Sale button pinned at the sheet's bottom.
4. Add **haptics** (`npx expo install expo-haptics`): light impact when adding to cart, success notification haptic when a sale completes. Cheapest "expensive feel" upgrade there is.

### A4. Stock screen
1. Product rows become cards with a left color strip: green = healthy stock, yellow = at threshold, red = below. Kills the need to read numbers to spot trouble.
2. Add/edit forms move into bottom sheets too (consistency with Sell), with proper labeled inputs: floating or top-aligned labels, `radius.md` input fields, visible focus state in primary color.
3. Sticky summary strip at top: "42 products · 5 low on stock" — the 5 in red if nonzero.

### A5. Reports screen
1. Today's revenue becomes a **hero card**: primary green background (both themes), white text, revenue huge, sales count + items sold as two small stats inside the same card. The one place color is spent loudly.
2. Other sections stay quiet cards. Top sellers get a thin horizontal bar behind each row showing relative qty (a plain `View` with proportional width — no chart library).
3. Recent sales rows expand/collapse with the existing `LinearTransition`.

### A6. System-level polish
1. A tiny **toast component** (Reanimated fade+slide, auto-dismiss 2s) replacing any `Alert.alert` used for non-blocking feedback ("Out of stock", "Product saved").
2. Empty states get a simple icon/emoji, one line of copy, and one action button — no walls of text.
3. Tab bar: active tab label in primary + a small dot indicator; inactive muted. Keep the standard bar — floating pill tab bars eat screen space shopkeepers need.

**Checkpoint A:** screenshots of all three screens in both themes look like a product, not a tutorial. Nothing has a hardcoded color; `grep -rn "#[0-9A-Fa-f]" src --include="*.js" | grep -v theme.js` returns nothing.

---

## Part B — Animation upgrade

Keep everything from Phase 6 of the original plan (press-scale, cart pulse, success pop, staggered entrances, count-up, theme cross-fade). Add:

1. **Bottom sheet physics**: the gorhom sheet's spring config tuned snappy (`damping` high enough that it never wobbles). The cart bar → sheet handoff should feel like one object.
2. **Card add feedback**: when a product is tapped, its yellow qty badge pops in with a spring scale (0 → 1.2 → 1) and the card flashes a 120ms border highlight in accent.
3. **Stock strip transitions**: when stock crosses a threshold after a sale, the row's color strip cross-fades to its new color rather than snapping.
4. **Hero card entrance**: Reports hero card fades+scales in (0.97 → 1) on focus, count-up starts after it lands (~150ms delay).
5. **Tab transitions**: screens fade in over ~150ms on tab switch (no sliding — slide transitions feel slow when switching often).
6. Same golden rules: everything ≤300ms, reduced-motion respected, and if it slows selling, delete it.

**Checkpoint B:** record a full sale on the slowest device available. Zero dropped frames during the sheet drag; if the sheet stutters, remove entrance staggers from the grid first.

---

## Part C — Push to GitHub

1. Verify `.gitignore` covers: `node_modules/`, `.expo/`, `dist/`, `*.log`, `.env*` (create-expo-app's default already does — confirm, don't assume).
2. This app is local-only with no secrets, but check anyway: `grep -rn "sk-\|API_KEY\|token" src/` should return nothing.
3. Initialize and commit:
   ```bash
   git init
   git add .
   git commit -m "ShopTally v1: offline-first POS + inventory for small shops"
   ```
4. Write a proper `README.md` — this repo is part of Raphael's portfolio, so it should sell:
   - One-line pitch + 3–4 screenshots (light and dark) in a table
   - Features list, stack, offline-first architecture note (SQLite, transactional sales)
   - Setup: clone → `npm install` → `npx expo start`
   - Roadmap section (cloud sync, receipts, Paystack) — shows product thinking
5. Create the repo and push (GitHub CLI is fastest):
   ```bash
   gh auth login
   gh repo create shoptally --public --source=. --push
   ```
   No `gh`? Create the repo empty on github.com, then `git remote add origin <url> && git push -u origin main`.
6. After pushing: add repo topics (`react-native`, `expo`, `sqlite`, `pos`, `offline-first`) — this is how hackathon organizers and recruiters find it.

**Checkpoint C:** open the repo URL in an incognito tab. Would a stranger understand what this is and how to run it in 30 seconds? If not, fix the README, not the code.

---

## Explicitly still out of scope
Lottie animations, custom fonts, splash video, onboarding carousel, charts library. All polish-for-polish's-sake — revisit only after the first paying client asks.
