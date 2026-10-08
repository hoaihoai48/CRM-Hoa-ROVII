import { Timestamp } from 'firebase/firestore';

/**
 * Normalizes any timestamp representation (Firestore Timestamp, Date, string, number)
 * into a standard ISO 8601 string (e.g. 2026-10-08T15:30:00.000Z).
 * Ensures UI never receives raw { seconds, nanoseconds } objects.
 */
export function normalizeIsoString(val: unknown, fallback?: string): string {
  if (!val) {
    return fallback || new Date().toISOString();
  }

  if (typeof val === 'string') {
    return val;
  }

  if (val instanceof Date) {
    return val.toISOString();
  }

  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }

  if (typeof val === 'object' && val !== null && 'seconds' in val && typeof (val as { seconds: number }).seconds === 'number') {
    const sec = (val as { seconds: number }).seconds;
    const nanosec = 'nanoseconds' in val && typeof (val as { nanoseconds: number }).nanoseconds === 'number'
      ? (val as { nanoseconds: number }).nanoseconds
      : 0;
    return new Date(sec * 1000 + nanosec / 1000000).toISOString();
  }

  if (typeof val === 'number') {
    return new Date(val).toISOString();
  }

  return fallback || new Date().toISOString();
}
