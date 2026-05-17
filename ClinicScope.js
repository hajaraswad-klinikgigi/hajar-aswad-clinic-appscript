/* =========================================================
   CLINIC SCOPE
   Helper multi-klinik. Setiap query data mutasi di-scope ke
   clinic_id yang relevan; helper di sini jadi satu-satunya
   source of truth untuk menentukan "klinik mana yang aktif".

   Phase 1 (sekarang): hardcode 'HAJAR-ASWAD'.
   Phase 2 (Clerk):    resolve dari auth context (clinic_users
                        berdasarkan email JWT yang sudah ter-
                        verifikasi). Cukup ganti getCurrentClinicId_
                        — semua call site di DataAccess.js sudah
                        siap.
   ========================================================= */

const CLINIC_DEFAULT_ID = 'KLINIK-1';

/**
 * Resolve clinic_id aktif untuk request saat ini.
 *
 * Phase 1: selalu return CLINIC_DEFAULT_ID. Payload diterima
 * untuk forward-compat — Phase 2 akan baca dari auth context
 * (mis. payload.__auth_user.clinic_id).
 *
 * @param {object} [payload] - request payload (boleh null)
 * @returns {string} clinic_id
 */
function getCurrentClinicId_(payload) {
  // Phase 2 hook: baca clinic_id dari auth context yang sudah
  // di-verify. Sementara hardcode supaya zero perubahan UX.
  return CLINIC_DEFAULT_ID;
}

/**
 * Build filter object PostgREST untuk scope by clinic_id.
 * Dipakai di SELECT/UPDATE/DELETE yang langsung call supabase*_.
 *
 * Contoh: supabaseSelect_('expenses', Object.assign(
 *   { expense_date: 'eq.2026-05-16' },
 *   clinicScopeFilter_(payload)
 * ));
 */
function clinicScopeFilter_(payload) {
  return { clinic_id: 'eq.' + getCurrentClinicId_(payload) };
}

/**
 * Tabel yang TIDAK perlu di-scope per klinik (master config
 * lintas klinik). Bukan tabel mutasi data klinik.
 */
const CLINIC_SCOPE_EXEMPT_TABLES = Object.freeze({
  clinics: true
});

function clinicScopeAppliesToTable_(targetTable) {
  if (!targetTable) return false;
  return !CLINIC_SCOPE_EXEMPT_TABLES[String(targetTable)];
}

/**
 * Tentukan apakah sebuah call dbXxx_ harus skip auto-scope.
 * Dipakai oleh tools yang sengaja perlu lintas-klinik
 * (mis. SupabaseBackup.js) — pass options.skip_clinic_scope=true.
 */
function clinicScopeShouldSkip_(options) {
  const opts = options || {};
  return opts.skip_clinic_scope === true;
}

/**
 * Resolve clinic_id final untuk sebuah call dbXxx_:
 *   - kalau options.skip_clinic_scope=true → null (skip scope)
 *   - kalau options.clinic_id eksplisit di-set → pakai itu
 *   - default → getCurrentClinicId_(options.payload)
 */
function clinicScopeResolveId_(options) {
  if (clinicScopeShouldSkip_(options)) return null;

  const opts = options || {};
  if (opts.clinic_id) return String(opts.clinic_id);

  return getCurrentClinicId_(opts.payload);
}
