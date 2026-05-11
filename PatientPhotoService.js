function getPatientPhotosRaw() {
  return getRowsAsObjects('PatientPhotos') || [];
}

function normalizePatientPhotoForClient(row) {
  const obj = {};
  Object.keys(row || {}).forEach(function(key) {
    obj[key] = formatCellValue(row[key]);
  });
  return obj;
}

function isPatientPhotoActiveValue(value) {
  if (value === false) return false;
  if (value === true) return true;
  if (value === '' || value === null || value === undefined) return true;

  return String(value).trim().toLowerCase() !== 'false';
}

function parseDateTimeSafe_(value) {
  if (!value) return null;

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value;
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return null;

  return d;
}

function formatIndonesianDateText_(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  let dateObj = null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parts = raw.split('-');
    dateObj = new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2]),
      0,
      0,
      0
    );
  } else {
    dateObj = new Date(raw);
  }

  if (!dateObj || isNaN(dateObj.getTime())) {
    return raw;
  }

  const dayName = dayNames[dateObj.getDay()];
  const day = dateObj.getDate();
  const monthName = monthNames[dateObj.getMonth()];
  const year = dateObj.getFullYear();

  return 'Hari: ' + dayName + ', Tanggal: ' + day + ' ' + monthName + ' ' + year;
}

function getTreatmentPhotoDeletePolicy(treatmentId) {
  const rows = getPatientPhotosRaw().filter(function(row) {
    return String(row.treatment_id || '') === String(treatmentId || '');
  });

  if (!rows.length) {
    return {
      has_photos: false,
      upload_allowed: true,
      upload_lock_message: '',
      delete_allowed: false,
      delete_lock_message: 'Foto treatment tidak ditemukan.'
    };
  }

  const firstCreated = rows
    .map(function(row) {
      return parseDateTimeSafe_(row.created_at || '');
    })
    .filter(function(dt) {
      return !!dt;
    })
    .sort(function(a, b) {
      return a.getTime() - b.getTime();
    })[0];

  if (!firstCreated) {
    return {
      has_photos: true,
      upload_allowed: false,
      upload_lock_message: 'Riwayat waktu foto tidak valid, penambahan foto dinonaktifkan demi keamanan.',
      delete_allowed: false,
      delete_lock_message: 'Riwayat waktu foto tidak valid, penghapusan dinonaktifkan demi keamanan.'
    };
  }

  const deadline = new Date(firstCreated.getTime() + (24 * 60 * 60 * 1000));
  const now = new Date();
  const allowed = now.getTime() <= deadline.getTime();

  return {
    has_photos: true,
    upload_allowed: allowed,
    upload_lock_message: allowed
      ? ''
      : 'Foto pada treatment ini tidak bisa ditambahkan lagi karena sudah lewat 1 x 24 jam sejak foto pertama dibuat.',
    delete_allowed: allowed,
    delete_lock_message: allowed
      ? ''
      : 'Foto pada treatment ini hanya bisa dihapus dalam 1 x 24 jam sejak foto pertama ditambahkan.',
    first_created_at: firstCreated,
    delete_deadline: deadline
  };
}

function generateNextPatientPhotoId() {
  return generateSafeId('PHT');
}

function validatePatientPhotoData(data) {
  const errors = {};

  if (!data.patient_id || !String(data.patient_id).trim()) {
    errors.patient_id = 'Patient ID wajib diisi';
  }

  if (!data.treatment_id || !String(data.treatment_id).trim()) {
    errors.treatment_id = 'Treatment ID wajib diisi';
  }

  const photoType = String(data.photo_type || '').trim().toLowerCase();
  if (!photoType) {
    errors.photo_type = 'Tipe foto wajib diisi';
  } else if (['before', 'after'].indexOf(photoType) === -1) {
    errors.photo_type = 'Tipe foto harus before atau after';
  }

  if (!data.file_name || !String(data.file_name).trim()) {
    errors.file_name = 'Nama file wajib diisi';
  }

  if (!data.file_url || !String(data.file_url).trim()) {
    errors.file_url = 'URL file wajib diisi';
  }

  if (!data.file_drive_id || !String(data.file_drive_id).trim()) {
    errors.file_drive_id = 'Drive file ID wajib diisi';
  }

  const sortOrder = Number(data.sort_order || 0);
  if (sortOrder < 0) {
    errors.sort_order = 'Urutan foto tidak valid';
  }

  return errors;
}

function getPatientPhotosByPatientId(patientId) {
  const rows = getPatientPhotosRaw();

  return rows
    .filter(function(row) {
      return String(row.patient_id || '') === String(patientId || '') &&
        isPatientPhotoActiveValue(row.is_active);
    })
    .map(function(row) {
      return normalizePatientPhotoForClient(row);
    })
    .sort(function(a, b) {
      const visitCompare = String(b.visit_date || '').localeCompare(String(a.visit_date || ''));
      if (visitCompare !== 0) return visitCompare;

      const treatmentCompare = String(b.treatment_id || '').localeCompare(String(a.treatment_id || ''));
      if (treatmentCompare !== 0) return treatmentCompare;

      const typeCompare = String(a.photo_type || '').localeCompare(String(b.photo_type || ''));
      if (typeCompare !== 0) return typeCompare;

      return Number(a.sort_order || 0) - Number(b.sort_order || 0);
    });
}

function groupPatientPhotosByTreatment(patientId) {
  const photos = getPatientPhotosByPatientId(patientId);
  const grouped = {};

  photos.forEach(function(photo) {
    const treatmentId = String(photo.treatment_id || '').trim();
    if (!treatmentId) return;

    if (!grouped[treatmentId]) {
      const policy = getTreatmentPhotoDeletePolicy(treatmentId);

      grouped[treatmentId] = {
        treatment_id: treatmentId,
        visit_date: String(photo.visit_date || '').trim(),
        visit_date_text: formatIndonesianDateText_(photo.visit_date || ''),
        upload_allowed: !!policy.upload_allowed,
        upload_lock_message: policy.upload_lock_message || '',
        delete_allowed: !!policy.delete_allowed,
        delete_lock_message: policy.delete_lock_message || '',
        before: [],
        after: []
      };
    }

    const type = String(photo.photo_type || '').trim().toLowerCase();

    const enrichedPhoto = Object.assign({}, photo, {
      delete_allowed: grouped[treatmentId].delete_allowed,
      delete_lock_message: grouped[treatmentId].delete_lock_message
    });

    if (type === 'before') {
      grouped[treatmentId].before.push(enrichedPhoto);
    } else if (type === 'after') {
      grouped[treatmentId].after.push(enrichedPhoto);
    }
  });

  return Object.values(grouped).sort(function(a, b) {
    return String(b.visit_date || '').localeCompare(String(a.visit_date || ''));
  });
}

function createPatientPhoto(data) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'CREATE_PATIENT_PHOTO',
    module: 'PatientPhotoService',
    action: 'createPatientPhoto',
    __test_freeze_enabled: data && data.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(5000);

    const errors = validatePatientPhotoData(data);

    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        message: 'Validasi gagal',
        errors: errors
      };
    }

    const patientId = String(data.patient_id || '').trim();
    const treatmentId = String(data.treatment_id || '').trim();

    const patient = findPatientRawById(patientId);
    if (!patient) {
      return {
        success: false,
        message: 'Data pasien tidak ditemukan'
      };
    }

    const treatment = getTreatmentsRaw().find(function(row) {
      return String(row.treatment_id || '') === treatmentId;
    });

    if (!treatment) {
      return {
        success: false,
        message: 'Treatment tidak ditemukan'
      };
    }

    if (String(treatment.patient_id || '') !== patientId) {
      return {
        success: false,
        message: 'Treatment tidak sesuai dengan pasien'
      };
    }

    const uploadPolicy = getTreatmentPhotoDeletePolicy(treatmentId);

    if (uploadPolicy.has_photos && !uploadPolicy.upload_allowed) {
      return {
        success: false,
        message: uploadPolicy.upload_lock_message || 'Foto pada treatment ini tidak bisa ditambahkan lagi.'
      };
    }

    const photo = {
      photo_id: generateNextPatientPhotoId(),
      patient_id: patientId,
      treatment_id: treatmentId,
      visit_date: String(treatment.treatment_date || '').trim(),
      photo_group: String(data.photo_group || '').trim(),
      photo_type: String(data.photo_type || '').trim().toLowerCase(),
      sort_order: Number(data.sort_order || 0),
      file_name: String(data.file_name || '').trim(),
      file_url: String(data.file_url || '').trim(),
      file_drive_id: String(data.file_drive_id || '').trim(),
      photo_note: String(data.photo_note || '').trim(),
      is_active: true,
      created_at: nowIso(),
      updated_at: nowIso()
    };

    dbInsert_('PatientPhotos', photo);

    clearPatientDetailBundleCache(patientId);

    return {
      success: true,
      message: 'Foto pasien berhasil ditambahkan',
      data: normalizePatientPhotoForClient(photo)
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat menambahkan foto pasien'
    };
  } finally {
    lock.releaseLock();
  }
}

function getPatientPhotosFolder() {
  return DriveApp.getFolderById(PATIENT_PHOTOS_FOLDER_ID);
}

function buildPatientPhotoPreviewUrl(fileId) {
  return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1600';
}

function sanitizeUploadFileName(fileName) {
  return String(fileName || '')
    .trim()
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120);
}

function isAllowedPatientPhotoMimeType(mimeType) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  return allowed.indexOf(String(mimeType || '').trim().toLowerCase()) !== -1;
}

function getBase64SizeInBytes(base64String) {
  const cleaned = String(base64String || '').trim();
  if (!cleaned) return 0;

  const padding = (cleaned.match(/=*$/) || [''])[0].length;
  return Math.floor((cleaned.length * 3) / 4) - padding;
}

function isPhotoManagerRole(actorRole) {
  const role = String(actorRole || '').trim().toLowerCase();
  return role === 'admin' || role === 'owner';
}

function rejectPhotoUploadAccess() {
  return {
    success: false,
    message: 'Hanya admin atau owner yang dapat upload foto pasien'
  };
}

function createPatientPhotoUpload(payload) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'UPLOAD_PATIENT_PHOTO',
    module: 'PatientPhotoService',
    action: 'createPatientPhotoUpload',
    __test_freeze_enabled: payload && payload.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(5000);

    if (!isPhotoManagerRole(payload.actor_role)) {
      return rejectPhotoUploadAccess();
    }

    const patientId = String(payload.patient_id || '').trim();
    const treatmentId = String(payload.treatment_id || '').trim();
    const photoType = String(payload.photo_type || '').trim().toLowerCase();
    const originalFileName = String(payload.file_name || '').trim();
    const safeFileName = sanitizeUploadFileName(originalFileName);
    const mimeType = String(payload.mime_type || '').trim().toLowerCase();
    const base64Data = String(payload.base64_data || '').trim();
    const photoNote = String(payload.photo_note || '').trim();
    const photoGroup = String(payload.photo_group || '').trim();
    const sortOrder = Number(payload.sort_order || 0);

    const validation = validatePatientPhotoData({
      patient_id: patientId,
      treatment_id: treatmentId,
      photo_type: photoType,
      file_name: safeFileName,
      file_url: 'placeholder',
      file_drive_id: 'placeholder',
      photo_note: photoNote,
      photo_group: photoGroup,
      sort_order: sortOrder
    });

    delete validation.file_url;
    delete validation.file_drive_id;

    if (!mimeType) {
      validation.mime_type = 'Tipe file tidak ditemukan';
    }

    if (!base64Data) {
      validation.file = 'File foto wajib dipilih';
    }

    if (!isAllowedPatientPhotoMimeType(mimeType)) {
      validation.mime_type = 'Format file harus JPG, PNG, atau WEBP';
    }

    const maxBytes = 5 * 1024 * 1024; // 5 MB
    const fileBytes = getBase64SizeInBytes(base64Data);
    if (fileBytes > maxBytes) {
      validation.file = 'Ukuran file maksimal 5 MB';
    }

    if (!safeFileName) {
      validation.file_name = 'Nama file tidak valid';
    }

    if (Object.keys(validation).length > 0) {
      return {
        success: false,
        message: 'Validasi gagal',
        errors: validation
      };
    }

    const patient = findPatientRawById(patientId);
    if (!patient) {
      return {
        success: false,
        message: 'Data pasien tidak ditemukan'
      };
    }

    const treatment = getTreatmentsRaw().find(function(row) {
      return String(row.treatment_id || '') === treatmentId;
    });

    if (!treatment) {
      return {
        success: false,
        message: 'Treatment tidak ditemukan'
      };
    }

    if (String(treatment.patient_id || '') !== patientId) {
      return {
        success: false,
        message: 'Treatment tidak sesuai dengan pasien'
      };
    }

    const uploadPolicy = getTreatmentPhotoDeletePolicy(treatmentId);

    if (uploadPolicy.has_photos && !uploadPolicy.upload_allowed) {
      return {
        success: false,
        message: uploadPolicy.upload_lock_message || 'Foto pada treatment ini tidak bisa ditambahkan lagi.'
      };
    }

    const bytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(bytes, mimeType, safeFileName);

    const visitDate = String(treatment.treatment_date || '').trim();
    const driveFileName =
      patientId + '_' +
      treatmentId + '_' +
      photoType + '_' +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + '_' +
      safeFileName;

    blob.setName(driveFileName);

    const file = getPatientPhotosFolder().createFile(blob);

    // sementara untuk MVP agar preview gambar bisa tampil
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const photo = {
      photo_id: generateNextPatientPhotoId(),
      patient_id: patientId,
      treatment_id: treatmentId,
      visit_date: visitDate,
      photo_group: photoGroup,
      photo_type: photoType,
      sort_order: sortOrder,
      file_name: safeFileName,
      file_url: buildPatientPhotoPreviewUrl(file.getId()),
      file_drive_id: file.getId(),
      photo_note: photoNote,
      is_active: true,
      created_at: nowIso(),
      updated_at: nowIso()
    };

    dbInsert_('PatientPhotos', photo);

    clearPatientDetailBundleCache(patientId);

    return {
      success: true,
      message: 'Foto pasien berhasil diupload',
      data: normalizePatientPhotoForClient(photo)
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat upload foto pasien'
    };
  } finally {
    lock.releaseLock();
  }
}

function getPatientPhotoById(photoId) {
  const photo = getPatientPhotosRaw().find(function(row) {
    return String(row.photo_id || '') === String(photoId || '');
  });

  if (!photo) {
    return {
      success: false,
      message: 'Foto pasien tidak ditemukan'
    };
  }

  return {
    success: true,
    data: normalizePatientPhotoForClient(photo)
  };
}

function deletePatientPhoto(payload) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'DELETE_PATIENT_PHOTO',
    module: 'PatientPhotoService',
    action: 'deletePatientPhoto',
    __test_freeze_enabled: payload && payload.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(5000);

    if (!isPhotoManagerRole(payload.actor_role)) {
      return rejectPhotoUploadAccess();
    }

    const photoId = String(payload.photo_id || '').trim();
    if (!photoId) {
      return {
        success: false,
        message: 'Photo ID tidak ditemukan'
      };
    }

    const photo = getPatientPhotosRaw().find(function(row) {
      return String(row.photo_id || '') === photoId;
    });

    if (!photo) {
      return {
        success: false,
        message: 'Foto pasien tidak ditemukan'
      };
    }

    if (!isPatientPhotoActiveValue(photo.is_active)) {
      return {
        success: false,
        message: 'Foto sudah tidak aktif'
      };
    }

    const policy = getTreatmentPhotoDeletePolicy(String(photo.treatment_id || '').trim());

    if (!policy.delete_allowed) {
      return {
        success: false,
        message: policy.delete_lock_message || 'Batas waktu hapus foto sudah lewat.'
      };
    }

    const patientId = String(photo.patient_id || '').trim();

    const ok = dbUpdateById_('PatientPhotos', 'photo_id', photoId, {
      is_active: false,
      updated_at: nowIso(),
      deleted_at: nowIso()
    });

    if (!ok) {
      return {
        success: false,
        message: 'Gagal menghapus foto pasien'
      };
    }

    clearPatientDetailBundleCache(patientId);

    return {
      success: true,
      message: 'Foto pasien berhasil dihapus'
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat menghapus foto pasien'
    };
  } finally {
    lock.releaseLock();
  }
}

function testPatientPhotoFreezeGuardLog() {
  const result = {
    success: true,
    stage: '8B-11-PatientPhotoService-FreezeGuard',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    flags: {
      default_backend_mode: typeof dbGetBackendMode_ === 'function' ? dbGetBackendMode_() : '',
      ui_read_backend_mode: typeof repoGetUiReadBackendMode_ === 'function'
        ? repoGetUiReadBackendMode_()
        : '',
      ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
        ? repoIsUiReadSupabaseTestEnabled_()
        : null,
      supabase_staging_write_test_enabled: typeof repoIsSupabaseStagingWriteTestEnabled_ === 'function'
        ? repoIsSupabaseStagingWriteTestEnabled_()
        : null,
      production_mutation_freeze_enabled: typeof repoIsProductionMutationFreezeEnabled_ === 'function'
        ? repoIsProductionMutationFreezeEnabled_()
        : null
    },
    before_counts: {},
    after_counts: {},
    checks: {
      default_off_create_photo_normal_flow_reached: false,
      default_off_upload_photo_normal_flow_reached: false,
      default_off_delete_photo_normal_flow_reached: false,
      simulated_freeze_create_photo_blocked: false,
      simulated_freeze_upload_photo_blocked: false,
      simulated_freeze_delete_photo_blocked: false,
      counts_unchanged: false
    },
    messages: {},
    issue_count: 0,
    issues: []
  };

  function addIssue(issue, details) {
    result.issues.push(Object.assign({
      issue: issue
    }, details || {}));
  }

  function getCounts_() {
    return {
      patient_photos: getPatientPhotosRaw().length
    };
  }

  function isFreezeMessage_(res) {
    return !!(
      res &&
      res.success === false &&
      String(res.message || '').indexOf('Sistem sedang dalam proses migrasi database') !== -1
    );
  }

  function isNormalFlowMessage_(res) {
    const msg = String((res && res.message) || '');

    return !!(
      res &&
      res.success === false &&
      (
        msg === 'Validasi gagal' ||
        msg === 'Hanya admin atau owner yang dapat upload foto pasien' ||
        msg === 'Photo ID tidak ditemukan' ||
        msg === 'Foto pasien tidak ditemukan' ||
        msg === 'Data pasien tidak ditemukan' ||
        msg === 'Treatment tidak ditemukan' ||
        msg.indexOf('Validasi gagal') !== -1
      )
    );
  }

  try {
    result.before_counts = getCounts_();

    if (
      result.flags.default_backend_mode !== 'spreadsheet' ||
      result.flags.ui_read_backend_mode !== 'spreadsheet' ||
      result.flags.ui_read_supabase_test_enabled !== false ||
      result.flags.supabase_staging_write_test_enabled !== false ||
      result.flags.production_mutation_freeze_enabled !== false
    ) {
      addIssue('FLAGS_NOT_SAFE_DEFAULT_OFF', result.flags);
    }

    const defaultOffCreatePhoto = createPatientPhoto({
      patient_id: '',
      treatment_id: '',
      photo_type: '',
      file_name: '',
      file_url: '',
      file_drive_id: '',
      sort_order: 0
    });

    result.messages.default_off_create_photo = defaultOffCreatePhoto && defaultOffCreatePhoto.message
      ? defaultOffCreatePhoto.message
      : '';

    result.checks.default_off_create_photo_normal_flow_reached =
      isNormalFlowMessage_(defaultOffCreatePhoto);

    if (!result.checks.default_off_create_photo_normal_flow_reached) {
      addIssue('DEFAULT_OFF_CREATE_PHOTO_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffCreatePhoto
      });
    }

    const defaultOffUploadPhoto = createPatientPhotoUpload({
      actor_role: '',
      patient_id: '',
      treatment_id: '',
      photo_type: '',
      file_name: '',
      mime_type: '',
      base64_data: ''
    });

    result.messages.default_off_upload_photo = defaultOffUploadPhoto && defaultOffUploadPhoto.message
      ? defaultOffUploadPhoto.message
      : '';

    result.checks.default_off_upload_photo_normal_flow_reached =
      isNormalFlowMessage_(defaultOffUploadPhoto);

    if (!result.checks.default_off_upload_photo_normal_flow_reached) {
      addIssue('DEFAULT_OFF_UPLOAD_PHOTO_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffUploadPhoto
      });
    }

    const defaultOffDeletePhoto = deletePatientPhoto({
      actor_role: 'owner',
      photo_id: ''
    });

    result.messages.default_off_delete_photo = defaultOffDeletePhoto && defaultOffDeletePhoto.message
      ? defaultOffDeletePhoto.message
      : '';

    result.checks.default_off_delete_photo_normal_flow_reached =
      isNormalFlowMessage_(defaultOffDeletePhoto);

    if (!result.checks.default_off_delete_photo_normal_flow_reached) {
      addIssue('DEFAULT_OFF_DELETE_PHOTO_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffDeletePhoto
      });
    }

    const simulatedFreezeCreatePhoto = createPatientPhoto({
      __test_freeze_enabled: true,
      patient_id: 'PAT-0001',
      treatment_id: 'TRX-0001',
      photo_type: 'before',
      file_name: 'SHOULD_NOT_WRITE_8B.jpg',
      file_url: 'https://example.com/should-not-write.jpg',
      file_drive_id: 'FILE-SHOULD-NOT-WRITE-8B',
      sort_order: 1
    });

    result.messages.simulated_freeze_create_photo = simulatedFreezeCreatePhoto && simulatedFreezeCreatePhoto.message
      ? simulatedFreezeCreatePhoto.message
      : '';

    result.checks.simulated_freeze_create_photo_blocked =
      isFreezeMessage_(simulatedFreezeCreatePhoto);

    if (!result.checks.simulated_freeze_create_photo_blocked) {
      addIssue('SIMULATED_FREEZE_CREATE_PHOTO_NOT_BLOCKED', {
        response: simulatedFreezeCreatePhoto
      });
    }

    const simulatedFreezeUploadPhoto = createPatientPhotoUpload({
      __test_freeze_enabled: true,
      actor_role: 'owner',
      patient_id: 'PAT-0001',
      treatment_id: 'TRX-0001',
      photo_type: 'before',
      file_name: 'SHOULD_NOT_WRITE_8B.jpg',
      mime_type: 'image/jpeg',
      base64_data: 'AAA='
    });

    result.messages.simulated_freeze_upload_photo = simulatedFreezeUploadPhoto && simulatedFreezeUploadPhoto.message
      ? simulatedFreezeUploadPhoto.message
      : '';

    result.checks.simulated_freeze_upload_photo_blocked =
      isFreezeMessage_(simulatedFreezeUploadPhoto);

    if (!result.checks.simulated_freeze_upload_photo_blocked) {
      addIssue('SIMULATED_FREEZE_UPLOAD_PHOTO_NOT_BLOCKED', {
        response: simulatedFreezeUploadPhoto
      });
    }

    const simulatedFreezeDeletePhoto = deletePatientPhoto({
      __test_freeze_enabled: true,
      actor_role: 'owner',
      photo_id: 'PHT-0001'
    });

    result.messages.simulated_freeze_delete_photo = simulatedFreezeDeletePhoto && simulatedFreezeDeletePhoto.message
      ? simulatedFreezeDeletePhoto.message
      : '';

    result.checks.simulated_freeze_delete_photo_blocked =
      isFreezeMessage_(simulatedFreezeDeletePhoto);

    if (!result.checks.simulated_freeze_delete_photo_blocked) {
      addIssue('SIMULATED_FREEZE_DELETE_PHOTO_NOT_BLOCKED', {
        response: simulatedFreezeDeletePhoto
      });
    }

    result.after_counts = getCounts_();

    result.checks.counts_unchanged =
      result.after_counts.patient_photos === result.before_counts.patient_photos;

    if (!result.checks.counts_unchanged) {
      addIssue('PATIENT_PHOTO_COUNT_CHANGED_DURING_FREEZE_GUARD_TEST', {
        before: result.before_counts,
        after: result.after_counts
      });
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8B-11-PatientPhotoService-FreezeGuard',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'PATIENT_PHOTO_FREEZE_GUARD_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}