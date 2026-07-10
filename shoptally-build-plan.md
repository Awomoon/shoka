# ShopTally — Build Plan for Claude Code

Offline-first inventory + sales tracker for small Nigerian shops.
Stack: **Expo (React Native) + expo-sqlite. No backend in v1.** Plain JavaScript.

Target device: cheap Android phones. Big touch targets, high contrast, works with zero internet.

---

## How to use this document

Work through the phases **in order**. Each phase ends with a checkpoint — run the app and verify the checkpoint before moving on. Do not start a later phase until the current checkpoint passes.

---

## Phase 0 — Project setup

1. Create the project:
   ```bash
   npx create-expo-app shoptally --template blank
   cd shoptally
   ```
2. Install dependencies (use `npx expo install` so versions match the SDK):
   ```bash
   npx expo install expo-sqlite react-native-screens react-native-safe-area-context
   npx expo install react-native-reanimated @react-native-async-storage/async-storage
   npm install @react-navigation/native @react-navigation/bottom-tabs
   ```
   Reanimated powers the animations; AsyncStorage remembers the dark-mode choice. Add the Reanimated Babel plugin if the current Expo SDK requires it (Claude Code: verify against current Expo docs).
3. Create this folder structure:
   ```
   src/
     db/database.js        # all SQLite logic lives here, nothing else touches the DB
     screens/SellScreen.js
     screens/InventoryScreen.js
     screens/ReportsScreen.js
     components/           # shared UI pieces
     theme.js              # colors, spacing, font sizes — single source of truth
   ```

**Checkpoint:** `npx expo start` boots the blank app on a phone via Expo Go.

---

## Phase 1 — Theme + navigation shell

1. `src/theme.js` exports **two palettes** plus shared tokens:
   - **Light**: primary deep green `#0B5D3B`, accent danfo-yellow `#F5B700`, danger `#C62828`, background `#FAF8F4`, text `#1A1A1A`, muted `#6B6B6B`, card `#FFFFFF`
   - **Dark**: primary green lightened to `#2E9E6B` (dark greens vanish on dark backgrounds), accent stays `#F5B700`, danger `#EF5350`, background `#121212`, card `#1E1E1E`, text `#F2F2F2`, muted `#9E9E9E`
   - Shared: `spacing` 4 / 8 / 12 / 16 / 24; price numbers are the hero — 28–36pt bold; body 16pt; labels 13pt; minimum 56pt touch targets
   - Rule for every component: **never hardcode a color** — always pull from the active theme.
2. **Theme system** in `src/theme/ThemeContext.js`:
   - React context providing `{ colors, mode, setMode }` to the whole app via a `useTheme()` hook
   - Three modes: `light`, `dark`, `system` (default). `system` follows the phone via `useColorScheme()`.
   - Persist the choice in AsyncStorage; load it before first render so there's no wrong-theme flash.
   - Toggle UI: a small sun/moon button in the header of the Reports screen cycling System → Light → Dark, showing the current mode. Keep it out of the Sell screen — nothing on that screen should exist except selling.
   - Sync the navigation container and StatusBar with the active theme so headers and system bars match.
3. Bottom tab navigator with three tabs: **Sell** (default), **Stock**, **Reports**. Use simple text/emoji icons for now — no icon library setup.

**Checkpoint:** three empty screens, tab switching works, toggling dark mode flips every visible surface instantly, and the choice survives an app restart.

---

## Phase 2 — Database layer (do this before any screen logic)

All in `src/db/database.js`, using expo-sqlite's **async API** (`openDatabaseAsync`). Enable WAL mode.

### Schema

```sql
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,              -- naira, whole numbers
  stock_qty INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  is_active INTEGER NOT NULL DEFAULT 1, -- soft delete
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,          -- denormalized so history survives renames
  unit_price INTEGER NOT NULL,         -- price at time of sale
  qty INTEGER NOT NULL
);
```

### Functions to export

- `getDb()` — singleton, runs schema creation once
- `listProducts()` — active products, ordered by name
- `addProduct(name, price, stockQty, lowStockThreshold)`
- `updateProduct(id, fields)`
- `deactivateProduct(id)` — soft delete only, never hard delete (sales history references it)
- `adjustStock(id, delta)` — for restocking or corrections
- `recordSale(cartItems)` — **must run in a single transaction** (`withTransactionAsync`): insert sale, insert sale_items, decrement each product's stock. If any product would go below 0, roll back and throw a clear error.
- `getTodaySummary()` — total revenue, number of sales, items sold for today
- `getWeekSummary()` — same for last 7 days
- `getTopProducts(days)` — top 5 by qty sold
- `getRecentSales(limit)` — recent sales with their items
- `getLowStockProducts()` — where `stock_qty <= low_stock_threshold`

**Checkpoint:** write a temporary test call in `App.js` that adds a product, records a sale, and logs the summary. Verify stock decremented. Remove the test call after.

---

## Phase 3 — Sell screen (the money screen — most polish goes here)

This screen must let a shopkeeper record a sale in under 5 seconds while a customer waits.

1. **Product grid**: 2 columns of big cards (min 56pt tall). Each card shows name, price (big bold number), and remaining stock in small muted text. Tap = add 1 to cart. Card shows a qty badge when in cart.
2. **Search bar** at top — filters grid as you type (shops can have 100+ products).
3. **Cart bar** pinned to bottom: item count + running total in danfo-yellow, always visible once cart is non-empty. Tapping it opens a cart sheet where qty can be adjusted (+/−) or lines removed.
4. **Complete Sale** button (full-width, primary green, 64pt tall) inside the cart sheet. On press: call `recordSale`, show a brief success state ("Sale recorded — ₦4,500"), clear cart, refresh grid stock numbers.
5. Out-of-stock products: card greyed out, tap shows "Out of stock" toast instead of adding.
6. Format all money as `₦` + thousands separators (`₦12,500`). One shared `formatNaira()` helper.

**Checkpoint:** record 3 sales with multiple items. Stock numbers drop correctly. Attempting to sell more than available stock fails safely with a message.

---

## Phase 4 — Stock (inventory) screen

1. List of all active products: name, price, stock qty. Products at/below their low-stock threshold get a red qty badge and sort to the top.
2. **Add Product** button → modal form: name, price, starting stock, low-stock threshold (default 5). Validate: name required, price > 0, stock ≥ 0.
3. Tap a product → edit sheet: change name/price/threshold, **Restock** field (adds to current stock), and a "Remove product" action (calls `deactivateProduct`, with confirm dialog).
4. Keyboard type `numeric` for all number fields.

**Checkpoint:** add 10 realistic products (e.g., Indomie carton, Coke 50cl, Peak Milk, recharge card). Restock one. Deactivate one and confirm it disappears from Sell screen but old sales still show it in Reports.

---

## Phase 5 — Reports screen

1. **Today card**: revenue (hero number), sales count, items sold.
2. **This week card**: same three numbers.
3. **Low stock section**: list from `getLowStockProducts()` — this is the shopkeeper's restock shopping list.
4. **Top sellers**: top 5 products last 7 days with qty.
5. **Recent sales**: last 10 sales, each expandable to show line items.
6. Pull-to-refresh. Data must also refresh whenever the tab gains focus (`useFocusEffect`), otherwise numbers go stale after selling.

**Checkpoint:** numbers match the sales you recorded manually. Kill the app completely, reopen — all data still there (this proves offline persistence).

---

## Phase 6 — Animations (subtle, fast, never blocking)

Golden rule: every animation is **under 300ms** and never delays the shopkeeper. If an animation makes selling slower, cut it. Use Reanimated for all of these.

1. **Button press feedback** (biggest payoff, simplest to build): a shared `PressableScale` component that scales to 0.96 with a spring on press-in and back on release. Use it for product cards and all primary buttons.
2. **Cart bar entrance**: when the first item is added, the bottom cart bar slides up with a spring (`SlideInDown`). When the cart empties, it slides away. The running total does a quick scale "pulse" (1 → 1.15 → 1) each time an item is added — the tactile "ka-ching" moment.
3. **Sale success**: on Complete Sale, an overlay with a checkmark that pops in with a spring scale + fade, auto-dismisses after ~1.2s. This is the moment that sells the app in demos.
4. **List entrances**: products and report cards animate in with `FadeInDown` and a small per-item stagger (~40ms, cap the stagger at the first 10 items so long lists don't feel slow).
5. **Layout transitions**: wrap list items with Reanimated's `LinearTransition` so adding/removing products or cart lines smoothly reflows instead of snapping.
6. **Number roll on Reports**: today's revenue counts up from 0 to the total over ~600ms when the screen gains focus. One hero animation for the screen — leave the other numbers static.
7. **Theme cross-fade**: a simple ~200ms opacity transition when switching light/dark so the change feels smooth rather than jarring.
8. Respect reduced motion: check `AccessibilityInfo.isReduceMotionEnabled()` and skip decorative animations (staggers, pulses, count-ups) when it's on. Keep functional feedback like the success overlay, just without the spring.

**Checkpoint:** record a sale start-to-finish — it should feel snappier *with* animations than without. If anything feels like waiting, shorten or delete it.

---

## Phase 7 — Hardening (before showing any client)

1. Empty states with a next action: no products → "Add your first product" button on both Sell and Stock screens.
2. Wrap all DB calls in try/catch; failures show a plain-language message, never a crash.
3. Confirm dialog on Complete Sale if total is unusually large (> ₦500,000) — fat-finger protection.
4. App icon + splash screen (green background, "ShopTally" — configure in `app.json`).
5. Test on the smallest/cheapest Android you can borrow. Fix anything that requires precise tapping. Test **both themes** on that device — cheap screens crush dark greys, so verify text stays readable in dark mode.
6. Sweep for hardcoded colors: search the codebase for hex values outside `theme.js`; any found is a bug.

**Checkpoint:** hand the phone to someone non-technical and ask them to sell 2 items and add a product with no instructions. If they hesitate anywhere, that spot needs work.

---

## Phase 8 — Shipping a demo

1. Build an installable APK with EAS:
   ```bash
   npm install -g eas-cli
   eas login
   eas build -p android --profile preview
   ```
   (`preview` profile in `eas.json` produces an APK you can install directly — no Play Store needed for client demos.)
2. Install on your own phone. This APK on your phone *is* your sales pitch when you walk into shops.

---

## Explicitly OUT of scope for v1 (do not build yet)

- Cloud sync / backend / accounts — v2, after first paying client
- Multiple users or staff logins
- Receipts / printing
- Barcode scanning
- Expenses tracking
- Paystack integration

Every one of these is a future upsell. Ship the core first.

---

## Definition of done for v1

A shopkeeper can: add products → sell fast with a customer waiting → see today's money → know what to restock. Entirely offline. No crashes. That's the product.
