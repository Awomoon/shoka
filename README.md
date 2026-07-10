# ShopTally

**Offline-first point-of-sale and inventory tracker for small shops — record a sale in under 5 seconds while the customer waits.**

Built for small Nigerian shops running on cheap Android phones with unreliable internet. No account, no backend, no network needed: everything lives in SQLite on the device.

> 📸 Screenshots (light + dark) coming after the first on-device pass — drop them in `docs/screenshots/`.

## Features

- ⚡ **Fast selling** — tap product cards to build a cart, drag up the bottom sheet, complete the sale. Haptic feedback on every add, spring animations under 300ms so nothing ever feels like waiting.
- 📦 **Inventory with visual alerts** — every product card carries a color strip: green (healthy), yellow (at the low-stock threshold), red (below it). Restock and edit from bottom-sheet forms.
- 📊 **Reports that answer the shopkeeper's real questions** — today's money (hero card with count-up), this week, top sellers with relative-quantity bars, a ready-made restock list, and expandable recent sales.
- 🌗 **Light / dark / system themes** — every color flows from a single token file; dark mode raises surfaces by color step instead of shadows so it stays readable on cheap screens.
- 🇳🇬 **Naira-native** — whole-number ₦ prices with thousands separators throughout.
- ♿ **Reduced-motion aware** — decorative animations are skipped when the OS asks.

## Stack

- [Expo](https://expo.dev) SDK 57 (React Native 0.86), plain JavaScript
- [expo-sqlite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/) — WAL mode, all DB access behind one module
- [Reanimated 4](https://docs.swmansion.com/react-native-reanimated/) + [@gorhom/bottom-sheet](https://gorhom.dev/react-native-bottom-sheet/) for gestures and motion
- React Navigation bottom tabs, AsyncStorage for the theme choice

## Offline-first architecture

There is no server. All state is in a local SQLite database (`src/db/database.js` is the only module that touches it):

- **Transactional sales** — recording a sale inserts the sale, its line items, and decrements each product's stock inside a single transaction. If any product would go below zero stock, the whole sale rolls back with a plain-language error.
- **Soft deletes** — products are deactivated, never deleted, so past sales always render their line items even after a product is renamed or removed.
- **Denormalized history** — sale items store the product name and unit price at the time of sale.

## Run it

```bash
git clone https://github.com/Awomoon/shoptally.git
cd shoptally
npm install
npx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/go) on an Android phone (or run an emulator). To build an installable APK:

```bash
eas build -p android --profile preview
```

## Roadmap

- ☁️ Cloud backup & multi-device sync
- 🧾 Receipts (share as image / print)
- 👥 Staff accounts with sales-only access
- 💳 Paystack integration for card/transfer payments
- 📷 Barcode scanning for faster product lookup

## License

[MIT](LICENSE)
