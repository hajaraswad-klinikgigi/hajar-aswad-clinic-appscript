function formatCellValue(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  return value;
}

function isPatientActiveValue(value) {
  if (value === false) return false;
  if (value === true) return true;
  if (value === '' || value === null || value === undefined) return true;

  const normalized = String(value).trim().toLowerCase();
  return normalized !== 'false';
}

function nowIso() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function appendObject(sheetName, obj) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const row = headers.map(function(header) {
    return obj[header] !== undefined ? obj[header] : '';
  });

  sheet.appendRow(row);
}

function updateObjectById(sheetName, idFieldName, idValue, updatedObj) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  const idColIndex = headers.indexOf(idFieldName);
  if (idColIndex === -1) {
    throw new Error('Kolom ID tidak ditemukan: ' + idFieldName);
  }

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idColIndex]) === String(idValue)) {
      const updatedRow = headers.map(function(header, i) {
        return updatedObj[header] !== undefined ? updatedObj[header] : values[r][i];
      });

      sheet.getRange(r + 1, 1, 1, headers.length).setValues([updatedRow]);
      return true;
    }
  }

  return false;
}

function deleteObjectById(sheetName, idFieldName, idValue) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  const idColIndex = headers.indexOf(idFieldName);
  if (idColIndex === -1) {
    throw new Error('Kolom ID tidak ditemukan: ' + idFieldName);
  }

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idColIndex]) === String(idValue)) {
      sheet.deleteRow(r + 1);
      return true;
    }
  }

  return false;
}

/* =========================================================
   PHASE 3G - PATIENT REPOSITORY BRIDGE HELPERS
   Read-only bridge. Backend tetap Spreadsheet.
   ========================================================= */

function isPatientRepositoryBridgeAvailable_() {
  return typeof PatientRepository !== 'undefined' &&
    PatientRepository &&
    typeof PatientRepository.getPatientsRaw === 'function';
}

function getPatientServiceUiReadOptions_(options) {
  const opts = Object.assign({}, options || {});

  if (opts.backend_mode) {
    return opts;
  }

  if (typeof repoBuildUiReadOptions_ === 'function') {
    return repoBuildUiReadOptions_(opts);
  }

  return Object.assign({}, opts, {
    backend_mode: 'spreadsheet',
    ui_read_supabase_test_enabled: false
  });
}

function getPatientServiceUiReadBackendMode_(options) {
  const opts = getPatientServiceUiReadOptions_(options);
  return String(opts.backend_mode || 'spreadsheet').trim().toLowerCase();
}

function getPatientServiceSpreadsheetWriteReadOptions_() {
  return repoBuildUiReadOptions_({});
}

function getPatientsRaw(options) {
  const opts = getPatientServiceUiReadOptions_(options);

  if (
    isPatientRepositoryBridgeAvailable_() &&
    typeof PatientRepository.getPatientsRaw === 'function'
  ) {
    return PatientRepository.getPatientsRaw(opts) || [];
  }

  if (typeof dbFindAll_ === 'function') {
    return dbFindAll_(REPO_TABLES.PATIENTS || 'Patients', opts) || [];
  }

  return getRowsAsObjects('Patients') || [];
}

function normalizePatientForClient(row) {
  const obj = {};
  Object.keys(row || {}).forEach(function(key) {
    obj[key] = formatCellValue(row[key]);
  });
  return obj;
}

function getPatients(showInactiveOnly, options) {
  const rows = getPatientsRaw(options);

  const filtered = rows.filter(function(row) {
    const isActive = isPatientActiveValue(row.is_active);

    if (showInactiveOnly) {
      return !isActive;
    }

    return isActive;
  });

  const normalizedRows = filtered.map(function(row) {
    return normalizePatientForClient(row);
  });

  return normalizedRows.sort(function(a, b) {
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

function findPatientRawById(patientId, options) {
  const normalizedPatientId = String(patientId || '').trim();

  if (!normalizedPatientId) return null;

  if (
    isPatientRepositoryBridgeAvailable_() &&
    typeof PatientRepository.findPatientById === 'function'
  ) {
    return PatientRepository.findPatientById(normalizedPatientId, getPatientServiceUiReadOptions_(options)) || null;
  }

  const rows = getPatientsRaw(options);

  return rows.find(function(row) {
    return String(row.patient_id || '').trim() === normalizedPatientId;
  }) || null;
}

function generateNextPatientIdentity() {
  const rows = getPatientsRaw(getPatientServiceSpreadsheetWriteReadOptions_());

  let maxNumber = 0;

  rows.forEach(function(row) {
    const code = String(row.patient_code || '').trim();
    const match = code.match(/^RM-(\d+)$/i);

    if (!match) return;

    const num = Number(match[1]);
    if (!isNaN(num) && num > maxNumber) {
      maxNumber = num;
    }
  });

  const next = maxNumber + 1;
  const padded = String(next).padStart(4, '0');

  return {
    patient_id: generateSafeId('PAT'),
    patient_code: 'RM-' + padded
  };
}

function getPatientById(patientId, options) {
  const patient = findPatientRawById(patientId, options);

  if (!patient) {
    return {
      success: false,
      message: 'Data pasien tidak ditemukan'
    };
  }

  return {
    success: true,
    data: normalizePatientForClient(patient)
  };
}

function getMedicalRecordsByPatientId(patientId, options) {
  const normalizedPatientId = String(patientId || '').trim();
  const opts = getPatientServiceUiReadOptions_(options);

  if (!normalizedPatientId) return [];

  let rows = [];

  if (
    isPatientRepositoryBridgeAvailable_() &&
    typeof PatientRepository.listMedicalRecordsByPatientId === 'function'
  ) {
    rows = PatientRepository.listMedicalRecordsByPatientId(
      normalizedPatientId,
      opts
    ) || [];
  } else {
    rows = (getRowsAsObjects('MedicalRecords') || []).filter(function(row) {
      return String(row.patient_id || '').trim() === normalizedPatientId;
    });
  }

  const enrichedRows = typeof migration8E4C_enrichMedicalRecordRowsForClient_ === 'function'
    ? migration8E4C_enrichMedicalRecordRowsForClient_(rows, opts)
    : rows;

  return enrichedRows
    .map(function(row) {
      return normalizePatientForClient(row);
    })
    .sort(function(a, b) {
      return String(b.visit_date || '').localeCompare(String(a.visit_date || ''));
    });
}

function getTreatmentsByPatientId(patientId, options) {
  const normalizedPatientId = String(patientId || '').trim();
  const opts = getPatientServiceUiReadOptions_(options);

  if (!normalizedPatientId) return [];

  let patientTreatments = [];
  let itemsMap = {};

  if (
    isPatientRepositoryBridgeAvailable_() &&
    typeof PatientRepository.buildRawContext === 'function' &&
    typeof PatientRepository.listTreatmentsByPatientIdFromContext === 'function' &&
    typeof PatientRepository.listTreatmentItemsByTreatmentIdFromContext === 'function'
  ) {
    const ctx = PatientRepository.buildRawContext(Object.assign({}, opts, {
      only: {
        treatments: true,
        treatmentItems: true
      }
    }));

    patientTreatments = PatientRepository.listTreatmentsByPatientIdFromContext(
      ctx,
      normalizedPatientId
    );

    patientTreatments.forEach(function(row) {
      const treatmentId = String(row.treatment_id || '').trim();

      if (!treatmentId) return;

      itemsMap[treatmentId] = PatientRepository
        .listTreatmentItemsByTreatmentIdFromContext(ctx, treatmentId)
        .map(function(item) {
          return normalizePatientForClient(item);
        });
    });

  } else {
    const treatments = getRowsAsObjects('Treatments') || [];
    const items = getRowsAsObjects('TreatmentItems') || [];

    patientTreatments = treatments.filter(function(row) {
      return String(row.patient_id || '').trim() === normalizedPatientId;
    });

    const treatmentIdSet = {};
    patientTreatments.forEach(function(row) {
      treatmentIdSet[String(row.treatment_id || '').trim()] = true;
    });

    items.forEach(function(item) {
      const treatmentId = String(item.treatment_id || '').trim();

      if (!treatmentIdSet[treatmentId]) return;

      if (!itemsMap[treatmentId]) {
        itemsMap[treatmentId] = [];
      }

      itemsMap[treatmentId].push(normalizePatientForClient(item));
    });
  }

  const enrichedTreatments = typeof migration8E4C_enrichTreatmentRowsForClient_ === 'function'
    ? migration8E4C_enrichTreatmentRowsForClient_(patientTreatments, opts, {
        itemsByTreatmentId: itemsMap
      })
    : patientTreatments;

  return enrichedTreatments
    .map(function(row) {
      const normalizedTreatment = normalizePatientForClient(row);
      const treatmentId = String(row.treatment_id || '').trim();

      normalizedTreatment.items = itemsMap[treatmentId] || [];
      return normalizedTreatment;
    })
    .sort(function(a, b) {
      return String(b.treatment_date || '').localeCompare(String(a.treatment_date || ''));
    });
}

function getPatientDetailBundle(patientId) {
  const normalizedPatientId = String(patientId || '').trim();
  const readOptions = getPatientServiceUiReadOptions_();
  const readBackendMode = getPatientServiceUiReadBackendMode_(readOptions);

  if (!normalizedPatientId) {
    return {
      success: false,
      message: 'Patient ID tidak ditemukan'
    };
  }

  const cacheKey = buildCacheKey(['patientDetailBundle', readBackendMode, normalizedPatientId]);
  const cached = getCachedJson(cacheKey);

  if (cached) {
    return cached;
  }

  const patient = findPatientRawById(normalizedPatientId, readOptions);

  if (!patient) {
    return {
      success: false,
      message: 'Data pasien tidak ditemukan'
    };
  }

  const orthoRecallResult = getPatientOrthoRecallSummary(normalizedPatientId);
  const orthoRecallSummary =
    orthoRecallResult && orthoRecallResult.success && orthoRecallResult.data
      ? orthoRecallResult.data
      : {
          has_recall: false,
          has_active_program: false,
          total_records: 0,
          current: null
        };

  const result = {
    success: true,
    data: {
      patient: normalizePatientForClient(patient),
      ortho_recall: orthoRecallSummary,
      medical_records: getMedicalRecordsByPatientId(normalizedPatientId, readOptions),
      treatments: getTreatmentsByPatientId(normalizedPatientId, readOptions),
      photos: getPatientPhotosByPatientId(normalizedPatientId),
      photo_groups: groupPatientPhotosByTreatment(normalizedPatientId)
    }
  };

  putCachedJson(cacheKey, result, 20);

  return result;
}

function getPatientDetailPrimary(patientId) {
  const normalizedPatientId = String(patientId || '').trim();

  if (!normalizedPatientId) {
    return {
      success: false,
      message: 'Patient ID tidak ditemukan'
    };
  }

  const readOptions = getPatientServiceUiReadOptions_();
  const readBackendMode = getPatientServiceUiReadBackendMode_(readOptions);

  const cacheKey = buildCacheKey(['patientDetailPrimary', readBackendMode, normalizedPatientId]);
  const cached = getCachedJson(cacheKey);
  if (cached) return cached;

  const patient = findPatientRawById(normalizedPatientId, readOptions);

  if (!patient) {
    return {
      success: false,
      message: 'Data pasien tidak ditemukan'
    };
  }

  const orthoRecallResult = getPatientOrthoRecallSummary(normalizedPatientId);
  const orthoRecallSummary =
    orthoRecallResult && orthoRecallResult.success && orthoRecallResult.data
      ? orthoRecallResult.data
      : {
          has_recall: false,
          has_active_program: false,
          total_records: 0,
          current: null
        };

  const result = {
    success: true,
    data: {
      patient: normalizePatientForClient(patient),
      ortho_recall: orthoRecallSummary,
      medical_records: getMedicalRecordsByPatientId(normalizedPatientId, readOptions)
    }
  };

  putCachedJson(cacheKey, result, 20);
  return result;
}

function getPatientDetailSecondary(patientId) {
  const normalizedPatientId = String(patientId || '').trim();

  if (!normalizedPatientId) {
    return {
      success: false,
      message: 'Patient ID tidak ditemukan'
    };
  }

  const readOptions = getPatientServiceUiReadOptions_();
  const readBackendMode = getPatientServiceUiReadBackendMode_(readOptions);

  const cacheKey = buildCacheKey(['patientDetailSecondary', readBackendMode, normalizedPatientId]);
  const cached = getCachedJson(cacheKey);
  if (cached) return cached;

  const patient = findPatientRawById(normalizedPatientId, readOptions);

  if (!patient) {
    return {
      success: false,
      message: 'Data pasien tidak ditemukan'
    };
  }

  const result = {
    success: true,
    data: {
      treatments: getTreatmentsByPatientId(normalizedPatientId, readOptions),
      photos: getPatientPhotosByPatientId(normalizedPatientId),
      photo_groups: groupPatientPhotosByTreatment(normalizedPatientId)
    }
  };

  putCachedJson(cacheKey, result, 20);
  return result;
}

function clearPatientDetailBundleCache(patientId) {
  const normalizedPatientId = String(patientId || '').trim();
  if (!normalizedPatientId) return;

  const keys = [
    buildCacheKey(['patientDetailBundle', normalizedPatientId]),
    buildCacheKey(['patientDetailPrimary', normalizedPatientId]),
    buildCacheKey(['patientDetailSecondary', normalizedPatientId]),

    buildCacheKey(['patientDetailBundle', 'spreadsheet', normalizedPatientId]),
    buildCacheKey(['patientDetailPrimary', 'spreadsheet', normalizedPatientId]),
    buildCacheKey(['patientDetailSecondary', 'spreadsheet', normalizedPatientId]),

    buildCacheKey(['patientDetailBundle', 'supabase', normalizedPatientId]),
    buildCacheKey(['patientDetailPrimary', 'supabase', normalizedPatientId]),
    buildCacheKey(['patientDetailSecondary', 'supabase', normalizedPatientId])
  ];

  keys.forEach(function(key) {
    getAppCache().remove(key);
  });
}

function searchPatientsForAppointment(keyword) {
  const q = String(keyword || '').trim().toLowerCase();
  if (q.length < 2) return [];

  const rows = getPatientsRaw();

  return rows
    .filter(function(p) {
      return isPatientActiveValue(p.is_active);
    })
    .filter(function(p) {
      const fullName = String(p.full_name || '').toLowerCase();
      const patientCode = String(p.patient_code || '').toLowerCase();
      const phone = String(p.phone || '').toLowerCase();

      return fullName.includes(q) || patientCode.includes(q) || phone.includes(q);
    })
    .slice(0, 20)
    .map(function(p) {
      const hasOpenAppointment = hasOpenAppointmentForPatient(p.patient_id);

      return {
        patient_id: p.patient_id,
        patient_name: p.full_name || '',
        patient_code: p.patient_code || '',
        phone: p.phone || '',
        has_open_appointment: hasOpenAppointment
      };
    });
}

function convertDmyToYmd(value) {
  const s = String(value || '').trim();
  const match = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (!match) return s;

  return match[3] + '-' + match[2] + '-' + match[1];
}

function toTitleCase(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(function(word) {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function normalizePatientInput(data) {
  const rawBirthDate = String(data.birth_date || '').trim();

  return {
    patient_id: String(data.patient_id || '').trim(),
    full_name: toTitleCase(data.full_name),
    gender: String(data.gender || '').trim(),
    birth_date: convertDmyToYmd(rawBirthDate),
    phone: String(data.phone || '').trim(),
    email: String(data.email || '').trim().toLowerCase(),

    guardian_name: toTitleCase(data.guardian_name),
    guardian_relationship: String(data.guardian_relationship || '').trim(),
    guardian_phone: String(data.guardian_phone || '').trim(),
    guardian_email: String(data.guardian_email || '').trim().toLowerCase(),

    address: String(data.address || '').trim(),
    allergy_notes: String(data.allergy_notes || '').trim(),
    medical_notes: String(data.medical_notes || '').trim()
  };
}

function normalizePhoneForCompare(phone) {
  let digits = String(phone || '').replace(/\D/g, '');

  if (!digits) return '';

  if (digits.indexOf('0') === 0) {
    digits = '62' + digits.slice(1);
  } else if (digits.indexOf('8') === 0) {
    digits = '62' + digits;
  }

  return digits;
}

function forceSheetText(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  return "'" + s;
}

function isValidYmdDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;

  const parts = String(value).split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

function getAgeFromBirthDate(birthDateYmd) {
  if (!isValidYmdDate(birthDateYmd)) return null;

  const today = new Date();
  const parts = birthDateYmd.split('-');
  const birth = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

function isMinorPatientByBirthDate(birthDateYmd) {
  const age = getAgeFromBirthDate(birthDateYmd);
  return age !== null && age < 17;
}

function findDuplicatePatient(data, excludePatientId) {
  const rows = getPatientsRaw(getPatientServiceSpreadsheetWriteReadOptions_());

  const normalizedFullName = String(data.full_name || '').trim().toLowerCase();
  const normalizedBirthDate = String(data.birth_date || '').trim();
  const normalizedPhone = normalizePhoneForCompare(data.phone || '');
  const normalizedEmail = String(data.email || '').trim().toLowerCase();

  return rows.find(function(row) {
    if (excludePatientId && String(row.patient_id || '') === String(excludePatientId)) {
      return false;
    }

    const rowName = String(row.full_name || '').trim().toLowerCase();
    const rowBirthDate = String(formatCellValue(row.birth_date) || '').slice(0, 10);
    const rowPhone = normalizePhoneForCompare(row.phone || '');
    const rowEmail = String(row.email || '').trim().toLowerCase();

    const sameNameBirth =
      normalizedFullName &&
      normalizedBirthDate &&
      rowName === normalizedFullName &&
      rowBirthDate === normalizedBirthDate;

    const samePhone =
      normalizedPhone &&
      rowPhone &&
      rowPhone === normalizedPhone;

    const sameEmail =
      normalizedEmail &&
      rowEmail &&
      rowEmail === normalizedEmail;

    return sameNameBirth || samePhone || sameEmail;
  }) || null;
}

function validatePatientData(data, excludePatientId) {
  const cleaned = normalizePatientInput(data);
  const errors = {};

  const namePattern = /^[A-Za-zÀ-ÿ.\s']+$/;
  const phonePattern = /^[0-9+\-\s()]{6,20}$/;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!cleaned.full_name) {
    errors.full_name = 'Nama lengkap wajib diisi';
  } else if (cleaned.full_name.length < 3) {
    errors.full_name = 'Nama lengkap minimal 3 karakter';
  } else if (cleaned.full_name.length > 100) {
    errors.full_name = 'Nama lengkap maksimal 100 karakter';
  } else if (!namePattern.test(cleaned.full_name)) {
    errors.full_name = 'Nama hanya boleh berisi huruf, spasi, titik, dan apostrof';
  } else if (!/[A-Za-zÀ-ÿ]/.test(cleaned.full_name)) {
    errors.full_name = 'Nama lengkap tidak valid';
  }

  const allowedGenders = ['Laki-laki', 'Perempuan'];
  if (!cleaned.gender) {
    errors.gender = 'Gender wajib dipilih';
  } else if (allowedGenders.indexOf(cleaned.gender) === -1) {
    errors.gender = 'Gender tidak valid';
  }

  if (!cleaned.birth_date) {
    errors.birth_date = 'Tanggal lahir wajib diisi';
  } else if (!isValidYmdDate(cleaned.birth_date)) {
    errors.birth_date = 'Tanggal lahir tidak valid';
  } else {
    const todayYmd = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

    if (cleaned.birth_date > todayYmd) {
      errors.birth_date = 'Tanggal lahir tidak boleh di masa depan';
    } else {
      const age = getAgeFromBirthDate(cleaned.birth_date);
      if (age !== null && age > 120) {
        errors.birth_date = 'Umur pasien tidak valid';
      }
    }
  }

  const isMinor = isMinorPatientByBirthDate(cleaned.birth_date);

  // ===== Kontak pasien =====
  if (isMinor) {
    if (cleaned.phone && !phonePattern.test(cleaned.phone)) {
      errors.phone = 'Format nomor HP tidak valid';
    }

    if (cleaned.email && !emailPattern.test(cleaned.email)) {
      errors.email = 'Format email tidak valid';
    }
  } else {
    if (!cleaned.phone) {
      errors.phone = 'Nomor HP wajib diisi';
    } else if (!phonePattern.test(cleaned.phone)) {
      errors.phone = 'Format nomor HP tidak valid';
    }

    if (!cleaned.email) {
      errors.email = 'Email wajib diisi';
    } else if (!emailPattern.test(cleaned.email)) {
      errors.email = 'Format email tidak valid';
    }
  }

  // ===== Data wali =====
  if (isMinor) {
    if (!cleaned.guardian_name) {
      errors.guardian_name = 'Nama wali wajib diisi untuk pasien di bawah 17 tahun';
    } else if (cleaned.guardian_name.length < 3) {
      errors.guardian_name = 'Nama wali minimal 3 karakter';
    } else if (cleaned.guardian_name.length > 100) {
      errors.guardian_name = 'Nama wali maksimal 100 karakter';
    } else if (!namePattern.test(cleaned.guardian_name)) {
      errors.guardian_name = 'Nama wali hanya boleh berisi huruf, spasi, titik, dan apostrof';
    }

    if (!cleaned.guardian_relationship) {
      errors.guardian_relationship = 'Hubungan wali wajib diisi untuk pasien di bawah 17 tahun';
    } else if (cleaned.guardian_relationship.length > 50) {
      errors.guardian_relationship = 'Hubungan wali maksimal 50 karakter';
    }

    if (!cleaned.guardian_phone) {
      errors.guardian_phone = 'Nomor HP wali wajib diisi untuk pasien di bawah 17 tahun';
    } else if (!phonePattern.test(cleaned.guardian_phone)) {
      errors.guardian_phone = 'Format nomor HP wali tidak valid';
    }
    if (!cleaned.guardian_email) {
      errors.guardian_email = 'Email wali wajib diisi untuk pasien di bawah 17 tahun';
    } else if (!emailPattern.test(cleaned.guardian_email)) {
      errors.guardian_email = 'Format email wali tidak valid';
    }
  } else {
    if (cleaned.guardian_name) {
      if (cleaned.guardian_name.length < 3) {
        errors.guardian_name = 'Nama wali minimal 3 karakter';
      } else if (cleaned.guardian_name.length > 100) {
        errors.guardian_name = 'Nama wali maksimal 100 karakter';
      } else if (!namePattern.test(cleaned.guardian_name)) {
        errors.guardian_name = 'Nama wali hanya boleh berisi huruf, spasi, titik, dan apostrof';
      }
    }

    if (cleaned.guardian_relationship && cleaned.guardian_relationship.length > 50) {
      errors.guardian_relationship = 'Hubungan wali maksimal 50 karakter';
    }

    if (cleaned.guardian_phone && !phonePattern.test(cleaned.guardian_phone)) {
      errors.guardian_phone = 'Format nomor HP wali tidak valid';
    }
  }

  if (!isMinor && cleaned.guardian_email && !emailPattern.test(cleaned.guardian_email)) {
    errors.guardian_email = 'Format email wali tidak valid';
  }

  if (!cleaned.address) {
    errors.address = 'Alamat wajib diisi';
  } else if (cleaned.address.length > 255) {
    errors.address = 'Alamat maksimal 255 karakter';
  }

  if (cleaned.allergy_notes && cleaned.allergy_notes.length > 500) {
    errors.allergy_notes = 'Catatan alergi maksimal 500 karakter';
  }

  if (cleaned.medical_notes && cleaned.medical_notes.length > 500) {
    errors.medical_notes = 'Catatan medis maksimal 500 karakter';
  }

  // ===== Duplicate pasien tetap pakai kontak pasien, bukan kontak wali =====
  if (Object.keys(errors).length === 0) {
    const duplicate = findDuplicatePatient(cleaned, excludePatientId);

    if (duplicate) {
      const cleanedPhone = normalizePhoneForCompare(cleaned.phone || '');
      const duplicatePhone = normalizePhoneForCompare(duplicate.phone || '');

      if (cleanedPhone && duplicatePhone && cleanedPhone === duplicatePhone) {
        errors.phone = 'Nomor HP sudah digunakan pasien lain';
      }

      if (
        cleaned.email &&
        String(duplicate.email || '').trim().toLowerCase() === cleaned.email
      ) {
        errors.email = 'Email sudah digunakan pasien lain';
      }

      const duplicateBirthDate = String(formatCellValue(duplicate.birth_date) || '').slice(0, 10);
      if (
        String(duplicate.full_name || '').trim().toLowerCase() === cleaned.full_name.toLowerCase() &&
        duplicateBirthDate === cleaned.birth_date
      ) {
        errors.full_name = 'Pasien dengan nama dan tanggal lahir ini sudah ada';
      }
    }
  }

  return {
    cleaned: cleaned,
    errors: errors
  };
}

function createPatient(data) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'CREATE_PATIENT',
    module: 'PatientService',
    action: 'createPatient',
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

    const validation = validatePatientData(data);
    const cleaned = validation.cleaned;
    const errors = validation.errors;

    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        message: 'Validasi gagal',
        errors: errors
      };
    }

    // duplicate check aman di dalam lock
    const duplicate = findDuplicatePatient(cleaned);
    if (duplicate) {
      const duplicateErrors = {};

      const cleanedPhone = normalizePhoneForCompare(cleaned.phone || '');
      const duplicatePhone = normalizePhoneForCompare(duplicate.phone || '');

      if (cleanedPhone && duplicatePhone && cleanedPhone === duplicatePhone) {
        duplicateErrors.phone = 'Nomor HP sudah digunakan pasien lain';
      }

      if (
        cleaned.email &&
        String(duplicate.email || '').trim().toLowerCase() === cleaned.email
      ) {
        duplicateErrors.email = 'Email sudah digunakan pasien lain';
      }

      const duplicateBirthDate = String(formatCellValue(duplicate.birth_date) || '').slice(0, 10);
      if (
        String(duplicate.full_name || '').trim().toLowerCase() === cleaned.full_name.toLowerCase() &&
        duplicateBirthDate === cleaned.birth_date
      ) {
        duplicateErrors.full_name = 'Pasien dengan nama dan tanggal lahir ini sudah ada';
      }

      return {
        success: false,
        message: 'Validasi gagal',
        errors: duplicateErrors
      };
    }

    const identity = generateNextPatientIdentity();

    const patient = {
      patient_id: identity.patient_id,
      patient_code: identity.patient_code,
      full_name: cleaned.full_name,
      gender: cleaned.gender,
      birth_date: cleaned.birth_date || '',
      phone: forceSheetText(cleaned.phone),
      email: cleaned.email,

      guardian_name: cleaned.guardian_name,
      guardian_relationship: cleaned.guardian_relationship,
      guardian_phone: forceSheetText(cleaned.guardian_phone),
      guardian_email: cleaned.guardian_email,

      address: cleaned.address,
      allergy_notes: cleaned.allergy_notes,
      medical_notes: cleaned.medical_notes,
      first_clinic_id: '',
      is_active: true,
      created_at: nowIso(),
      updated_at: nowIso()
    };

    dbInsert_('Patients', patient);

    return {
      success: true,
      message: 'Pasien berhasil ditambahkan',
      data: normalizePatientForClient(patient)
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat menambahkan pasien'
    };
  } finally {
    lock.releaseLock();
  }
}

function updatePatient(data) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'UPDATE_PATIENT',
    module: 'PatientService',
    action: 'updatePatient',
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

    if (!data.patient_id) {
      return {
        success: false,
        message: 'Patient ID tidak ditemukan'
      };
    }

    const existing = findPatientRawById(
      data.patient_id,
      getPatientServiceSpreadsheetWriteReadOptions_()
    );

    if (!existing) {
      return {
        success: false,
        message: 'Data pasien tidak ditemukan'
      };
    }

    const validation = validatePatientData(data, data.patient_id);
    const cleaned = validation.cleaned;
    const errors = validation.errors;

    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        message: 'Validasi gagal',
        errors: errors
      };
    }

    // duplicate check aman di dalam lock
    const duplicate = findDuplicatePatient(cleaned, data.patient_id);
    if (duplicate) {
      const duplicateErrors = {};

      const cleanedPhone = normalizePhoneForCompare(cleaned.phone || '');
      const duplicatePhone = normalizePhoneForCompare(duplicate.phone || '');

      if (cleanedPhone && duplicatePhone && cleanedPhone === duplicatePhone) {
        duplicateErrors.phone = 'Nomor HP sudah digunakan pasien lain';
      }

      if (
        cleaned.email &&
        String(duplicate.email || '').trim().toLowerCase() === cleaned.email
      ) {
        duplicateErrors.email = 'Email sudah digunakan pasien lain';
      }

      const duplicateBirthDate = String(formatCellValue(duplicate.birth_date) || '').slice(0, 10);
      if (
        String(duplicate.full_name || '').trim().toLowerCase() === cleaned.full_name.toLowerCase() &&
        duplicateBirthDate === cleaned.birth_date
      ) {
        duplicateErrors.full_name = 'Pasien dengan nama dan tanggal lahir ini sudah ada';
      }

      return {
        success: false,
        message: 'Validasi gagal',
        errors: duplicateErrors
      };
    }

    const updated = {
      patient_id: existing.patient_id,
      patient_code: existing.patient_code,
      full_name: cleaned.full_name,
      gender: cleaned.gender,
      birth_date: cleaned.birth_date || '',
      phone: forceSheetText(cleaned.phone),
      email: cleaned.email,

      guardian_name: cleaned.guardian_name,
      guardian_relationship: cleaned.guardian_relationship,
      guardian_phone: forceSheetText(cleaned.guardian_phone),
      guardian_email: cleaned.guardian_email,

      address: cleaned.address,
      allergy_notes: cleaned.allergy_notes,
      medical_notes: cleaned.medical_notes,
      first_clinic_id: existing.first_clinic_id || '',
      is_active: isPatientActiveValue(existing.is_active),
      created_at: formatCellValue(existing.created_at || ''),
      updated_at: nowIso()
    };

    const ok = dbUpdateById_('Patients', 'patient_id', data.patient_id, updated);

    if (!ok) {
      return {
        success: false,
        message: 'Gagal memperbarui data pasien'
      };
    }

    clearPatientDetailBundleCache(data.patient_id);

    return {
      success: true,
      message: 'Data pasien berhasil diperbarui',
      data: normalizePatientForClient(updated)
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat memperbarui data pasien'
    };
  } finally {
    lock.releaseLock();
  }
}

function deactivatePatient(patientId) {
  if (!patientId) {
    return {
      success: false,
      message: 'Patient ID tidak ditemukan'
    };
  }

  const existing = findPatientRawById(
    patientId,
    getPatientServiceSpreadsheetWriteReadOptions_()
  );

  if (!existing) {
    return {
      success: false,
      message: 'Data pasien tidak ditemukan'
    };
  }

  if (!isPatientActiveValue(existing.is_active)) {
    return {
      success: false,
      message: 'Pasien sudah nonaktif'
    };
  }

  const ok = dbUpdateById_('Patients', 'patient_id', patientId, {
    is_active: false,
    updated_at: nowIso()
  });

  if (!ok) {
    return {
      success: false,
      message: 'Gagal menonaktifkan pasien'
    };
  }

  clearPatientDetailBundleCache(patientId);

  return {
    success: true,
    message: 'Pasien berhasil dinonaktifkan'
  };
}

/* =========================================================
   PHASE 3G MANUAL TESTS
   PatientService read-only -> PatientRepository bridge
   Read-only. Aman dijalankan.
   ========================================================= */

function testPatientServicePhase3GReadOnlyBridge() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    sample: {},
    counts: {}
  };

  try {
    if (
      typeof PatientRepository === 'undefined' ||
      !PatientRepository
    ) {
      result.issues.push({
        issue: 'PATIENT_REPOSITORY_NOT_FOUND'
      });

      result.issue_count = result.issues.length;
      result.success = false;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const wrapperPatients = getPatientsRaw();
    const repoPatients = PatientRepository.getPatientsRaw();

    result.counts.wrapper_patients = Array.isArray(wrapperPatients) ? wrapperPatients.length : -1;
    result.counts.repository_patients = Array.isArray(repoPatients) ? repoPatients.length : -1;

    if (!Array.isArray(wrapperPatients)) {
      result.issues.push({
        issue: 'WRAPPER_PATIENTS_NOT_ARRAY'
      });
    }

    if (!Array.isArray(repoPatients)) {
      result.issues.push({
        issue: 'REPOSITORY_PATIENTS_NOT_ARRAY'
      });
    }

    if (result.counts.wrapper_patients !== result.counts.repository_patients) {
      result.issues.push({
        wrapper_count: result.counts.wrapper_patients,
        repository_count: result.counts.repository_patients,
        issue: 'PATIENT_COUNT_MISMATCH'
      });
    }

    const firstPatient = wrapperPatients.length ? wrapperPatients[0] : null;
    const patientId = firstPatient
      ? String(firstPatient.patient_id || '').trim()
      : '';

    result.sample.first_patient_id = patientId;

    if (!patientId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada pasien untuk sample bridge test';

      result.issue_count = result.issues.length;
      result.success = result.issue_count === 0;

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    const wrapperPatient = findPatientRawById(patientId);
    const repoPatient = PatientRepository.findPatientById(patientId);

    result.sample.wrapper_find_patient_ok = !!wrapperPatient;
    result.sample.repository_find_patient_ok = !!repoPatient;

    if (!wrapperPatient || !repoPatient) {
      result.issues.push({
        patient_id: patientId,
        issue: 'FIND_PATIENT_FAILED'
      });
    }

    const wrapperMedicalRecords = getMedicalRecordsByPatientId(patientId);
    const repoMedicalRecords = PatientRepository.listMedicalRecordsByPatientId(patientId);

    const wrapperTreatments = getTreatmentsByPatientId(patientId);
    const repoTreatments = PatientRepository.listTreatmentsByPatientId(patientId);

    result.sample.wrapper_medical_record_count = wrapperMedicalRecords.length;
    result.sample.repository_medical_record_count = repoMedicalRecords.length;
    result.sample.wrapper_treatment_count = wrapperTreatments.length;
    result.sample.repository_treatment_count = repoTreatments.length;

    if (wrapperMedicalRecords.length !== repoMedicalRecords.length) {
      result.issues.push({
        patient_id: patientId,
        wrapper_count: wrapperMedicalRecords.length,
        repository_count: repoMedicalRecords.length,
        issue: 'MEDICAL_RECORD_COUNT_MISMATCH'
      });
    }

    if (wrapperTreatments.length !== repoTreatments.length) {
      result.issues.push({
        patient_id: patientId,
        wrapper_count: wrapperTreatments.length,
        repository_count: repoTreatments.length,
        issue: 'TREATMENT_COUNT_MISMATCH'
      });
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testPatientServicePhase3GDetailEndpointSample() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    sample: {}
  };

  try {
    const patients = getPatientsRaw();
    const firstPatient = patients.length ? patients[0] : null;
    const patientId = firstPatient
      ? String(firstPatient.patient_id || '').trim()
      : '';

    result.sample.patient_count = patients.length;
    result.sample.first_patient_id = patientId;

    if (!patientId) {
      result.sample.skipped = true;
      result.sample.reason = 'Belum ada pasien untuk detail endpoint test';

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    }

    clearPatientDetailBundleCache(patientId);

    const byId = getPatientById(patientId);
    const primary = getPatientDetailPrimary(patientId);
    const secondary = getPatientDetailSecondary(patientId);
    const bundle = getPatientDetailBundle(patientId);

    result.sample.get_patient_by_id_ok = !!(byId && byId.success && byId.data);
    result.sample.primary_ok = !!(primary && primary.success && primary.data && primary.data.patient);
    result.sample.secondary_ok = !!(secondary && secondary.success && secondary.data);
    result.sample.bundle_ok = !!(bundle && bundle.success && bundle.data && bundle.data.patient);

    result.sample.primary_medical_record_count =
      primary && primary.data && Array.isArray(primary.data.medical_records)
        ? primary.data.medical_records.length
        : -1;

    result.sample.secondary_treatment_count =
      secondary && secondary.data && Array.isArray(secondary.data.treatments)
        ? secondary.data.treatments.length
        : -1;

    result.sample.bundle_treatment_count =
      bundle && bundle.data && Array.isArray(bundle.data.treatments)
        ? bundle.data.treatments.length
        : -1;

    if (!result.sample.get_patient_by_id_ok) {
      result.issues.push({
        patient_id: patientId,
        endpoint: 'getPatientById',
        issue: 'GET_PATIENT_BY_ID_FAILED'
      });
    }

    if (!result.sample.primary_ok) {
      result.issues.push({
        patient_id: patientId,
        endpoint: 'getPatientDetailPrimary',
        issue: 'GET_PATIENT_DETAIL_PRIMARY_FAILED'
      });
    }

    if (!result.sample.secondary_ok) {
      result.issues.push({
        patient_id: patientId,
        endpoint: 'getPatientDetailSecondary',
        issue: 'GET_PATIENT_DETAIL_SECONDARY_FAILED'
      });
    }

    if (!result.sample.bundle_ok) {
      result.issues.push({
        patient_id: patientId,
        endpoint: 'getPatientDetailBundle',
        issue: 'GET_PATIENT_DETAIL_BUNDLE_FAILED'
      });
    }

    if (
      result.sample.secondary_treatment_count >= 0 &&
      result.sample.bundle_treatment_count >= 0 &&
      result.sample.secondary_treatment_count !== result.sample.bundle_treatment_count
    ) {
      result.issues.push({
        patient_id: patientId,
        secondary_treatment_count: result.sample.secondary_treatment_count,
        bundle_treatment_count: result.sample.bundle_treatment_count,
        issue: 'SECONDARY_BUNDLE_TREATMENT_COUNT_MISMATCH'
      });
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testPatientServicePhase3GRegressionPack() {
  const result = {
    success: true,
    backend_mode: typeof dbGetBackendMode_ === 'function'
      ? dbGetBackendMode_()
      : '',
    checked_at: typeof nowIso === 'function'
      ? nowIso()
      : new Date().toISOString(),
    issue_count: 0,
    issues: [],
    tests: []
  };

  try {
    const testList = [
      {
        name: 'testPatientRepositoryPhase3FReadOnly',
        fn: typeof testPatientRepositoryPhase3FReadOnly === 'function'
          ? testPatientRepositoryPhase3FReadOnly
          : null
      },
      {
        name: 'testPatientRepositoryPhase3FBuildRawContext',
        fn: typeof testPatientRepositoryPhase3FBuildRawContext === 'function'
          ? testPatientRepositoryPhase3FBuildRawContext
          : null
      },
      {
        name: 'testPatientRepositoryPhase3FFindPatientSample',
        fn: typeof testPatientRepositoryPhase3FFindPatientSample === 'function'
          ? testPatientRepositoryPhase3FFindPatientSample
          : null
      },
      {
        name: 'testPatientRepositoryPhase3FContextFinderSample',
        fn: typeof testPatientRepositoryPhase3FContextFinderSample === 'function'
          ? testPatientRepositoryPhase3FContextFinderSample
          : null
      },
      {
        name: 'testPatientServicePhase3GReadOnlyBridge',
        fn: typeof testPatientServicePhase3GReadOnlyBridge === 'function'
          ? testPatientServicePhase3GReadOnlyBridge
          : null
      },
      {
        name: 'testPatientServicePhase3GDetailEndpointSample',
        fn: typeof testPatientServicePhase3GDetailEndpointSample === 'function'
          ? testPatientServicePhase3GDetailEndpointSample
          : null
      }
    ];

    testList.forEach(function(item) {
      if (!item.fn) {
        result.tests.push({
          name: item.name,
          success: false,
          issue: 'TEST_FUNCTION_NOT_FOUND'
        });

        result.issues.push({
          test: item.name,
          issue: 'TEST_FUNCTION_NOT_FOUND'
        });

        return;
      }

      const testResult = item.fn();
      const success = !!(testResult && testResult.success === true);
      const issueCount = testResult && testResult.issue_count !== undefined
        ? Number(testResult.issue_count || 0)
        : (success ? 0 : 1);

      result.tests.push({
        name: item.name,
        success: success,
        issue_count: issueCount
      });

      if (!success || issueCount > 0) {
        result.issues.push({
          test: item.name,
          success: success,
          issue_count: issueCount,
          issue: 'REGRESSION_TEST_FAILED'
        });
      }
    });

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testPatientServicePhase6GUiReadLog() {
  const result = {
    success: true,
    stage: '6G-PatientService',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    ui_read_backend_mode: getPatientServiceUiReadBackendMode_(),
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : false,
    issue_count: 0,
    issues: [],
    probe: {}
  };

  try {
    const opts = getPatientServiceUiReadOptions_();

    const patients = getPatientsRaw(opts);
    const activePatients = getPatients(false, opts);
    const inactivePatients = getPatients(true, opts);

    result.probe.patient_count = Array.isArray(patients) ? patients.length : -1;
    result.probe.active_patient_count = Array.isArray(activePatients) ? activePatients.length : -1;
    result.probe.inactive_patient_count = Array.isArray(inactivePatients) ? inactivePatients.length : -1;

    if (!Array.isArray(patients)) {
      result.issues.push({
        issue: 'PATIENTS_NOT_ARRAY'
      });
    }

    const firstPatient = patients.length ? patients[0] : null;
    const patientId = firstPatient ? String(firstPatient.patient_id || '').trim() : '';

    result.probe.first_patient_id = patientId;

    if (!patientId) {
      result.issues.push({
        issue: 'NO_PATIENT_SAMPLE_AVAILABLE'
      });
    }

    if (patientId) {
      clearPatientDetailBundleCache(patientId);

      const byId = getPatientById(patientId, opts);
      const medicalRecords = getMedicalRecordsByPatientId(patientId, opts);
      const treatments = getTreatmentsByPatientId(patientId, opts);
      const primary = getPatientDetailPrimary(patientId);
      const secondary = getPatientDetailSecondary(patientId);

      result.probe.by_id_success = !!(byId && byId.success);
      result.probe.medical_record_count = Array.isArray(medicalRecords) ? medicalRecords.length : -1;
      result.probe.treatment_count = Array.isArray(treatments) ? treatments.length : -1;
      result.probe.primary_success = !!(primary && primary.success);
      result.probe.secondary_success = !!(secondary && secondary.success);

      if (!byId || !byId.success) {
        result.issues.push({
          patient_id: patientId,
          issue: 'GET_PATIENT_BY_ID_FAILED'
        });
      }

      if (!Array.isArray(medicalRecords)) {
        result.issues.push({
          patient_id: patientId,
          issue: 'MEDICAL_RECORDS_NOT_ARRAY'
        });
      }

      if (!Array.isArray(treatments)) {
        result.issues.push({
          patient_id: patientId,
          issue: 'TREATMENTS_NOT_ARRAY'
        });
      }

      if (!primary || !primary.success) {
        result.issues.push({
          patient_id: patientId,
          issue: 'PATIENT_DETAIL_PRIMARY_FAILED'
        });
      }

      if (!secondary || !secondary.success) {
        result.issues.push({
          patient_id: patientId,
          issue: 'PATIENT_DETAIL_SECONDARY_FAILED'
        });
      }
    }

    let supabaseWriteBlocked = false;
    let supabaseWriteMessage = '';

    try {
      dbInsert_(REPO_TABLES.PATIENTS, {
        patient_id: 'TEST-SHOULD-NOT-INSERT'
      }, {
        backend_mode: 'supabase'
      });
    } catch (errWrite) {
      supabaseWriteBlocked = true;
      supabaseWriteMessage = errWrite && errWrite.message ? errWrite.message : String(errWrite || '');
    }

    if (!supabaseWriteBlocked) {
      result.issues.push({
        issue: 'SUPABASE_WRITE_NOT_BLOCKED'
      });
    }

    result.supabase_write_guard = {
      blocked: supabaseWriteBlocked,
      message: supabaseWriteMessage
    };

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '6G-PatientService',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testCutoverPhase8BPatientFreezeGuardLog() {
  const result = {
    success: true,
    stage: '8B-3-PatientService-FreezeGuard',
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
      default_off_create_validation_reached: false,
      default_off_update_validation_reached: false,
      simulated_freeze_create_blocked: false,
      simulated_freeze_update_blocked: false,
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

  function getPatientCount_() {
    return getPatientsRaw({
      backend_mode: 'spreadsheet'
    }).length;
  }

  try {
    result.before_counts.patients = getPatientCount_();

    if (
      result.flags.default_backend_mode !== 'spreadsheet' ||
      result.flags.ui_read_backend_mode !== 'spreadsheet' ||
      result.flags.ui_read_supabase_test_enabled !== false ||
      result.flags.supabase_staging_write_test_enabled !== false ||
      result.flags.production_mutation_freeze_enabled !== false
    ) {
      addIssue('FLAGS_NOT_SAFE_DEFAULT_OFF', result.flags);
    }

    const defaultOffCreate = createPatient({
      full_name: '',
      gender: '',
      birth_date: '',
      phone: '',
      email: '',
      address: ''
    });

    result.messages.default_off_create = defaultOffCreate && defaultOffCreate.message
      ? defaultOffCreate.message
      : '';

    result.checks.default_off_create_validation_reached = !!(
      defaultOffCreate &&
      defaultOffCreate.success === false &&
      defaultOffCreate.message === 'Validasi gagal'
    );

    if (!result.checks.default_off_create_validation_reached) {
      addIssue('DEFAULT_OFF_CREATE_DID_NOT_REACH_VALIDATION', {
        response: defaultOffCreate
      });
    }

    const defaultOffUpdate = updatePatient({
      patient_id: '',
      full_name: '',
      gender: '',
      birth_date: '',
      phone: '',
      email: '',
      address: ''
    });

    result.messages.default_off_update = defaultOffUpdate && defaultOffUpdate.message
      ? defaultOffUpdate.message
      : '';

    result.checks.default_off_update_validation_reached = !!(
      defaultOffUpdate &&
      defaultOffUpdate.success === false &&
      (
        defaultOffUpdate.message === 'Validasi gagal' ||
        defaultOffUpdate.message === 'Patient ID tidak ditemukan' ||
        defaultOffUpdate.message === 'Data pasien tidak ditemukan'
      )
    );

    if (!result.checks.default_off_update_validation_reached) {
      addIssue('DEFAULT_OFF_UPDATE_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffUpdate
      });
    }

    const simulatedFreezeCreate = createPatient({
      __test_freeze_enabled: true,
      full_name: '',
      gender: '',
      birth_date: '',
      phone: '',
      email: '',
      address: ''
    });

    result.messages.simulated_freeze_create = simulatedFreezeCreate && simulatedFreezeCreate.message
      ? simulatedFreezeCreate.message
      : '';

    result.checks.simulated_freeze_create_blocked = !!(
      simulatedFreezeCreate &&
      simulatedFreezeCreate.success === false &&
      String(simulatedFreezeCreate.message || '').indexOf('Sistem sedang dalam proses migrasi database') !== -1
    );

    if (!result.checks.simulated_freeze_create_blocked) {
      addIssue('SIMULATED_FREEZE_CREATE_NOT_BLOCKED', {
        response: simulatedFreezeCreate
      });
    }

    const simulatedFreezeUpdate = updatePatient({
      __test_freeze_enabled: true,
      patient_id: 'PAT-0001',
      full_name: 'SHOULD NOT UPDATE',
      gender: 'Laki-laki',
      birth_date: '2000-01-01',
      phone: '08123456789',
      email: 'test@example.com',
      address: 'SHOULD NOT UPDATE'
    });

    result.messages.simulated_freeze_update = simulatedFreezeUpdate && simulatedFreezeUpdate.message
      ? simulatedFreezeUpdate.message
      : '';

    result.checks.simulated_freeze_update_blocked = !!(
      simulatedFreezeUpdate &&
      simulatedFreezeUpdate.success === false &&
      String(simulatedFreezeUpdate.message || '').indexOf('Sistem sedang dalam proses migrasi database') !== -1
    );

    if (!result.checks.simulated_freeze_update_blocked) {
      addIssue('SIMULATED_FREEZE_UPDATE_NOT_BLOCKED', {
        response: simulatedFreezeUpdate
      });
    }

    result.after_counts.patients = getPatientCount_();

    result.checks.counts_unchanged = result.after_counts.patients === result.before_counts.patients;

    if (!result.checks.counts_unchanged) {
      addIssue('PATIENT_COUNT_CHANGED_DURING_FREEZE_GUARD_TEST', {
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
      stage: '8B-3-PatientService-FreezeGuard',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'PATIENT_FREEZE_GUARD_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}