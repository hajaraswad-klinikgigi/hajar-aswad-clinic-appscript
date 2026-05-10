function migration8E4B_getUiReadOptions_() {
  if (typeof repoBuildUiReadOptions_ === 'function') {
    return repoBuildUiReadOptions_();
  }

  return {
    backend_mode: 'supabase'
  };
}

function migration8E4B_indexBy_(rows, key) {
  const map = {};

  (rows || []).forEach(function(row) {
    const id = String(row && row[key] || '').trim();
    if (id) map[id] = row;
  });

  return map;
}

function migration8E4B_num_(value) {
  const n = Number(value || 0);
  return isNaN(n) ? 0 : n;
}

function migration8E4B_pickUserId_(row) {
  return String(
    row.doctor_user_id ||
    row.doctor_id ||
    row.user_id ||
    ''
  ).trim();
}

function migration8E4B_isBlank_(value) {
  return !String(value || '').trim();
}

function testMigrationStage8E4BUiMappingDiagnosticLog() {
  const result = {
    success: true,
    stage: '8E-4B-UI-Mapping-Diagnostic',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    backend_mode: '',
    issue_count: 0,
    issues: [],
    counts: {},
    diagnostics: {},
    samples: {}
  };

  try {
    const opts = migration8E4B_getUiReadOptions_();
    opts.backend_mode = 'supabase';

    result.backend_mode = opts.backend_mode;

    const appointments = dbFindAll_(REPO_TABLES.APPOINTMENTS, opts) || [];
    const patients = dbFindAll_(REPO_TABLES.PATIENTS, opts) || [];
    const recalls = dbFindAll_(REPO_TABLES.ORTHO_RECALL, opts) || [];
    const treatments = dbFindAll_(REPO_TABLES.TREATMENTS, opts) || [];
    const treatmentItems = dbFindAll_(REPO_TABLES.TREATMENT_ITEMS, opts) || [];
    const medicalRecords = dbFindAll_(REPO_TABLES.MEDICAL_RECORDS, opts) || [];
    const users = dbFindAll_(REPO_TABLES.USERS, opts) || [];

    const patientMap = migration8E4B_indexBy_(patients, 'patient_id');
    const userMap = migration8E4B_indexBy_(users, 'user_id');

    const treatmentItemsByTreatmentId = {};
    treatmentItems.forEach(function(item) {
      const treatmentId = String(item.treatment_id || '').trim();
      if (!treatmentId) return;

      if (!treatmentItemsByTreatmentId[treatmentId]) {
        treatmentItemsByTreatmentId[treatmentId] = [];
      }

      treatmentItemsByTreatmentId[treatmentId].push(item);
    });

    result.counts = {
      appointments: appointments.length,
      patients: patients.length,
      recalls: recalls.length,
      treatments: treatments.length,
      treatment_items: treatmentItems.length,
      medical_records: medicalRecords.length,
      users: users.length
    };

    // A. Appointment patient display
    let appointmentPatientNameBlank = 0;
    let appointmentPatientResolvable = 0;
    const appointmentSamples = [];

    appointments.forEach(function(row) {
      const patientId = String(row.patient_id || '').trim();
      const patientName = String(row.patient_name || '').trim();

      if (!patientName) {
        appointmentPatientNameBlank++;

        const patient = patientMap[patientId];
        if (patient && String(patient.full_name || '').trim()) {
          appointmentPatientResolvable++;

          if (appointmentSamples.length < 5) {
            appointmentSamples.push({
              appointment_id: row.appointment_id,
              patient_id: patientId,
              current_patient_name: patientName || '',
              resolved_patient_name: patient.full_name
            });
          }
        }
      }
    });

    // B. Recall patient/phone display
    let recallPatientNameBlank = 0;
    let recallPhoneBlank = 0;
    let recallPatientResolvable = 0;
    let recallPhoneResolvable = 0;
    const recallSamples = [];

    recalls.forEach(function(row) {
      const patientId = String(row.patient_id || '').trim();
      const patientName = String(row.patient_name || '').trim();
      const phone = String(row.phone || '').trim();
      const patient = patientMap[patientId];

      const nameBlank = !patientName;
      const phoneBlank = !phone;

      if (nameBlank) recallPatientNameBlank++;
      if (phoneBlank) recallPhoneBlank++;

      if (nameBlank && patient && String(patient.full_name || '').trim()) {
        recallPatientResolvable++;
      }

      if (phoneBlank && patient && String(patient.phone || '').trim()) {
        recallPhoneResolvable++;
      }

      if ((nameBlank || phoneBlank) && patient && recallSamples.length < 5) {
        recallSamples.push({
          ortho_recall_id: row.ortho_recall_id,
          patient_id: patientId,
          current_patient_name: patientName,
          resolved_patient_name: patient.full_name || '',
          current_phone: phone,
          resolved_phone: patient.phone || ''
        });
      }
    });

    // C. Treatment doctor display + total cost
    let treatmentDoctorBlank = 0;
    let treatmentDoctorResolvable = 0;
    let treatmentTotalZeroButItemsPositive = 0;
    const treatmentSamples = [];

    treatments.forEach(function(row) {
      const treatmentId = String(row.treatment_id || '').trim();
      const doctorName = String(row.doctor_name || '').trim();
      const doctorUserId = migration8E4B_pickUserId_(row);
      const user = userMap[doctorUserId];

      const items = treatmentItemsByTreatmentId[treatmentId] || [];
      const itemSubtotal = items.reduce(function(sum, item) {
        return sum + migration8E4B_num_(item.subtotal);
      }, 0);

      const totalCost = migration8E4B_num_(row.total_cost || row.total_biaya || row.grand_total);

      const doctorBlank = !doctorName;
      const totalMismatch = totalCost === 0 && itemSubtotal > 0;

      if (doctorBlank) {
        treatmentDoctorBlank++;

        if (user && String(user.full_name || '').trim()) {
          treatmentDoctorResolvable++;
        }
      }

      if (totalMismatch) {
        treatmentTotalZeroButItemsPositive++;
      }

      if ((doctorBlank || totalMismatch) && treatmentSamples.length < 5) {
        treatmentSamples.push({
          treatment_id: treatmentId,
          patient_id: row.patient_id || '',
          doctor_user_id: doctorUserId,
          current_doctor_name: doctorName,
          resolved_doctor_name: user ? String(user.full_name || '') : '',
          current_total_cost: totalCost,
          item_subtotal_sum: itemSubtotal,
          item_count: items.length
        });
      }
    });

    // D. Medical record doctor display
    let medicalRecordDoctorBlank = 0;
    const medicalRecordSamples = [];

    medicalRecords.forEach(function(row) {
      const doctorName = String(row.doctor_name || row.doctor || '').trim();

      if (!doctorName) {
        medicalRecordDoctorBlank++;

        if (medicalRecordSamples.length < 5) {
          medicalRecordSamples.push({
            record_id: row.record_id || row.medical_record_id || '',
            treatment_id: row.treatment_id || '',
            patient_id: row.patient_id || '',
            visit_date: row.visit_date || row.treatment_date || '',
            current_doctor_name: doctorName
          });
        }
      }
    });

    result.diagnostics = {
      appointment_patient_name_blank: appointmentPatientNameBlank,
      appointment_patient_name_resolvable_from_patients: appointmentPatientResolvable,

      recall_patient_name_blank: recallPatientNameBlank,
      recall_patient_name_resolvable_from_patients: recallPatientResolvable,
      recall_phone_blank: recallPhoneBlank,
      recall_phone_resolvable_from_patients: recallPhoneResolvable,

      treatment_doctor_name_blank: treatmentDoctorBlank,
      treatment_doctor_name_resolvable_from_users: treatmentDoctorResolvable,
      treatment_total_zero_but_items_positive: treatmentTotalZeroButItemsPositive,

      medical_record_doctor_name_blank: medicalRecordDoctorBlank
    };

    result.samples = {
      appointments: appointmentSamples,
      recalls: recallSamples,
      treatments: treatmentSamples,
      medical_records: medicalRecordSamples
    };

    if (appointmentPatientNameBlank > 0 && appointmentPatientResolvable === 0) {
      result.issues.push({
        issue: 'APPOINTMENT_PATIENT_NAME_BLANK_NOT_RESOLVABLE'
      });
    }

    if (recallPatientNameBlank > 0 && recallPatientResolvable === 0) {
      result.issues.push({
        issue: 'RECALL_PATIENT_NAME_BLANK_NOT_RESOLVABLE'
      });
    }

    if (treatmentDoctorBlank > 0 && treatmentDoctorResolvable === 0) {
      result.issues.push({
        issue: 'TREATMENT_DOCTOR_NAME_BLANK_NOT_RESOLVABLE'
      });
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8E-4B-UI-Mapping-Diagnostic',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testMigrationStage8E4BUiMappingDiagnosticCompactLog() {
  const full = testMigrationStage8E4BUiMappingDiagnosticLog();

  const compact = {
    success: !!(full && full.success),
    stage: '8E-4B-UI-Mapping-Diagnostic-Compact',
    checked_at: full && full.checked_at ? full.checked_at : (typeof nowIso === 'function' ? nowIso() : new Date().toISOString()),
    backend_mode: full && full.backend_mode ? full.backend_mode : '',
    issue_count: full && typeof full.issue_count !== 'undefined' ? full.issue_count : null,
    counts: full && full.counts ? full.counts : {},
    diagnostics: full && full.diagnostics ? full.diagnostics : {},
    sample_one_each: {
      appointment: full && full.samples && full.samples.appointments && full.samples.appointments.length
        ? full.samples.appointments[0]
        : null,
      recall: full && full.samples && full.samples.recalls && full.samples.recalls.length
        ? full.samples.recalls[0]
        : null,
      treatment: full && full.samples && full.samples.treatments && full.samples.treatments.length
        ? full.samples.treatments[0]
        : null,
      medical_record: full && full.samples && full.samples.medical_records && full.samples.medical_records.length
        ? full.samples.medical_records[0]
        : null
    },
    interpretation: {
      appointment_patient_name: 'blank_but_resolvable_from_patients',
      recall_patient_name: 'blank_but_resolvable_from_patients',
      recall_phone: 'mostly_resolvable_from_patients',
      treatment_doctor_name: 'blank_but_resolvable_from_users',
      treatment_total_cost: 'zero_but_resolvable_from_treatment_items_sum',
      medical_record_doctor_visit_date: 'needs_enrichment_from_related_treatment'
    }
  };

  Logger.log(JSON.stringify(compact, null, 2));
  return compact;
}

function testMigrationStage8E4CPostPatchUiMappingLog() {
  const result = {
    success: true,
    stage: '8E-4C-PostPatch-UI-Mapping',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    backend_mode: 'supabase',
    issue_count: 0,
    issues: [],
    checks: {},
    samples: {}
  };

  function addIssue(issue, details) {
    result.issues.push(Object.assign({ issue: issue }, details || {}));
  }

  function isBlank(value) {
    return !String(value || '').trim();
  }

  function num(value) {
    const n = Number(value || 0);
    return isNaN(n) ? 0 : n;
  }

  try {
    const opts = { backend_mode: 'supabase' };

    // 1. Appointment list/detail patient_name
    const appointments = getAppointments(opts) || [];
    const appointmentWithPatient = appointments.find(function(row) {
      return !isBlank(row.patient_id);
    }) || appointments[0] || null;

    result.checks.appointment_count = appointments.length;

    if (!appointmentWithPatient) {
      addIssue('APPOINTMENT_SAMPLE_NOT_FOUND');
    } else {
      const appointmentDetail = getAppointmentById(appointmentWithPatient.appointment_id, opts);

      result.samples.appointment = {
        appointment_id: appointmentWithPatient.appointment_id,
        patient_id: appointmentWithPatient.patient_id,
        list_patient_name: appointmentWithPatient.patient_name || '',
        detail_patient_name: appointmentDetail && appointmentDetail.data
          ? appointmentDetail.data.patient_name || ''
          : ''
      };

      if (isBlank(appointmentWithPatient.patient_name)) {
        addIssue('APPOINTMENT_LIST_PATIENT_NAME_STILL_BLANK', result.samples.appointment);
      }

      if (
        !appointmentDetail ||
        !appointmentDetail.success ||
        !appointmentDetail.data ||
        isBlank(appointmentDetail.data.patient_name)
      ) {
        addIssue('APPOINTMENT_DETAIL_PATIENT_NAME_STILL_BLANK', result.samples.appointment);
      }
    }

    // 2. Recall list/detail patient_name + phone
    const recallResult = getOrthoRecallList(opts);
    const recalls = recallResult && Array.isArray(recallResult.data)
      ? recallResult.data
      : [];

    const recallWithPatient = recalls.find(function(row) {
      return !isBlank(row.patient_id);
    }) || recalls[0] || null;

    result.checks.recall_count = recalls.length;

    if (!recallWithPatient) {
      addIssue('RECALL_SAMPLE_NOT_FOUND');
    } else {
      const recallDetail = getOrthoRecallById(recallWithPatient.ortho_recall_id, opts);

      result.samples.recall = {
        ortho_recall_id: recallWithPatient.ortho_recall_id,
        patient_id: recallWithPatient.patient_id,
        list_patient_name: recallWithPatient.patient_name || '',
        list_phone: recallWithPatient.phone || '',
        detail_patient_name: recallDetail && recallDetail.data
          ? recallDetail.data.patient_name || ''
          : '',
        detail_phone: recallDetail && recallDetail.data
          ? recallDetail.data.phone || ''
          : ''
      };

      if (isBlank(recallWithPatient.patient_name)) {
        addIssue('RECALL_LIST_PATIENT_NAME_STILL_BLANK', result.samples.recall);
      }

      if (
        !recallDetail ||
        !recallDetail.success ||
        !recallDetail.data ||
        isBlank(recallDetail.data.patient_name)
      ) {
        addIssue('RECALL_DETAIL_PATIENT_NAME_STILL_BLANK', result.samples.recall);
      }
    }

    // 3. Patient treatment detail: doctor_name + total_cost
    const treatmentsRaw = dbFindAll_(REPO_TABLES.TREATMENTS, opts) || [];
    const treatmentItemsRaw = dbFindAll_(REPO_TABLES.TREATMENT_ITEMS, opts) || [];

    const itemSubtotalByTreatment = {};
    treatmentItemsRaw.forEach(function(item) {
      const treatmentId = String(item.treatment_id || '').trim();
      if (!treatmentId) return;

      itemSubtotalByTreatment[treatmentId] =
        (itemSubtotalByTreatment[treatmentId] || 0) + num(item.subtotal);
    });

    const treatmentSampleRaw = treatmentsRaw.find(function(row) {
      const treatmentId = String(row.treatment_id || '').trim();
      return treatmentId && itemSubtotalByTreatment[treatmentId] > 0;
    }) || null;

    if (!treatmentSampleRaw) {
      addIssue('TREATMENT_SAMPLE_NOT_FOUND');
    } else {
      const patientId = String(treatmentSampleRaw.patient_id || '').trim();
      const secondary = getPatientDetailSecondary(patientId);
      const serviceTreatments = secondary && secondary.data && Array.isArray(secondary.data.treatments)
        ? secondary.data.treatments
        : [];

      const serviceTreatment = serviceTreatments.find(function(row) {
        return String(row.treatment_id || '').trim() === String(treatmentSampleRaw.treatment_id || '').trim();
      }) || null;

      result.samples.patient_treatment = {
        patient_id: patientId,
        treatment_id: treatmentSampleRaw.treatment_id,
        expected_item_subtotal_sum: itemSubtotalByTreatment[treatmentSampleRaw.treatment_id] || 0,
        service_doctor_name: serviceTreatment ? serviceTreatment.doctor_name || '' : '',
        service_total_cost: serviceTreatment ? num(serviceTreatment.total_cost || serviceTreatment.total_biaya) : 0,
        service_item_count: serviceTreatment && Array.isArray(serviceTreatment.items)
          ? serviceTreatment.items.length
          : 0
      };

      if (!serviceTreatment) {
        addIssue('PATIENT_DETAIL_TREATMENT_SAMPLE_NOT_FOUND', result.samples.patient_treatment);
      } else {
        if (isBlank(serviceTreatment.doctor_name)) {
          addIssue('PATIENT_DETAIL_TREATMENT_DOCTOR_NAME_STILL_BLANK', result.samples.patient_treatment);
        }

        if (num(serviceTreatment.total_cost || serviceTreatment.total_biaya) <= 0) {
          addIssue('PATIENT_DETAIL_TREATMENT_TOTAL_STILL_ZERO', result.samples.patient_treatment);
        }
      }
    }

    // 4. Medical record: doctor_name + visit_date
    const medicalRecordsRaw = dbFindAll_(REPO_TABLES.MEDICAL_RECORDS, opts) || [];
    const medicalRecordSampleRaw = medicalRecordsRaw.find(function(row) {
      return !isBlank(row.patient_id) && !isBlank(row.treatment_id);
    }) || medicalRecordsRaw[0] || null;

    if (!medicalRecordSampleRaw) {
      addIssue('MEDICAL_RECORD_SAMPLE_NOT_FOUND');
    } else {
      const patientId = String(medicalRecordSampleRaw.patient_id || '').trim();
      const primary = getPatientDetailPrimary(patientId);
      const serviceRecords = primary && primary.data && Array.isArray(primary.data.medical_records)
        ? primary.data.medical_records
        : [];

      const serviceRecord = serviceRecords.find(function(row) {
        return String(row.record_id || row.medical_record_id || '').trim() ===
          String(medicalRecordSampleRaw.record_id || medicalRecordSampleRaw.medical_record_id || '').trim();
      }) || serviceRecords[0] || null;

      result.samples.medical_record = {
        patient_id: patientId,
        record_id: medicalRecordSampleRaw.record_id || medicalRecordSampleRaw.medical_record_id || '',
        treatment_id: medicalRecordSampleRaw.treatment_id || '',
        service_visit_date: serviceRecord ? serviceRecord.visit_date || '' : '',
        service_treatment_date: serviceRecord ? serviceRecord.treatment_date || '' : '',
        service_doctor_name: serviceRecord ? serviceRecord.doctor_name || serviceRecord.doctor || '' : ''
      };

      if (!serviceRecord) {
        addIssue('PATIENT_DETAIL_MEDICAL_RECORD_SAMPLE_NOT_FOUND', result.samples.medical_record);
      } else {
        if (isBlank(serviceRecord.visit_date) && isBlank(serviceRecord.treatment_date)) {
          addIssue('PATIENT_DETAIL_MEDICAL_RECORD_DATE_STILL_BLANK', result.samples.medical_record);
        }

        if (isBlank(serviceRecord.doctor_name) && isBlank(serviceRecord.doctor)) {
          addIssue('PATIENT_DETAIL_MEDICAL_RECORD_DOCTOR_STILL_BLANK', result.samples.medical_record);
        }
      }
    }

    // 5. Dashboard all-period latest lists
    const dashboardAll = getDashboardOwnerSummary('all');
    const dashboardData = dashboardAll && dashboardAll.data ? dashboardAll.data : {};

    const latestAppointment = dashboardData.latest_appointments && dashboardData.latest_appointments.length
      ? dashboardData.latest_appointments[0]
      : null;

    const latestTreatment = dashboardData.latest_treatments && dashboardData.latest_treatments.length
      ? dashboardData.latest_treatments[0]
      : null;

    const recallDue = dashboardData.recall_due_list && dashboardData.recall_due_list.length
      ? dashboardData.recall_due_list[0]
      : null;

    result.samples.dashboard = {
      success: !!(dashboardAll && dashboardAll.success),
      kpi: dashboardData.kpi || null,
      latest_appointment_patient_name: latestAppointment ? latestAppointment.patient_name || '' : '',
      latest_treatment_patient_name: latestTreatment ? latestTreatment.patient_name || '' : '',
      latest_treatment_doctor_name: latestTreatment ? latestTreatment.doctor_name || '' : '',
      latest_treatment_total_cost: latestTreatment ? num(latestTreatment.total_cost) : 0,
      recall_due_patient_name: recallDue ? recallDue.patient_name || '' : ''
    };

    if (!dashboardAll || !dashboardAll.success) {
      addIssue('DASHBOARD_ALL_SUMMARY_FAILED');
    }

    if (latestAppointment && isBlank(latestAppointment.patient_name)) {
      addIssue('DASHBOARD_LATEST_APPOINTMENT_PATIENT_NAME_STILL_BLANK', result.samples.dashboard);
    }

    if (latestTreatment && isBlank(latestTreatment.patient_name)) {
      addIssue('DASHBOARD_LATEST_TREATMENT_PATIENT_NAME_STILL_BLANK', result.samples.dashboard);
    }

    if (latestTreatment && num(latestTreatment.total_cost) <= 0) {
      addIssue('DASHBOARD_LATEST_TREATMENT_TOTAL_STILL_ZERO', result.samples.dashboard);
    }

    if (recallDue && isBlank(recallDue.patient_name)) {
      addIssue('DASHBOARD_RECALL_DUE_PATIENT_NAME_STILL_BLANK', result.samples.dashboard);
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8E-4C-PostPatch-UI-Mapping',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}

function testDashboardTodaySourceAlignment8E4DLog() {
  const result = {
    success: true,
    stage: '8E-4D-Dashboard-Today-Source-Alignment',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    timezone: Session.getScriptTimeZone(),
    today_ymd: '',
    issue_count: 0,
    issues: [],
    dashboard_today: null,
    appointments: {
      supabase: {},
      spreadsheet: {}
    },
    treatments: {
      supabase: {},
      spreadsheet: {}
    },
    samples: {
      supabase_appointments_today: [],
      spreadsheet_appointments_today: [],
      supabase_treatments_today: [],
      spreadsheet_treatments_today: []
    }
  };

  function addIssue(issue, details) {
    result.issues.push(Object.assign({ issue: issue }, details || {}));
  }

  function str(value) {
    return String(value || '').trim();
  }

  function num(value) {
    const n = Number(value || 0);
    return isNaN(n) ? 0 : n;
  }

  function ymd(value) {
    if (!value) return '';

    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }

    const s = String(value || '').trim();

    const ymdMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      return ymdMatch[1] + '-' + ymdMatch[2] + '-' + ymdMatch[3];
    }

    const dmyMatch = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (dmyMatch) {
      return dmyMatch[3] + '-' + dmyMatch[2] + '-' + dmyMatch[1];
    }

    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }

    return s;
  }

  function summarizeAppointments(rows, targetYmd) {
    const summary = {
      total_all: rows.length,
      total_today: 0,
      scheduled_today: 0,
      completed_today: 0,
      cancelled_today: 0,
      other_status_today: 0,
      date_counts_top: {}
    };

    const dateCounts = {};

    rows.forEach(function(row) {
      const dateYmd = ymd(row.appointment_date || row.date || '');
      const status = str(row.status).toLowerCase();

      if (dateYmd) {
        dateCounts[dateYmd] = (dateCounts[dateYmd] || 0) + 1;
      }

      if (dateYmd !== targetYmd) return;

      summary.total_today++;

      if (status === 'scheduled') summary.scheduled_today++;
      else if (status === 'completed') summary.completed_today++;
      else if (status === 'cancelled') summary.cancelled_today++;
      else summary.other_status_today++;
    });

    summary.date_counts_top = Object.keys(dateCounts)
      .sort(function(a, b) {
        return String(b).localeCompare(String(a));
      })
      .slice(0, 10)
      .reduce(function(obj, key) {
        obj[key] = dateCounts[key];
        return obj;
      }, {});

    return summary;
  }

  function summarizeTreatments(rows, targetYmd, itemSubtotalByTreatment) {
    const summary = {
      total_all: rows.length,
      total_today: 0,
      value_today_from_total_cost: 0,
      value_today_from_items: 0,
      date_counts_top: {}
    };

    const dateCounts = {};

    rows.forEach(function(row) {
      const dateYmd = ymd(row.treatment_date || row.date || '');
      const treatmentId = str(row.treatment_id);

      if (dateYmd) {
        dateCounts[dateYmd] = (dateCounts[dateYmd] || 0) + 1;
      }

      if (dateYmd !== targetYmd) return;

      summary.total_today++;
      summary.value_today_from_total_cost += num(row.total_cost || row.total_biaya || row.grand_total);
      summary.value_today_from_items += num(itemSubtotalByTreatment[treatmentId]);
    });

    summary.date_counts_top = Object.keys(dateCounts)
      .sort(function(a, b) {
        return String(b).localeCompare(String(a));
      })
      .slice(0, 10)
      .reduce(function(obj, key) {
        obj[key] = dateCounts[key];
        return obj;
      }, {});

    return summary;
  }

  function buildItemSubtotalByTreatment(rows) {
    const map = {};

    (rows || []).forEach(function(item) {
      const treatmentId = str(item.treatment_id);
      if (!treatmentId) return;

      map[treatmentId] = (map[treatmentId] || 0) + num(item.subtotal);
    });

    return map;
  }

  function sampleAppointments(rows, targetYmd) {
    return rows
      .filter(function(row) {
        return ymd(row.appointment_date || row.date || '') === targetYmd;
      })
      .slice(0, 10)
      .map(function(row) {
        return {
          appointment_id: row.appointment_id || '',
          patient_id: row.patient_id || '',
          patient_name: row.patient_name || '',
          appointment_date_raw: row.appointment_date || row.date || '',
          appointment_date_ymd: ymd(row.appointment_date || row.date || ''),
          appointment_time: row.appointment_time || '',
          status: row.status || '',
          complaint: row.complaint || ''
        };
      });
  }

  function sampleTreatments(rows, targetYmd, itemSubtotalByTreatment) {
    return rows
      .filter(function(row) {
        return ymd(row.treatment_date || row.date || '') === targetYmd;
      })
      .slice(0, 10)
      .map(function(row) {
        const treatmentId = str(row.treatment_id);

        return {
          treatment_id: treatmentId,
          patient_id: row.patient_id || '',
          patient_name: row.patient_name || '',
          treatment_date_raw: row.treatment_date || row.date || '',
          treatment_date_ymd: ymd(row.treatment_date || row.date || ''),
          doctor_user_id: row.doctor_user_id || '',
          doctor_name: row.doctor_name || '',
          total_cost: num(row.total_cost || row.total_biaya || row.grand_total),
          item_subtotal_sum: num(itemSubtotalByTreatment[treatmentId])
        };
      });
  }

  try {
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    result.today_ymd = today;

    const supabaseOpts = { backend_mode: 'supabase' };
    const spreadsheetOpts = { backend_mode: 'spreadsheet' };

    const supabaseAppointmentsRaw = dbFindAll_(REPO_TABLES.APPOINTMENTS, supabaseOpts) || [];
    const spreadsheetAppointmentsRaw = dbFindAll_(REPO_TABLES.APPOINTMENTS, spreadsheetOpts) || [];

    const supabaseAppointments = typeof migration8E4C_enrichAppointmentRowsForClient_ === 'function'
      ? migration8E4C_enrichAppointmentRowsForClient_(supabaseAppointmentsRaw, supabaseOpts)
      : supabaseAppointmentsRaw;

    const spreadsheetAppointments = typeof migration8E4C_enrichAppointmentRowsForClient_ === 'function'
      ? migration8E4C_enrichAppointmentRowsForClient_(spreadsheetAppointmentsRaw, spreadsheetOpts)
      : spreadsheetAppointmentsRaw;

    const supabaseTreatmentsRaw = dbFindAll_(REPO_TABLES.TREATMENTS, supabaseOpts) || [];
    const spreadsheetTreatmentsRaw = dbFindAll_(REPO_TABLES.TREATMENTS, spreadsheetOpts) || [];

    const supabaseTreatmentItems = dbFindAll_(REPO_TABLES.TREATMENT_ITEMS, supabaseOpts) || [];
    const spreadsheetTreatmentItems = dbFindAll_(REPO_TABLES.TREATMENT_ITEMS, spreadsheetOpts) || [];

    const supabaseItemSubtotalByTreatment = buildItemSubtotalByTreatment(supabaseTreatmentItems);
    const spreadsheetItemSubtotalByTreatment = buildItemSubtotalByTreatment(spreadsheetTreatmentItems);

    const supabaseTreatments = typeof migration8E4C_enrichTreatmentRowsForClient_ === 'function'
      ? migration8E4C_enrichTreatmentRowsForClient_(supabaseTreatmentsRaw, supabaseOpts)
      : supabaseTreatmentsRaw;

    const spreadsheetTreatments = typeof migration8E4C_enrichTreatmentRowsForClient_ === 'function'
      ? migration8E4C_enrichTreatmentRowsForClient_(spreadsheetTreatmentsRaw, spreadsheetOpts)
      : spreadsheetTreatmentsRaw;

    result.appointments.supabase = summarizeAppointments(supabaseAppointments, today);
    result.appointments.spreadsheet = summarizeAppointments(spreadsheetAppointments, today);

    result.treatments.supabase = summarizeTreatments(
      supabaseTreatments,
      today,
      supabaseItemSubtotalByTreatment
    );

    result.treatments.spreadsheet = summarizeTreatments(
      spreadsheetTreatments,
      today,
      spreadsheetItemSubtotalByTreatment
    );

    result.samples.supabase_appointments_today = sampleAppointments(supabaseAppointments, today);
    result.samples.spreadsheet_appointments_today = sampleAppointments(spreadsheetAppointments, today);

    result.samples.supabase_treatments_today = sampleTreatments(
      supabaseTreatments,
      today,
      supabaseItemSubtotalByTreatment
    );

    result.samples.spreadsheet_treatments_today = sampleTreatments(
      spreadsheetTreatments,
      today,
      spreadsheetItemSubtotalByTreatment
    );

    const dashboardToday = getDashboardOwnerSummary('today');
    result.dashboard_today = dashboardToday && dashboardToday.data
      ? {
          period: dashboardToday.data.period,
          kpi: dashboardToday.data.kpi
        }
      : null;

    if (
      result.dashboard_today &&
      result.dashboard_today.kpi &&
      num(result.dashboard_today.kpi.appointment_total) !== result.appointments.supabase.total_today
    ) {
      addIssue('DASHBOARD_APPOINTMENT_TOTAL_NOT_MATCH_SUPABASE_TODAY', {
        dashboard: result.dashboard_today.kpi.appointment_total,
        supabase: result.appointments.supabase.total_today
      });
    }

    if (
      result.appointments.supabase.total_today !== result.appointments.spreadsheet.total_today
    ) {
      addIssue('SUPABASE_SPREADSHEET_APPOINTMENT_TODAY_COUNT_DIFFER', {
        supabase_today: result.appointments.supabase.total_today,
        spreadsheet_today: result.appointments.spreadsheet.total_today
      });
    }

    if (
      result.treatments.supabase.total_today !== result.treatments.spreadsheet.total_today
    ) {
      addIssue('SUPABASE_SPREADSHEET_TREATMENT_TODAY_COUNT_DIFFER', {
        supabase_today: result.treatments.supabase.total_today,
        spreadsheet_today: result.treatments.spreadsheet.total_today
      });
    }

    result.issue_count = result.issues.length;
    result.success = result.issue_count === 0;

    Logger.log(JSON.stringify(result, null, 2));
    return result;

  } catch (err) {
    const errorResult = {
      success: false,
      stage: '8E-4D-Dashboard-Today-Source-Alignment',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}