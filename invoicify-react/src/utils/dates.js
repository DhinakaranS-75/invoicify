// Returns [startDate, endDate] for a given period key.
export function getPeriodBounds(period) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  // Indian fiscal year: April 1 -> March 31
  const fyStartYear = m >= 3 ? y : y - 1;

  switch (period) {
    case 'fy_current':
      return [new Date(fyStartYear, 3, 1), new Date(fyStartYear + 1, 2, 31, 23, 59, 59)];
    case 'fy_previous':
      return [new Date(fyStartYear - 1, 3, 1), new Date(fyStartYear, 2, 31, 23, 59, 59)];
    case 'last12':
      return [new Date(y, m - 11, 1), new Date(y, m + 1, 0, 23, 59, 59)];
    case 'last6':
      return [new Date(y, m - 5, 1), new Date(y, m + 1, 0, 23, 59, 59)];
    case 'last3':
      return [new Date(y, m - 2, 1), new Date(y, m + 1, 0, 23, 59, 59)];
    default:
      return [new Date(fyStartYear, 3, 1), new Date(fyStartYear + 1, 2, 31, 23, 59, 59)];
  }
}

// Builds an array of month buckets between two dates: [{ label, year, month, key }]
export function monthBuckets(start, end) {
  const buckets = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  while (cur <= end) {
    buckets.push({
      label: `${monthNames[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`,
      year: cur.getFullYear(),
      month: cur.getMonth(),
      key: `${cur.getFullYear()}-${cur.getMonth()}`
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return buckets;
}

export function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  return d >= start && d <= end;
}

// Report period bounds (calendar based)
export function getReportBounds(period) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fyStartYear = m >= 3 ? y : y - 1;
  switch (period) {
    case 'this_month':
      return [new Date(y, m, 1), new Date(y, m + 1, 0, 23, 59, 59)];
    case 'last_month':
      return [new Date(y, m - 1, 1), new Date(y, m, 0, 23, 59, 59)];
    case 'this_quarter': {
      const q = Math.floor(m / 3);
      return [new Date(y, q * 3, 1), new Date(y, q * 3 + 3, 0, 23, 59, 59)];
    }
    case 'this_fy':
      return [new Date(fyStartYear, 3, 1), new Date(fyStartYear + 1, 2, 31, 23, 59, 59)];
    case 'all':
    default:
      return [new Date(2000, 0, 1), new Date(2100, 0, 1)];
  }
}
