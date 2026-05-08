/* =========================================================
   FINANCE UTILS / HELPERS
   ========================================================= */

function normalizeFinanceRow(row) {
  const obj = {};

  Object.keys(row || {}).forEach(function(key) {
    obj[key] = formatCellValue(row[key]);
  });

  return obj;
}

function generateNextBillingId() {
  return generateSafeId('BIL');
}

function generateNextBillingItemId() {
  return generateSafeId('BLI');
}

function generateNextBillingAdjustmentId() {
  return generateSafeId('BAD');
}

function generateNextPaymentId() {
  return generateSafeId('PAY');
}

function generateNextBillingInstallmentId() {
  return generateSafeId('INS');
}

function generateNextBillingFeedbackId() {
  return generateSafeId('FBK');
}

function getFinanceTodayYmd_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function financeExtractYmd_(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const s = String(value || '').trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  const d = new Date(s);
  if (isNaN(d.getTime())) return '';

  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function financeRequireDateOnlyYmd_(value) {
  const ymd = financeNormalizeDateOnlyYmd_(value);

  if (!ymd) {
    return '';
  }

  return ymd;
}

function financeNormalizeDateOnlyYmd_(value) {
  const ymd = financeExtractYmd_(value);

  if (ymd && isValidYmdDate(ymd)) {
    return ymd;
  }

  return '';
}

function financeIsDateBetweenYmd_(value, startYmd, endYmd) {
  const ymd = financeExtractYmd_(value);

  if (!ymd) return false;

  return ymd >= String(startYmd || '') && ymd <= String(endYmd || '');
}

function financeDateAddDays_(ymd, offsetDays) {
  const base = financeExtractYmd_(ymd) || getFinanceTodayYmd_();
  const parts = base.split('-');

  const date = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );

  date.setDate(date.getDate() + Number(offsetDays || 0));

  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function financeDateDiffDays_(startYmd, endYmd) {
  const start = financeExtractYmd_(startYmd);
  const end = financeExtractYmd_(endYmd);

  if (!start || !end) return 0;

  const sp = start.split('-');
  const ep = end.split('-');

  const sd = new Date(Number(sp[0]), Number(sp[1]) - 1, Number(sp[2]));
  const ed = new Date(Number(ep[0]), Number(ep[1]) - 1, Number(ep[2]));

  return Math.floor((ed.getTime() - sd.getTime()) / (24 * 60 * 60 * 1000));
}

function getFinanceDateRange(period) {
  const value = String(period || 'today').trim().toLowerCase();
  const today = getFinanceTodayYmd_();

  if (value === '7days') {
    return {
      start: financeDateAddDays_(today, -6),
      end: today
    };
  }

  if (value === '30days') {
    return {
      start: financeDateAddDays_(today, -29),
      end: today
    };
  }

  return {
    start: today,
    end: today
  };
}

function isFinanceManagerRole(actorRole) {
  const role = String(actorRole || '').trim().toLowerCase();
  return role === 'admin' || role === 'owner';
}

function isValidFinanceEmail_(email) {
  const value = String(email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function financeFormatCurrencyText_(value) {
  const num = Number(value || 0);
  return 'Rp ' + num.toLocaleString('id-ID');
}

function financeFormatDateText_(value) {
  const ymd = financeExtractYmd_(value);

  if (!ymd) return '-';

  const parts = ymd.split('-');
  return parts[2] + '-' + parts[1] + '-' + parts[0];
}

function escapeFinanceInvoiceHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* =========================================================
   H7 - FINANCE AMOUNT / CALCULATION HELPERS
   ========================================================= */

function financeToAmount_(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) return 0;
    return value;
  }

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return 0;
  }

  let text = String(value || '').trim();

  if (!text) return 0;

  text = text
    .replace(/rp/gi, '')
    .replace(/\s/g, '')
    .replace(/[^\d,.\-]/g, '');

  if (!text || text === '-' || text === ',' || text === '.') {
    return 0;
  }

  const hasDot = text.indexOf('.') !== -1;
  const hasComma = text.indexOf(',') !== -1;

  if (hasDot && hasComma) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (hasComma) {
    const commaParts = text.split(',');

    if (commaParts.length > 2) {
      text = text.replace(/,/g, '');
    } else if (commaParts[1] && commaParts[1].length === 3) {
      text = text.replace(/,/g, '');
    } else {
      text = text.replace(',', '.');
    }
  } else if (hasDot) {
    const dotParts = text.split('.');

    if (dotParts.length > 2) {
      text = text.replace(/\./g, '');
    } else if (dotParts[1] && dotParts[1].length === 3) {
      text = text.replace(/\./g, '');
    }
  }

  const num = Number(text);

  if (isNaN(num) || !isFinite(num)) {
    return 0;
  }

  return num;
}

function financeRoundAmount_(value) {
  return Math.round(financeToAmount_(value) * 100) / 100;
}

function financeIsAmountEqual_(a, b) {
  return Math.abs(financeRoundAmount_(a) - financeRoundAmount_(b)) <= 0.01;
}

function financeClampAmount_(value, min, max) {
  const amount = financeRoundAmount_(value);
  const minValue = financeRoundAmount_(min || 0);
  const maxValue = financeRoundAmount_(max || 0);

  return Math.min(Math.max(amount, minValue), maxValue);
}