'use strict';
const L = require('../logic.js');
let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log('PASS ' + name);
  } else {
    failures++;
    console.log('FAIL ' + name + '\n  expected: ' + e + '\n  actual:   ' + a);
  }
}

// --- parseDate ---
check('parseDate valid', L.parseDate('2023-01-15').getTime(), new Date(2023, 0, 15).getTime());
check('parseDate invalid month', L.parseDate('2023-13-01'), null);
check('parseDate invalid day', L.parseDate('2023-02-30'), null);
check('parseDate garbage', L.parseDate('abc'), null);
check('parseDate empty', L.parseDate(''), null);

// --- monthIndex / formatMonthIndex ---
check('monthIndex', L.monthIndex(new Date(2023, 0, 15)), 2023 * 12 + 0);
check('formatMonthIndex sty 2023', L.formatMonthIndex(2023 * 12 + 0), 'sty 2023');
check('formatMonthIndex gru 2025', L.formatMonthIndex(2025 * 12 + 11), 'gru 2025');

// --- daysBetweenInclusive ---
check('days inclusive same day', L.daysBetweenInclusive(new Date(2023, 0, 1), new Date(2023, 0, 1)), 1);
check('days inclusive month', L.daysBetweenInclusive(new Date(2023, 0, 1), new Date(2023, 0, 31)), 31);

// --- worked months: month with 1 day counts as full month ---
check('one day -> one month', L.getWorkedMonths([{ start: '2023-01-01', end: '2023-01-01' }]).length, 1);

// --- 18 consecutive months OK, 19 exceeded ---
const r18 = L.evaluateContracts([{ start: '2023-01-01', end: '2024-06-30' }]);
check('18 months ok', [r18.ok, r18.exceeded, r18.totalMonths], [true, false, 18]);
const r19 = L.evaluateContracts([
  { start: '2023-01-01', end: '2024-06-30' },
  { start: '2024-07-01', end: '2024-07-31' }
]);
check('19 months exceeded', [r19.ok, r19.exceeded, r19.maxWindow.max], [false, true, 19]);

// --- rolling window: 24 months total but no 36-month window holds more than 12 ---
// 12 months in 2023 + 12 months in 2026: any 36-month window holds at most one chunk (12)
const rolling = L.evaluateContracts([
  { start: '2023-01-01', end: '2023-12-31' },
  { start: '2026-01-01', end: '2026-12-31' }
]);
check('rolling window total 24 but max window 12', [rolling.ok, rolling.totalMonths, rolling.maxWindow.max], [true, 24, 12]);

// kolins example: 6+6+6 = 18 within sty2023-gru2025 -> OK, total 18
const kolins = L.evaluateContracts([
  { start: '2023-01-01', end: '2023-06-30' },
  { start: '2023-09-01', end: '2024-02-29' },
  { start: '2024-05-01', end: '2024-10-31' }
]);
check('kolins example 18 in 36 OK', [kolins.ok, kolins.totalMonths, kolins.maxWindow.max], [true, 18, 18]);
// adding one more month (gru 2024) pushes window lip2023-cze2026? no: window sty2023-gru2025 would hold 19 -> exceeded
const kolinsPlus = L.evaluateContracts(kolins.workedMonths && [
  { start: '2023-01-01', end: '2023-06-30' },
  { start: '2023-09-01', end: '2024-02-29' },
  { start: '2024-05-01', end: '2024-10-31' },
  { start: '2024-12-01', end: '2024-12-31' }
]);
check('kolins +1 month exceeded', [kolinsPlus.ok, kolinsPlus.maxWindow.max], [false, 19]);

// --- overlap dedup ---
const overlap = L.evaluateContracts([
  { start: '2023-01-01', end: '2023-06-30' },
  { start: '2023-04-01', end: '2023-12-31' }
]);
check('overlap counted once', overlap.totalMonths, 12);
check('overlap warning present', overlap.warnings.length > 0, true);

// --- errors ---
const badOrder = L.evaluateContracts([{ start: '2024-01-10', end: '2024-01-01' }]);
check('start after end error', badOrder.errors.length, 1);
const empty = L.evaluateContracts([]);
check('no rows error', empty.errors.length, 1);
const badDate = L.evaluateContracts([{ start: '01.02.2023', end: '2023-03-03' }]);
check('bad format error', badDate.errors.length, 1);

// --- next possible start ---
// 18 months used ending gru 2024 (sty 2023 - gru 2024): window ending gru2024 holds 18.
// A new month in sty 2025: window lut2022-sty2025 holds 18 -> adding = 19 -> blocked.
// Earliest M where count([M-35..M]) <= 17: months drop out starting kwi 2025:
//   M=2025-04: window maj2022-kwi2025 holds sty-gru2023=12? wait months are 2023 only -> any window holding
//   all 12 holds 12 <= 17 -> first candidate sty2025: window [2022-02,2025-01] holds 12 -> 12+1=13 <=18 -> allowed!
const rNext = L.evaluateContracts([{ start: '2019-01-01', end: '2020-12-31' }]);
// current window (as of 2026-09) holds 0 -> remaining 18 -> no nextStart needed
check('no nextStart when capacity free', rNext.nextStartMi, null);
check('current window empty for old data', rNext.currentWindow.used, 0);

// 18 months used: sty 2023 - cze 2024; any new month in 2024-07..2025-12 lands inside
// the saturated window [2023-01..2025-12] (would be 19) -> first legal month = sty 2026
const months18 = L.getWorkedMonths([{ start: '2023-01-01', end: '2024-06-30' }]);
const todayMi = 2024 * 12 + 6;
check('nextPossibleStart after full window', L.nextPossibleStart(months18, todayMi), 2026 * 12 + 0);

// --- zastepstwo (continuous blocks) ---
const zast = L.evaluateContracts([
  { start: '2023-01-01', end: '2025-12-31' }
], { zastepstwo: true });
check('zastepstwo 36 months ok', [zast.ok, zast.zastepstwo.blocks.length, zast.zastepstwo.violated], [true, 1, false]);
const zastBad = L.evaluateContracts([
  { start: '2023-01-01', end: '2026-01-31' }
], { zastepstwo: true });
check('zastepstwo 37 months violated', [zastBad.ok, zastBad.zastepstwo.blocks[0].months], [false, 37]);
const zastGap = L.evaluateContracts([
  { start: '2023-01-01', end: '2023-06-30' },
  { start: '2023-08-01', end: '2024-06-30' }
], { zastepstwo: true });
check('zastepstwo gap splits blocks', zastGap.zastepstwo.blocks.length, 2);

// --- mergeMonthRanges ---
check('merge ranges', L.mergeMonthRanges([2023 * 12, 2023 * 12 + 1, 2023 * 12 + 5]), [
  { from: 2023 * 12, to: 2023 * 12 + 1, count: 2 },
  { from: 2023 * 12 + 5, to: 2023 * 12 + 5, count: 1 }
]);

// --- getContinuousBlocks ---
check('blocks touching merge', L.getContinuousBlocks([
  { start: '2023-01-01', end: '2023-06-30' },
  { start: '2023-07-01', end: '2023-12-31' }
]).length, 1);

if (failures) {
  console.log('\n' + failures + ' test(s) FAILED');
  process.exit(1);
} else {
  console.log('\nAll tests passed');
}
