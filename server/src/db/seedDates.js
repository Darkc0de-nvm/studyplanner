'use strict';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local calendar date of the machine running the seed, as YYYY-MM-DD. */
function localToday(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Resolves the base date used by the demo seed.
 * Accepts YYYY-MM-DD and rejects impossible calendar dates so the seeded
 * deadlines cannot silently roll over into another month.
 */
function resolveBaseDate(value, now = new Date()) {
  if (value === undefined || value === null || value === '') return localToday(now);
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    throw new Error('SEED_BASE_DATE must use the YYYY-MM-DD format.');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('SEED_BASE_DATE must be a valid calendar date.');
  }
  return value;
}

/** Adds calendar days in UTC so DST and local offsets cannot shift the result. */
function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Clamps a date to the Sunday that ends its Monday-based week (UTC). */
function clampToWeekEnd(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  if (day === 0) return isoDate;
  return addDays(isoDate, 7 - day);
}

module.exports = { localToday, resolveBaseDate, addDays, clampToWeekEnd };
