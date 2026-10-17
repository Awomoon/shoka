# Shoka — what it looks like, and how the UI is built

**Shoka** is an offline-first point-of-sale and inventory app for small Nigerian shops, built with Expo (React Native) by Moontech. It runs on everyday Android phones and records a sale in under 5 seconds while the customer waits. This document walks through what the app looks like screen by screen, and the design system behind it.

> Try it: download the APK from [awomoon.github.io/shoka](https://awomoon.github.io/shoka/) — the landing page also has an animated mockup of the Sell screen.

---

## The look in one paragraph

Shoka looks like a **chalk-white shop ledger with a deep-green spine and a flash of danfo yellow**. Deep green (`#0B5D3B`) is the brand and the money color; yellow (`#F5B700`) is the accent that marks quantities, alerts and calls to action; everything sits on a warm off-white (`#FAF8F4`) with white cards floating on soft shadows. Nothing is square — every surface is rounded. Big bold naira amounts are the heroes of every screen; everything else stays quiet so the money reads first.

---

## Screen by screen

### Sell (home tab)
The counter screen. A slim greeting header (the shop's own name once set, e.g. *"DebbyRR Stores"*, with today's date under it), a pill-shaped search bar, then a grid of product cards — 2 columns on narrow phones, 3 when there's room. Each card: product name, the price in big bold green, and a muted "48 left" line that turns red when stock is out or low. Tapping a card adds it to the cart — the card's border flashes yellow for 120 ms and a round yellow badge with the quantity pops onto the card's corner. A green cart bar slides up from the bottom ("3 items ▸ ₦1,950" with the total in yellow); tapping it opens a bottom sheet with the cart: quantity steppers, tap-the-price to haggle (per-sale price edit), swipe-down to dismiss, and a full-width green **Complete Sale** button. Success is a "ka-ching" moment: a dark overlay with a green circle, a white checkmark, the amount, and a "Send receipt" button.

### Stock (middle tab)
A vertical list of product rows, low-stock items sorted to the top. Each row carries a **colored strip on its left edge** — green (healthy), yellow (at the low-stock threshold), red (below it) — that cross-fades when a sale changes it. A stock-count badge sits on the right. "+ Add" in the header and tapping any row open bottom-sheet forms (add / edit / restock / remove) with focus-highlighted inputs and plain-language validation ("Price must be more than ₦0.").

### Reports (right tab)
The one place color is spent loudly: a **solid green hero card** where today's revenue *counts up* from zero when you open the screen, with sales/items counts and an "Owed to you" line in yellow when credit is outstanding. Below it: a share button (one tap sends the day's summary to WhatsApp), the week's figures, outstanding **credits grouped by customer** with "Mark as paid" pills, a restock list with red badges, top sellers with a quiet green bar behind each row showing relative quantity, and recent sales — expandable, with voided sales kept visible but greyed and struck through, and credit sales chipped in yellow until paid.

### Settings, Welcome, Recovery
Settings is a stack of labelled cards: shop profile, backup & restore, **reminders** (two switches: an 8:00 pm end-of-day summary nudge and low-stock alerts), theme toggle (System / Light / Dark), and an About card with the tally-mark logo drawn in theme colors. First launch shows a one-screen welcome (storefront icon in a tinted circle, shop-name field, "Start selling"). If the database ever fails to open, a recovery screen with restore-from-backup appears instead of a white screen.

---

## The design system

All of this flows from **one token file** — [src/theme.ts](src/theme.ts). The rule: *no component ever hardcodes a color.*

### Color
| Token | Light | Dark | Used for |
|---|---|---|---|
| `primary` | `#0B5D3B` deep green | `#2E9E6B` lightened green | money, buttons, brand |
| `accent` | `#F5B700` danfo yellow | same | badges, alerts, CTAs |
| `background` | `#FAF8F4` warm chalk | `#121212` | screens |
| `card` / `raised` | white | `#1E1E1E` / `#262626` | surfaces |
| `danger` | `#C62828` | `#EF5350` | out-of-stock, void, errors |

Dark mode doesn't just invert: greens are **lightened** (dark green vanishes on dark backgrounds) and surfaces are raised **by color step instead of shadow** — shadows are invisible on dark screens, so elevation is expressed as a lighter grey. Theme follows the system by default, switchable in Settings, with a 200 ms cross-fade when it changes.

### Shape, depth, type, touch
- **Radius**: 10 / 16 / 20 / pill. Nothing square-cornered remains except full-width dividers.
- **Elevation**: light mode floats cards on a soft shadow (7% black, 12 px blur); dark mode uses the `raised` color step.
- **Type scale**: price numbers are the hero — `hero` 34, `price` 26 down to `label` 13. Screens under 360 dp step hero numbers down one size so long naira amounts never clip; amounts also auto-shrink (`adjustsFontSizeToFit`) rather than truncate.
- **Touch**: 56 dp minimum targets, 64 dp for primary buttons — built for busy counters and all thumb sizes.
- **Naira-native**: whole-number `₦` prices with thousands separators everywhere, from one formatter.

### Motion language
One easing everywhere — `Easing.out(cubic)` via Reanimated — and **no springs**: nothing overshoots or bounces. The grammar:
- Every pressable scales to 0.97 on press (a shared `PressableScale` component).
- Lists stagger in with 40 ms fade delays, capped at 8 items.
- Value changes *dip* (opacity 1 → 0.4 → 1 over 150 ms) instead of jumping — the cart total, quantity badges.
- One hero animation per screen: the Reports revenue count-up.
- Bottom sheets open on a 250 ms timing curve — and deliberately ignore reduced-motion, because opening the cart is functional, not decorative.
- Everything decorative is skipped when the OS requests reduced motion (common on budget Androids with animations off).

### Feedback
Haptics mark the beats: a light tick on every cart add and tab switch, a success buzz when a sale records. Toasts are quiet pill overlays; destructive actions (void, restore, remove) always confirm in plain language that says what will happen to the user's money and stock.

### Iconography
- The **brand mark is a tally** — four bars crossed by a yellow slash, the universal "I'm counting" gesture. It appears in the app icon, the About card (drawn live in theme colors), and as section markers on the landing page.
- In-app icons are **Ionicons** (`@expo/vector-icons`) — outline variants normally, filled when a tab is active — replacing the emoji used in earlier versions, which rendered differently on every Android OEM font. Vector icons stay crisp at any density and take theme colors.

---

## How it's put together

- **Stack**: Expo SDK 57 + TypeScript (strict), expo-sqlite (offline-first, no server), React Navigation bottom tabs, Reanimated 4 for motion, @gorhom/bottom-sheet for the cart and forms, expo-notifications for the local reminders.
- **Token-first styling**: components read `useTheme()` and the scales from [src/theme.ts](src/theme.ts); styles live in `StyleSheet.create` beside each screen.
- **Shared primitives** in [src/components/](src/components/): `PressableScale` (the one press feedback), `ScreenHeader`/`GreetingHeader`, `EmptyState` (every empty state offers a next action), `SuccessOverlay`, `Toast`, and the sale dialogs (quantity pad, price editor, credit prompt).
- **Screens** in [src/screens/](src/screens/) — Sell, Inventory, Reports, Settings, plus Welcome and Recovery.
- The **marketing site** ([landing/](landing/)) mirrors the same brand: Next.js + Tailwind, same green/yellow/chalk palette, the tally motif as section markers, and a CSS-only animated phone that plays a sale on loop.

*Screenshots are coming after the next on-device pass — until then, the landing page's animated mockups are a faithful preview of the Sell and Reports screens.*
