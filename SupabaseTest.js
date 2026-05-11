function testPatientRepositorySupabase() {
  Logger.log('=== Test PatientRepository dengan Supabase ===');

  try {
    // 1. List semua pasien dari Supabase
    var allPatients = PatientRepository.getPatientsRaw({ backend_mode: 'supabase' });
    Logger.log('✅ getPatientsRaw: ' + allPatients.length + ' pasien');

    // 2. Cari pasien pertama by ID
    if (allPatients.length === 0) {
      Logger.log('❌ Tidak ada pasien untuk testing');
      return;
    }

    var firstPatientId = allPatients[0].patient_id;
    var patient = PatientRepository.findPatientById(firstPatientId, { backend_mode: 'supabase' });
    Logger.log('✅ findPatientById(' + firstPatientId + '): ' + patient.full_name);

    // 3. List appointments untuk pasien tersebut
    var appointments = PatientRepository.listAppointmentsByPatientId(firstPatientId, { backend_mode: 'supabase' });
    Logger.log('✅ listAppointmentsByPatientId: ' + appointments.length + ' appointments');

    // 4. List treatments untuk pasien tersebut
    var treatments = PatientRepository.listTreatmentsByPatientId(firstPatientId, { backend_mode: 'supabase' });
    Logger.log('✅ listTreatmentsByPatientId: ' + treatments.length + ' treatments');

    // 5. Active patients
    var activePatients = PatientRepository.listActivePatients({ backend_mode: 'supabase' });
    Logger.log('✅ listActivePatients: ' + activePatients.length + ' aktif');

    Logger.log('=== Semua test PASS ===');
  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
  }
}

function testSupabaseCRUD() {
  Logger.log('=== Test CRUD Supabase ===');

  var supabaseOpts = { backend_mode: 'supabase' };
  var testPatientId = 'TEST-CRUD-001';

  try {
    // ========== CLEANUP awal (jika test sebelumnya gagal) ==========
    try {
      dbDeleteById_('Patients', 'patient_id', testPatientId, supabaseOpts);
      Logger.log('🧹 Cleanup data test lama');
    } catch (e) {
      // Tidak masalah kalau gagal — datanya memang belum ada
    }

    // ========== 1. INSERT ==========
    var newPatient = {
      patient_id: testPatientId,
      patient_code: 'RM-TEST-001',
      full_name: 'Test CRUD Patient',
      gender: 'Laki-laki',
      birth_date: '1990-01-01',
      phone: '08123456789',
      email: 'test@example.com',
      address: 'Alamat Test',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    var inserted = dbInsert_('Patients', newPatient, supabaseOpts);
    Logger.log('✅ INSERT: ' + inserted.full_name + ' (id=' + inserted.id + ')');

    // ========== 2. READ untuk verifikasi ==========
    var found = dbFindById_('Patients', 'patient_id', testPatientId, supabaseOpts);
    if (!found) throw new Error('Pasien yang baru di-insert tidak ditemukan!');
    Logger.log('✅ READ: ' + found.full_name + ' — phone: ' + found.phone);

    // ========== 3. UPDATE ==========
    var updated = dbUpdateById_('Patients', 'patient_id', testPatientId, {
      full_name: 'Test CRUD Patient UPDATED',
      phone: '08198765432',
      updated_at: new Date().toISOString()
    }, supabaseOpts);
    Logger.log('✅ UPDATE: ' + updated.full_name + ' — phone: ' + updated.phone);

    // ========== 4. DELETE ==========
    dbDeleteById_('Patients', 'patient_id', testPatientId, supabaseOpts);
    Logger.log('✅ DELETE: data dihapus');

    // ========== 5. VERIFY DELETE ==========
    var afterDelete = dbFindById_('Patients', 'patient_id', testPatientId, supabaseOpts);
    if (afterDelete) throw new Error('Pasien masih ada setelah delete!');
    Logger.log('✅ VERIFY: data benar-benar hilang');

    Logger.log('=== SEMUA CRUD TEST PASS ===');
  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
  }
}

function debugSupabaseInsert() {
  var testPatientId = 'TEST-DEBUG-001';
  var supabaseOpts = { backend_mode: 'supabase' };

  // Cleanup dulu
  try {
    dbDeleteById_('Patients', 'patient_id', testPatientId, supabaseOpts);
  } catch (e) {}

  var newPatient = {
    patient_id: testPatientId,
    patient_code: 'RM-DEBUG-001',
    full_name: 'Debug Patient',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  var result = dbInsert_('Patients', newPatient, supabaseOpts);

  Logger.log('Type of result: ' + typeof result);
  Logger.log('Is array: ' + Array.isArray(result));
  Logger.log('Result raw: ' + JSON.stringify(result));

  // Cleanup setelah test
  try {
    dbDeleteById_('Patients', 'patient_id', testPatientId, supabaseOpts);
  } catch (e) {}
}

function debugSupabaseInsertDirect() {
  var testPatientId = 'TEST-DIRECT-001';

  // Cleanup dulu via DELETE langsung
  try {
    supabaseDelete_('patients', { patient_id: 'eq.' + testPatientId });
  } catch (e) {}

  var newPatient = {
    patient_id: testPatientId,
    patient_code: 'RM-DIRECT-001',
    full_name: 'Direct Test',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  Logger.log('--- Memanggil supabaseInsert_ langsung ---');
  var result = supabaseInsert_('patients', newPatient);

  Logger.log('Type: ' + typeof result);
  Logger.log('Is array: ' + Array.isArray(result));
  Logger.log('Result raw: ' + JSON.stringify(result));

  // Cleanup
  try {
    supabaseDelete_('patients', { patient_id: 'eq.' + testPatientId });
  } catch (e) {}
}