'use strict';
const { localToday, addDays, clampToWeekEnd } = require('../src/db/seedDates');

describe('seedDates', () => {
  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('clampToWeekEnd moves a date to its Sunday', () => {
    // 2026-11-06 is a Friday, 2026-11-08 is the Sunday that ends that week.
    expect(clampToWeekEnd('2026-11-06')).toBe('2026-11-08');
    expect(clampToWeekEnd('2026-11-09')).toBe('2026-11-15');
  });

  it('clampToWeekEnd is a no-op on Sunday', () => {
    expect(clampToWeekEnd('2026-11-08')).toBe('2026-11-08');
  });

  it('localToday returns the local calendar date', () => {
    const fixed = new Date(2026, 0, 2, 23, 30, 0); // local time, late evening
    expect(localToday(fixed)).toBe('2026-01-02');
  });
});
