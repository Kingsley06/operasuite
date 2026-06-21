export function format(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function subDays(date, days) {
  return addDays(date, -days);
}

export function formatDisplay(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount);
}

export function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export function calcNights(checkIn, checkOut) {
  const a = new Date(checkIn + 'T00:00:00');
  const b = new Date(checkOut + 'T00:00:00');
  return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

export function todayStr() {
  return format(new Date());
}

export function isToday(dateStr) {
  return dateStr === todayStr();
}

export function isSoon(dateStr, hours = 24) {
  const d = daysUntil(dateStr);
  return d >= 0 && d <= 1;
}
