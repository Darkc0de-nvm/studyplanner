'use strict';

/** Local calendar date of the machine running the seed, as YYYY-MM-DD. */
function localToday(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

module.exports = { localToday, addDays, clampToWeekEnd };
