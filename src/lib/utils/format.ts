/**
 * Formats a number to Vietnamese Dong currency format:
 * e.g., 150000 -> "150.000đ", 1020000 -> "1.020.000đ"
 */
export function formatVND(amount: number): string {
  if (isNaN(amount)) return '0đ';
  const formatted = new Intl.NumberFormat('vi-VN').format(amount);
  return `${formatted}đ`;
}

/**
 * Format date string to Vietnamese display
 * e.g., "08/10/2026 09:30"
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}`;
  } catch {
    return dateString;
  }
}

/**
 * Convert a stored ISO timestamp into the local wall-clock value expected by
 * <input type="datetime-local">. Slicing a UTC ISO string directly shifts time outside UTC.
 */
export function toDateTimeLocalInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function formatDateShort(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  } catch {
    return dateString;
  }
}
