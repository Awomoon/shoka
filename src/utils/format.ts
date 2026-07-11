// All money in the app is naira as whole numbers.
export function formatNaira(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  const sign = n < 0 ? '-' : '';
  const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₦${sign}${digits}`;
}

// SQLite gives us 'YYYY-MM-DD HH:MM:SS' in local time.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatSaleTime(createdAt: string): string {
  const [datePart, timePart] = String(createdAt || '').split(' ');
  if (!datePart || !timePart) return String(createdAt || '');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const now = new Date();
  const isToday = now.getFullYear() === y && now.getMonth() + 1 === m && now.getDate() === d;
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const ampm = hh < 12 ? 'AM' : 'PM';
  const time = `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
  return isToday ? `Today, ${time}` : `${d} ${MONTHS[m - 1]}, ${time}`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Sell-screen greeting row: "Good morning" / "Thursday, 10 July".
export function getGreeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatTodayLong(date: Date = new Date()): string {
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS_FULL[date.getMonth()]}`;
}

// Human date-time for ISO timestamps (e.g. the last-backup line):
// "10 Jul 2026, 4:15 PM".
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = d.getHours();
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const ampm = hh < 12 ? 'AM' : 'PM';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${h12}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}

export function parseIntSafe(text: string | null | undefined): number | null {
  const digits = String(text ?? '').replace(/[^0-9]/g, '');
  if (digits === '') return null;
  const n = parseInt(digits, 10);
  return Number.isNaN(n) ? null : n;
}
