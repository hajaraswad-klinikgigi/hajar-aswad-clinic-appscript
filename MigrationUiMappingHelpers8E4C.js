/* =========================================================
   8E-4C — SUPABASE UI MAPPING HELPERS
   Read-only enrichment only.
   Tidak menulis data, tidak membuka freeze.
   ========================================================= */

function migration8E4C_str_(value) {
  return String(value || '').trim();
}

function migration8E4C_num_(value) {
  const n = Number(value || 0);
  return isNaN(n) ? 0 : n;
}

function migration8E4C_clone_(row) {
  return Object.assign({}, row || {});
}

function migration8E4C_indexBy_(rows, key) {
  const map = {};

  (rows || []).forEach(function(row) {
    const id = migration8E4C_str_(row && row[key]);
    if (id) map[id] = row;
  });

  return map;
}

function migration8E4C_getUiReadOptions_(options) {
  const opts = Object.assign({}, options || {});

  if (opts.backend_mode) {
    return opts;
  }

  if (typeof repoBuildUiReadOptions_ === 'function') {
    return repoBuildUiReadOptions_(opts);
  }

  return Object.assign({}, opts, {
    backend_mode: 'supabase'
  });
}

function migration8E4C_fetchRows_(tableName, options) {
  try {
    if (typeof dbFindAll_ === 'function') {
      return dbFindAll_(tableName, options) || [];
    }
  } catch (err) {}

  return [];
}

function migration8E4C_getPatientMap_(options) {
  const opts = migration8E4C_getUiReadOptions_(options);

  const rows = migration8E4C_fetchRows_(
    REPO_TABLES.PATIENTS || 'Patients',
    opts
  );

  return migration8E4C_indexBy_(rows, 'patient_id');
}

function migration8E4C_getUserMap_(options) {
  const opts = migration8E4C_getUiReadOptions_(options);

  const rows = migration8E4C_fetchRows_(
    REPO_TABLES.USERS || 'Users',
    opts
  );

  return migration8E4C_indexBy_(rows, 'user_id');
}

function migration8E4C_getTreatmentMap_(options) {
  const opts = migration8E4C_getUiReadOptions_(options);

  const rows = migration8E4C_fetchRows_(
    REPO_TABLES.TREATMENTS || 'Treatments',
    opts
  );

  return migration8E4C_indexBy_(rows, 'treatment_id');
}

function migration8E4C_getTreatmentItemsByTreatmentId_(options) {
  const opts = migration8E4C_getUiReadOptions_(options);

  const rows = migration8E4C_fetchRows_(
    REPO_TABLES.TREATMENT_ITEMS || 'TreatmentItems',
    opts
  );

  const map = {};

  rows.forEach(function(item) {
    const treatmentId = migration8E4C_str_(item.treatment_id);
    if (!treatmentId) return;

    if (!map[treatmentId]) {
      map[treatmentId] = [];
    }

    map[treatmentId].push(item);
  });

  return map;
}

function migration8E4C_pickDoctorUserId_(row) {
  return migration8E4C_str_(
    row.doctor_user_id ||
    row.doctor_id ||
    row.user_id ||
    ''
  );
}

function migration8E4C_sumTreatmentItemsSubtotal_(items) {
  return (items || []).reduce(function(sum, item) {
    return sum + migration8E4C_num_(item.subtotal);
  }, 0);
}

function migration8E4C_enrichAppointmentRowForClient_(row, options, patientMap) {
  const out = migration8E4C_clone_(row);
  const patients = patientMap || migration8E4C_getPatientMap_(options);

  const patientId = migration8E4C_str_(out.patient_id);
  const patient = patientId ? patients[patientId] : null;

  if (!migration8E4C_str_(out.patient_name) && patient) {
    out.patient_name = migration8E4C_str_(patient.full_name);
  }

  return out;
}

function migration8E4C_enrichAppointmentRowsForClient_(rows, options) {
  const patients = migration8E4C_getPatientMap_(options);

  return (rows || []).map(function(row) {
    return migration8E4C_enrichAppointmentRowForClient_(row, options, patients);
  });
}

function migration8E4C_enrichOrthoRecallRowForClient_(row, options, patientMap) {
  const out = migration8E4C_clone_(row);
  const patients = patientMap || migration8E4C_getPatientMap_(options);

  const patientId = migration8E4C_str_(out.patient_id);
  const patient = patientId ? patients[patientId] : null;

  if (!migration8E4C_str_(out.patient_name) && patient) {
    out.patient_name = migration8E4C_str_(patient.full_name);
  }

  if (!migration8E4C_str_(out.phone) && patient) {
    out.phone = migration8E4C_str_(patient.phone);
  }

  if (typeof normalizeRecallPhoneDisplay === 'function') {
    out.phone = normalizeRecallPhoneDisplay(out.phone);
  }

  return out;
}

function migration8E4C_enrichOrthoRecallRowsForClient_(rows, options) {
  const patients = migration8E4C_getPatientMap_(options);

  return (rows || []).map(function(row) {
    return migration8E4C_enrichOrthoRecallRowForClient_(row, options, patients);
  });
}

function migration8E4C_buildTreatmentEnrichmentContext_(options, partialContext) {
  const ctx = partialContext || {};

  if (!ctx.patientMap) {
    ctx.patientMap = migration8E4C_getPatientMap_(options);
  }

  if (!ctx.userMap) {
    ctx.userMap = migration8E4C_getUserMap_(options);
  }

  if (!ctx.itemsByTreatmentId) {
    ctx.itemsByTreatmentId = migration8E4C_getTreatmentItemsByTreatmentId_(options);
  }

  return ctx;
}

function migration8E4C_enrichTreatmentRowForClient_(row, options, context) {
  const out = migration8E4C_clone_(row);
  const ctx = migration8E4C_buildTreatmentEnrichmentContext_(options, context);

  const patientId = migration8E4C_str_(out.patient_id);
  const patient = patientId ? ctx.patientMap[patientId] : null;

  if (!migration8E4C_str_(out.patient_name) && patient) {
    out.patient_name = migration8E4C_str_(patient.full_name);
  }

  const doctorUserId = migration8E4C_pickDoctorUserId_(out);
  const doctor = doctorUserId ? ctx.userMap[doctorUserId] : null;

  if (!migration8E4C_str_(out.doctor_name) && doctor) {
    out.doctor_name = migration8E4C_str_(doctor.full_name);
  }

  const treatmentId = migration8E4C_str_(out.treatment_id);
  const items = treatmentId ? (ctx.itemsByTreatmentId[treatmentId] || []) : [];
  const itemSubtotal = migration8E4C_sumTreatmentItemsSubtotal_(items);

  const currentTotal = migration8E4C_num_(
    out.total_cost ||
    out.total_biaya ||
    out.grand_total ||
    0
  );

  if (currentTotal === 0 && itemSubtotal > 0) {
    out.total_cost = itemSubtotal;
    out.total_biaya = itemSubtotal;
  }

  return out;
}

function migration8E4C_enrichTreatmentRowsForClient_(rows, options, context) {
  const ctx = migration8E4C_buildTreatmentEnrichmentContext_(options, context);

  return (rows || []).map(function(row) {
    return migration8E4C_enrichTreatmentRowForClient_(row, options, ctx);
  });
}

function migration8E4C_enrichMedicalRecordRowForClient_(row, options, context) {
  const out = migration8E4C_clone_(row);
  const ctx = context || {};

  if (!ctx.treatmentMap) {
    ctx.treatmentMap = migration8E4C_getTreatmentMap_(options);
  }

  if (!ctx.userMap) {
    ctx.userMap = migration8E4C_getUserMap_(options);
  }

  const treatmentId = migration8E4C_str_(out.treatment_id);
  const treatment = treatmentId ? ctx.treatmentMap[treatmentId] : null;

  if (treatment) {
    if (!migration8E4C_str_(out.visit_date)) {
      out.visit_date = treatment.treatment_date || '';
    }

    if (!migration8E4C_str_(out.treatment_date)) {
      out.treatment_date = treatment.treatment_date || '';
    }

    const doctorUserId = migration8E4C_pickDoctorUserId_(treatment);
    const doctor = doctorUserId ? ctx.userMap[doctorUserId] : null;

    if (!migration8E4C_str_(out.doctor_name) && doctor) {
      out.doctor_name = migration8E4C_str_(doctor.full_name);
    }

    if (!migration8E4C_str_(out.doctor) && out.doctor_name) {
      out.doctor = out.doctor_name;
    }
  }

  return out;
}

function migration8E4C_enrichMedicalRecordRowsForClient_(rows, options) {
  const ctx = {
    treatmentMap: migration8E4C_getTreatmentMap_(options),
    userMap: migration8E4C_getUserMap_(options)
  };

  return (rows || []).map(function(row) {
    return migration8E4C_enrichMedicalRecordRowForClient_(row, options, ctx);
  });
}