(function (global) {
  'use strict';

  var LIMIT_MONTHS = 18;
  var WINDOW_MONTHS = 36;
  var ZASTEPOSTWO_MAX_MONTHS = 36;
  var PL_MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

  function monthIndex(date) {
    return date.getFullYear() * 12 + date.getMonth();
  }

  function parseDate(str) {
    if (!str) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str).trim());
    if (!m) return null;
    var y = parseInt(m[1], 10);
    var mo = parseInt(m[2], 10);
    var d = parseInt(m[3], 10);
    var date = new Date(y, mo - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
    return date;
  }

  function formatMonthIndex(mi) {
    var y = Math.floor(mi / 12);
    var mo = ((mi % 12) + 12) % 12;
    return PL_MONTHS[mo] + ' ' + y;
  }

  function daysBetweenInclusive(start, end) {
    return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  }

  function getWorkedMonths(rows) {
    var set = {};
    var months = [];
    rows.forEach(function (row) {
      var s = parseDate(row.start);
      var e = parseDate(row.end);
      if (!s || !e || s > e) return;
      for (var mi = monthIndex(s); mi <= monthIndex(e); mi++) {
        if (!set[mi]) {
          set[mi] = true;
          months.push(mi);
        }
      }
    });
    months.sort(function (a, b) { return a - b; });
    return months;
  }

  function countMonthsInWindow(months, windowStart) {
    var windowEnd = windowStart + WINDOW_MONTHS - 1;
    var count = 0;
    for (var i = 0; i < months.length; i++) {
      if (months[i] >= windowStart && months[i] <= windowEnd) count++;
    }
    return count;
  }

  function maxWindowUsage(months) {
    if (!months.length) return { max: 0, startMi: null, endMi: null };
    var best = 0;
    var bestStart = months[0];
    for (var i = 0; i < months.length; i++) {
      var count = countMonthsInWindow(months, months[i]);
      if (count > best) {
        best = count;
        bestStart = months[i];
      }
    }
    return { max: best, startMi: bestStart, endMi: bestStart + WINDOW_MONTHS - 1 };
  }

  function addMonthSorted(months, mi) {
    var copy = months.slice();
    var i = 0;
    while (i < copy.length && copy[i] < mi) i++;
    if (copy[i] !== mi) copy.splice(i, 0, mi);
    return copy;
  }

  function nextPossibleStart(months, todayMi, capMonths) {
    var cap = capMonths || 120;
    var candidate = todayMi;
    for (var k = 0; k <= cap; k++, candidate++) {
      if (months.indexOf(candidate) !== -1) continue;
      if (maxWindowUsage(addMonthSorted(months, candidate)).max <= LIMIT_MONTHS) {
        return candidate;
      }
    }
    return null;
  }

  function mergeMonthRanges(months) {
    var ranges = [];
    months.forEach(function (mi) {
      var last = ranges[ranges.length - 1];
      if (last && mi === last.to + 1) {
        last.to = mi;
        last.count++;
      } else {
        ranges.push({ from: mi, to: mi, count: 1 });
      }
    });
    return ranges;
  }

  function getContinuousBlocks(rows) {
    var valid = rows
      .map(function (row) {
        var s = parseDate(row.start);
        var e = parseDate(row.end);
        return s && e && s <= e ? { start: s, end: e } : null;
      })
      .filter(Boolean)
      .sort(function (a, b) { return a.start - b.start; });

    var blocks = [];
    valid.forEach(function (period) {
      var last = blocks[blocks.length - 1];
      if (last) {
        var dayAfterLastEnd = new Date(last.end.getTime() + 86400000);
        if (period.start <= dayAfterLastEnd) {
          if (period.end > last.end) last.end = period.end;
          last.periods.push(period);
          return;
        }
      }
      blocks.push({ start: period.start, end: period.end, periods: [period] });
    });

    blocks.forEach(function (block) {
      block.months = getWorkedMonths(block.periods.map(function (p) {
        return { start: formatDate(p.start), end: formatDate(p.end) };
      })).length;
      block.violated = block.months > ZASTEPOSTWO_MAX_MONTHS;
    });
    return blocks;
  }

  function formatDate(date) {
    var mm = String(date.getMonth() + 1).padStart(2, '0');
    var dd = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + mm + '-' + dd;
  }

  function hasOverlaps(rows) {
    var valid = rows
      .map(function (row) {
        var s = parseDate(row.start);
        var e = parseDate(row.end);
        return s && e && s <= e ? { start: s, end: e } : null;
      })
      .filter(Boolean);
    for (var i = 0; i < valid.length; i++) {
      for (var j = i + 1; j < valid.length; j++) {
        if (valid[i].start <= valid[j].end && valid[j].start <= valid[i].end) return true;
      }
    }
    return false;
  }

  function evaluateContracts(rows, options) {
    var opts = options || {};
    var result = {
      ok: true,
      errors: [],
      warnings: [],
      totalMonths: 0,
      currentWindow: null,
      maxWindow: { max: 0, startMi: null, endMi: null },
      exceeded: false,
      nextStartMi: null,
      ranges: [],
      zastepstwo: null
    };

    if (!rows.length) {
      result.errors.push('Brak okresów do obliczenia — dodaj przynajmniej jeden okres.');
      result.ok = false;
      return result;
    }

    rows.forEach(function (row, idx) {
      var s = parseDate(row.start);
      var e = parseDate(row.end);
      if (!s || !e) {
        result.errors.push('Wiersz ' + (idx + 1) + ': brak lub nieprawidłowy format dat (oczekiwano RRRR-MM-DD).');
      } else if (s > e) {
        result.errors.push('Wiersz ' + (idx + 1) + ': data rozpoczęcia jest późniejsza niż data zakończenia.');
      }
    });

    if (result.errors.length) {
      result.ok = false;
      return result;
    }

    if (hasOverlaps(rows)) {
      result.warnings.push('Wykryto nakładające się okresy — miesiące kalendarzowe liczone są bez dublowania.');
    }

    var months = getWorkedMonths(rows);
    result.workedMonths = months;
    result.totalMonths = months.length;
    result.ranges = mergeMonthRanges(months);
    result.maxWindow = maxWindowUsage(months);

    var nowMi = monthIndex(new Date());
    var currentStart = nowMi - WINDOW_MONTHS + 1;
    var usedCurrent = countMonthsInWindow(months, currentStart);
    result.currentWindow = {
      startMi: currentStart,
      endMi: nowMi,
      used: usedCurrent,
      remaining: LIMIT_MONTHS - usedCurrent
    };

    if (opts.zastepstwo) {
      var blocks = getContinuousBlocks(rows);
      var violated = blocks.some(function (b) { return b.violated; });
      result.zastepstwo = { blocks: blocks, violated: violated };
      result.exceeded = violated;
    } else {
      result.exceeded = result.maxWindow.max > LIMIT_MONTHS;
      if (result.currentWindow.remaining <= 0) {
        result.nextStartMi = nextPossibleStart(months, nowMi);
      }
    }

    result.ok = !result.exceeded;
    return result;
  }

  var api = {
    LIMIT_MONTHS: LIMIT_MONTHS,
    WINDOW_MONTHS: WINDOW_MONTHS,
    ZASTEPOSTWO_MAX_MONTHS: ZASTEPOSTWO_MAX_MONTHS,
    monthIndex: monthIndex,
    parseDate: parseDate,
    formatDate: formatDate,
    formatMonthIndex: formatMonthIndex,
    daysBetweenInclusive: daysBetweenInclusive,
    getWorkedMonths: getWorkedMonths,
    countMonthsInWindow: countMonthsInWindow,
    maxWindowUsage: maxWindowUsage,
    nextPossibleStart: nextPossibleStart,
    mergeMonthRanges: mergeMonthRanges,
    getContinuousBlocks: getContinuousBlocks,
    evaluateContracts: evaluateContracts
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.LimitLogic = api;
  }
})(typeof window !== 'undefined' ? window : this);
