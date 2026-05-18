const SPREADSHEET_ID = '1oQqr9yA0arIny8hi-BELMt07ZgT0WH_0UtPRxsBmq6Q';
const PATIENT_PHOTOS_FOLDER_ID = '1CAfQrEC1dD-diKRoqelc5XP3U3n4Rj5v';
const FEEDBACK_API_KEY = 'fbk_9d3f7c2a8b1e4f609c5d2e7a6b8c1f4e93a0d5b7c2e8f1a6d4b9c0e3f7a2d8b5';

let _spreadsheet = null;
const _sheetCache = {};

function doGet(e) {
  const params = (e && e.parameter) || {};
  const api = String(params.api || '').trim();

  if (api) {
    return handleFeedbackApiGet_(params);
  }

  const page = String(params.page || '').trim();

  if (page === 'billing-feedback') {
    const template = HtmlService.createTemplateFromFile('billing-feedback');
    template.feedbackToken = String(params.token || '').trim();

    return template
      .evaluate()
      .setTitle('Feedback Layanan | Hajar Aswad Dental Clinic')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const totpSetupToken = String(params.totp_setup_token || '').trim();
  if (totpSetupToken) {
    const template = HtmlService.createTemplateFromFile('totp-setup');
    template.totpSetupToken = totpSetupToken;
    return template
      .evaluate()
      .setTitle('Setup Authenticator | Hajar Aswad Dental Clinic')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const template = HtmlService.createTemplateFromFile('index');

  return template
    .evaluate()
    .setTitle('Hajar Aswad | Dental Clinic');
}

function doPost(e) {
  const params = (e && e.parameter) || {};
  const api = String(params.api || '').trim();

  if (api) {
    return handleFeedbackApiPost_(e);
  }

  return createJsonResponse_({
    success: false,
    message: 'API tidak ditemukan'
  });
}

/* =========================================================
   PUBLIC FEEDBACK API / CLOUDFLARE BRIDGE
   Dipakai oleh Cloudflare Pages Functions.
   ========================================================= */

function handleFeedbackApiGet_(params) {
  try {
    const auth = validateFeedbackApiKey_(params);

    if (!auth.success) {
      return createJsonResponse_(auth);
    }

    const api = String(params.api || '').trim();

    if (api === 'ping') {
      return createJsonResponse_({
        success: true,
        message: 'Feedback API aktif',
        data: {
          service: 'hajar-aswad-feedback-api',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (api === 'feedback-page') {
      const token = String(params.token || '').trim();
      const result = getBillingFeedbackPageData(token);
      return createJsonResponse_(result);
    }

    return createJsonResponse_({
      success: false,
      message: 'Endpoint API tidak dikenal'
    });

  } catch (err) {
    return createJsonResponse_({
      success: false,
      message: 'Terjadi kesalahan API feedback: ' + (err && err.message ? err.message : err)
    });
  }
}

function handleFeedbackApiPost_(e) {
  try {
    const params = (e && e.parameter) || {};
    const auth = validateFeedbackApiKey_(params);

    if (!auth.success) {
      return createJsonResponse_(auth);
    }

    const api = String(params.api || '').trim();

    if (api !== 'submit-feedback') {
      return createJsonResponse_({
        success: false,
        message: 'Endpoint POST API tidak dikenal'
      });
    }

    const payload = parseJsonPostBody_(e);
    const result = submitBillingFeedback(payload);

    return createJsonResponse_(result);

  } catch (err) {
    return createJsonResponse_({
      success: false,
      message: 'Terjadi kesalahan POST API feedback: ' + (err && err.message ? err.message : err)
    });
  }
}

function validateFeedbackApiKey_(params) {
  const expectedKey = String(FEEDBACK_API_KEY || '').trim();
  const providedKey = String((params && params.api_key) || '').trim();

  if (!expectedKey || expectedKey === 'GANTI_DENGAN_SECRET_FEEDBACK_API_KEY_YANG_PANJANG') {
    return {
      success: false,
      message: 'FEEDBACK_API_KEY belum dikonfigurasi di Code.gs'
    };
  }

  if (!providedKey || providedKey !== expectedKey) {
    return {
      success: false,
      message: 'Akses API feedback tidak valid'
    };
  }

  return {
    success: true
  };
}

function parseJsonPostBody_(e) {
  const contents = e && e.postData && e.postData.contents
    ? String(e.postData.contents || '')
    : '';

  if (!contents) {
    return {};
  }

  try {
    return JSON.parse(contents);
  } catch (err) {
    throw new Error('Body JSON tidak valid');
  }
}

function createJsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload || {}))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =========================================================
   BASE APP HELPERS
   ========================================================= */

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Server-side HTML escape — dipakai untuk email body, log, dan
 * pesan error yang mengandung user input. Setara dengan
 * `escapeAppHtml` di scripts.html (client-side), tapi safe dipanggil
 * dari V8 runtime Apps Script.
 */
function escapeHtmlServer_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* =========================================================
   WEB APP URL HELPER (untuk link di email)
   =========================================================
   ScriptApp.getService().getUrl() defaultnya kembalikan URL
   deployment ter-PUBLISH (/exec). Saat Phase 2C ini, /exec masih
   state lama (pre-deploy) dan tidak punya fix terbaru — email
   link yang point ke /exec kena bug.

   Override `WEB_APP_URL_OVERRIDE` di bawah supaya email link
   point ke /dev selama testing. Setelah deploy /exec final,
   ganti ke '' (pakai getService().getUrl()) atau 'exec'.
   ========================================================= */

const WEB_APP_URL_OVERRIDE = 'dev'; // 'dev' | 'exec' | ''

function getAppWebAppUrl_() {
  const override = String(WEB_APP_URL_OVERRIDE || '').trim().toLowerCase();
  if (override === 'dev' || override === 'exec') {
    return 'https://script.google.com/macros/s/' + ScriptApp.getScriptId() + '/' + override;
  }
  return ScriptApp.getService().getUrl();
}

function getSpreadsheet() {
  if (!_spreadsheet) {
    _spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return _spreadsheet;
}

function getSheet(sheetName) {
  if (!_sheetCache[sheetName]) {
    const sheet = getSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('Sheet tidak ditemukan: ' + sheetName);
    }
    _sheetCache[sheetName] = sheet;
  }
  return _sheetCache[sheetName];
}

function getRowsAsObjects(sheetName) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();

  if (!values || values.length < 2) return [];

  const headers = values[0];

  return values.slice(1)
    .filter(function(row) {
      return row.some(function(cell) {
        return cell !== '';
      });
    })
    .map(function(row) {
      const obj = {};
      headers.forEach(function(header, i) {
        obj[header] = row[i];
      });
      return obj;
    });
}

function formatTodayYmd() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function extractYmd(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const s = String(value).trim();
  const match = s.match(/^\d{4}-\d{2}-\d{2}/);

  if (match) return match[0];

  return '';
}

function getDateRangeByPeriod(period) {
  const today = new Date();
  const end = new Date(today);
  const start = new Date(today);

  const p = String(period || 'today').toLowerCase();

  if (p === '7days') {
    start.setDate(start.getDate() - 6);
  } else if (p === '30days') {
    start.setDate(start.getDate() - 29);
  }

  return {
    start: Utilities.formatDate(start, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    end: Utilities.formatDate(end, Session.getScriptTimeZone(), 'yyyy-MM-dd')
  };
}

function isDateBetweenYmd(dateYmd, startYmd, endYmd) {
  if (!dateYmd) return false;
  return dateYmd >= startYmd && dateYmd <= endYmd;
}

function generateSafeId(prefix) {
  const now = new Date();

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');

  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0');

  return String(prefix || 'ID') + '-' + y + m + d + '-' + h + min + s + ms + '-' + rand;
}

function getAppCache() {
  return CacheService.getScriptCache();
}

function buildCacheKey(parts) {
  return (parts || []).join('::');
}

function getCachedJson(key) {
  const raw = getAppCache().get(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function putCachedJson(key, value, seconds) {
  try {
    var text = JSON.stringify(value);

    // Guard konservatif agar tidak mendekati limit CacheService.
    // Jika payload terlalu besar, cache dilewati tapi aplikasi tetap jalan.
    if (text.length > 80000) {
      console.warn('Cache skipped because value is too large:', key, text.length);
      return false;
    }

    getAppCache().put(key, text, seconds || 30);
    return true;

  } catch (err) {
    console.warn(
      'Cache skipped because putCachedJson failed:',
      key,
      err && err.message ? err.message : err
    );
    return false;
  }
}

function generateFeedbackApiKeyManual() {
  const key =
    'HAJAR_ASWAD_FEEDBACK_' +
    Utilities.getUuid().replace(/-/g, '') +
    '_' +
    Utilities.getUuid().replace(/-/g, '');

  Logger.log(key);
  return key;
}