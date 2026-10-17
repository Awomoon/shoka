# Shoka

**Offline-first point-of-sale and inventory tracker for small shops — record a sale in under 5 seconds while the customer waits.**

Built for small Nigerian shops running on cheap Android phones with unreliable internet. No account, no backend, no network needed: everything lives in SQLite on the device.

> 📸 Screenshots (light + dark) coming after the first on-device pass — drop them in `landing/public/screenshots/` (they ship into `docs/` on the next landing build).

## Features

- ⚡ **Fast selling** — tap product cards to build a cart, drag up the bottom sheet, complete the sale. Haptic feedback on every add, smooth sub-300ms animations so nothing ever feels like waiting.
- 📦 **Inventory with visual alerts** — every product card carries a color strip: green (healthy), yellow (at the low-stock threshold), red (below it). Restock and edit from bottom-sheet forms with fat-finger guards on absurd values.
- 📊 **Reports that answer the shopkeeper's real questions** — today's money (hero card with count-up), this week, top sellers with relative-quantity bars, a ready-made restock list, and expandable recent sales.
- 💾 **Backup & restore** *(new in 1.5)* — export the whole business record as a single JSON file to WhatsApp/email via the native share sheet; restore validates the file fully before touching the database and swaps data in one transaction. Reports nudges gently when the last backup is over a week old.
- ↩️ **Void a sale** *(new in 1.5)* — mistakes at the counter aren't permanent: voiding restores stock in one transaction and removes the sale from every total, while keeping it visible (greyed, VOIDED) in history.
- 📤 **WhatsApp daily summary** *(new in 1.5)* — one tap composes the day's figures (sales, transactions, items, top item, low-stock list) as plain text for the native share sheet.
- 🏪 **Shop profile & first-run welcome** *(new in 1.5)* — the shop's name greets the owner on the Sell screen and signs the shared summaries; a database that fails to open shows a recovery screen with restore-from-backup instead of a white screen.
- 🔔 **Reminders & low-stock notifications** *(new in 1.7)* — an optional 8:00 pm reminder to check today's money and share the summary, and a tray alert the moment a sale leaves an item at its low-stock level. All local notifications — no server, works offline like everything else.
- 🏁 **Counter-speed UX** *(new in 1.8)* — bestsellers float to the top of the Sell grid automatically; checkout is a branded in-sheet confirm step (one big "Paid" button, credit one tap away); undo for cart removals; tap a stock badge to quick-restock; search + low-stock filter on Stock; tab badges for low stock and outstanding credit; one-tap WhatsApp credit reminders; "Add ⟨search⟩" when a product isn't found.
- 🌗 **Light / dark / system themes** — every color flows from a single token file; dark mode raises surfaces by color step instead of shadows so it stays readable on cheap screens.
- 🇳🇬 **Naira-native** — whole-number ₦ prices with thousands separators throughout.
- ♿ **Reduced-motion aware** — decorative animations are skipped when the OS asks.

## Stack

- [Expo](https://expo.dev) SDK 57 (React Native 0.86), plain JavaScript
- [expo-sqlite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/) — WAL mode, all DB access behind one module
- [Reanimated 4](https://docs.swmansion.com/react-native-reanimated/) + [@gorhom/bottom-sheet](https://gorhom.dev/react-native-bottom-sheet/) for gestures and motion
- React Navigation bottom tabs, AsyncStorage for the theme choice
- [expo-notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/) for local reminders/alerts, [@expo/vector-icons](https://docs.expo.dev/guides/icons/) (Ionicons) for crisp themed icons

## Offline-first architecture

There is no server. All state is in a local SQLite database (`src/db/database.js` is the only module that touches it):

- **Transactional sales** — recording a sale inserts the sale, its line items, and decrements each product's stock inside a single transaction. If any product would go below zero stock, the whole sale rolls back with a plain-language error.
- **Soft deletes** — products are deactivated, never deleted, so past sales always render their line items even after a product is renamed or removed.
- **Denormalized history** — sale items store the product name and unit price at the time of sale.

## Run it

```bash
git clone https://github.com/Awomoon/shoka.git
cd shoka
npm install
npx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/go) on an Android phone (or run an emulator). To build an installable APK:

```bash
eas build -p android --profile preview
```

## Landing page

The marketing site at [awomoon.github.io/shoka](https://awomoon.github.io/shoka/) is a Next.js + TypeScript + Tailwind app in [`landing/`](landing/). GitHub Pages serves the static export from `docs/` — never edit `docs/` by hand.

```bash
cd landing
npm install
npm run dev        # local preview at http://localhost:3000/shoka
npm run build:docs # static-export into ../docs for GitHub Pages
```

## Roadmap

- ☁️ Cloud backup & multi-device sync
- 🧾 Receipts (share as image / print)
- 👥 Staff accounts with sales-only access
- 💳 Paystack integration for card/transfer payments
- 📷 Barcode scanning for faster product lookup

## License

[MIT](LICENSE)

---

Built by **Moontech** · Oyo State, Nigeria · WhatsApp +234 706 836 7213
