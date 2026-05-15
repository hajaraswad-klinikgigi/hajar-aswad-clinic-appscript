/* =========================================================
   TEST — Doctor Compensation Service
   Jalankan manual dari Apps Script Editor.
   HAPUS FILE INI setelah testing selesai.
   ========================================================= */

var TEST_USERNAME = 'admin';   // ← ganti username
var TEST_PASSWORD = 'admin';   // ← ganti password

function testDoctorCompensation_Login() {
  var login = loginUser(TEST_USERNAME, TEST_PASSWORD);
  Logger.log('[LOGIN] ' + JSON.stringify(login));
  return login;
}

function testDoctorCompensation_GetRules() {
  var login = loginUser(TEST_USERNAME, TEST_PASSWORD);
  if (!login.success) { Logger.log('Login gagal: ' + login.message); return; }

  var result = getDoctorCompensationRules({ session_token: login.data.session_token });
  Logger.log('[GET RULES] success=' + result.success);
  Logger.log('[GET RULES] jumlah rules=' + (result.data ? result.data.length : 0));
  Logger.log('[GET RULES] data=' + JSON.stringify(result.data));
}

function testDoctorCompensation_CalculateDraft() {
  var login = loginUser(TEST_USERNAME, TEST_PASSWORD);
  if (!login.success) { Logger.log('Login gagal: ' + login.message); return; }

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var result = calculateDoctorFeeDraft({ session_token: login.data.session_token, date: today });

  Logger.log('[FEE DRAFT] success=' + result.success);
  if (!result.success) {
    Logger.log('[FEE DRAFT] error=' + result.message);
    return;
  }
  Logger.log('[FEE DRAFT] date=' + result.data.date);
  Logger.log('[FEE DRAFT] already_confirmed=' + result.data.already_confirmed);
  Logger.log('[FEE DRAFT] total_auto_fee=' + result.data.total_auto_fee);
  Logger.log('[FEE DRAFT] doctors=' + JSON.stringify(result.data.doctors));
  Logger.log('[FEE DRAFT] warnings=' + JSON.stringify(result.data.warnings));
}

function testDoctorCompensation_RunAll() {
  Logger.log('===== TEST DOCTOR COMPENSATION =====');
  testDoctorCompensation_GetRules();
  testDoctorCompensation_CalculateDraft();
  Logger.log('===== SELESAI =====');
}

// ── Step 8: verifikasi laporan harian owner masih berjalan normal ──

function testOwnerDailyReport() {
  Logger.log('===== TEST OWNER DAILY REPORT (Step 8) =====');
  var login = loginUser(TEST_USERNAME, TEST_PASSWORD);
  if (!login.success) { Logger.log('Login gagal: ' + login.message); return; }

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var result = getOwnerDailyReport({ session_token: login.data.session_token, date: today });

  Logger.log('[DAILY REPORT] success=' + result.success);
  if (!result.success) {
    Logger.log('[DAILY REPORT] error=' + result.message);
    return;
  }

  var d = result.data;
  Logger.log('[DAILY REPORT] date='            + d.date);
  Logger.log('[DAILY REPORT] revenue.total_cash_in=' + (d.revenue && d.revenue.total_cash_in));
  Logger.log('[DAILY REPORT] expense.total_expense=' + (d.expense && d.expense.total_expense));
  Logger.log('[DAILY REPORT] net.net_cash='    + (d.net && d.net.net_cash));
  Logger.log('[DAILY REPORT] doctor_fee_draft=' + JSON.stringify(d.doctor_fee_draft));
  Logger.log('===== SELESAI =====');
}
