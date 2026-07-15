import type { SaleWithItems } from '../db/database';
import { formatNaira, formatSaleTime } from './format';

// Plain-text receipt for the native share sheet — WhatsApp-friendly.
export function buildReceiptText(shopName: string | null, sale: SaleWithItems): string {
  const lines = sale.items.map(
    (it) => `${it.qty} × ${it.product_name} — ${formatNaira(it.unit_price * it.qty)}`
  );
  const status =
    sale.is_credit === 1
      ? sale.paid_at
        ? `CREDIT — ${sale.customer_name ?? ''} (settled)`
        : `CREDIT — ${sale.customer_name ?? ''}`
      : 'PAID';
  return [
    `🧾 ${shopName || 'Shoka'}`,
    formatSaleTime(sale.created_at),
    ...lines,
    `Total: ${formatNaira(sale.total)}`,
    status,
    'via Shoka by Moontech',
  ].join('\n');
}

// SQLite-style local timestamp ('YYYY-MM-DD HH:MM:SS') for receipts built
// on-device right after a sale, before re-reading from the database.
export function nowSqlite(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}
