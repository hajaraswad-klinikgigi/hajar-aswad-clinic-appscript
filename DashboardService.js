/* =========================================================
   PHASE 6G - DASHBOARD UI READ OPTIONS
   ========================================================= */

function getDashboardUiReadOptions_() {
  if (typeof repoBuildUiReadOptions_ === 'function') {
    return repoBuildUiReadOptions_();
  }

  return {
    backend_mode: 'spreadsheet',
    ui_read_supabase_test_enabled: false
  };
}

function getDashboardUiReadBackendMode_() {
  const opts = getDashboardUiReadOptions_();
  return String(opts.backend_mode || 'spreadsheet').trim().toLowerCase();
}

function getDashboardRowsByTable_(tableName) {
  const opts = getDashboardUiReadOptions_();

  try {
    if (typeof dbFindAll_ === 'function') {
      return dbFindAll_(tableName, opts) || [];
    }

    return getRowsAsObjects(tableName) || [];
  } catch (err) {
    return [];
  }
}

function isDashboardUiReadSupabaseMode_() {
  return getDashboardUiReadBackendMode_() === 'supabase';
}

function normalizeDashboardAppointment(row) {
  let timeValue = row.appointment_time;

  if (Object.prototype.toString.call(timeValue) === '[object Date]' && !isNaN(timeValue)) {
    timeValue = Utilities.formatDate(timeValue, Session.getScriptTimeZone(), 'HH:mm');
  } else {
    timeValue = String(timeValue || '').substring(0, 5);
  }

  return {
    appointment_id: String(row.appointment_id || ''),
    patient_id: String(row.patient_id || ''),
    patient_name: String(row.patient_name || ''),
    appointment_date: extractYmd(row.appointment_date),
    appointment_time: timeValue,
    status: String(row.status || '').toLowerCase()
  };
}

function getNowTimeHm() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
}

function getTodayYmdDashboard() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function timeToMinutes(hm) {
  const s = String(hm || '').trim();
  const parts = s.split(':');
  if (parts.length < 2) return null;

  const h = Number(parts[0]);
  const m = Number(parts[1]);

  if (isNaN(h) || isNaN(m)) return null;
  return (h * 60) + m;
}

function getPriorityAppointment(appointments) {
  const todayYmd = getTodayYmdDashboard();
  const nowHm = getNowTimeHm();
  const nowMinutes = timeToMinutes(nowHm);

  const todayScheduled = appointments
    .filter(function(a) {
      return a.appointment_date === todayYmd && a.status === 'scheduled';
    })
    .filter(function(a) {
      return timeToMinutes(a.appointment_time) !== null;
    })
    .sort(function(a, b) {
      return a.appointment_time.localeCompare(b.appointment_time);
    });

  if (!todayScheduled.length || nowMinutes === null) {
    return {
      type: 'none',
      now_time: nowHm,
      overdue_count: 0,
      data: null
    };
  }

  const overdue = todayScheduled.filter(function(a) {
    return timeToMinutes(a.appointment_time) < nowMinutes;
  });

  if (overdue.length) {
    const firstOverdue = overdue[0];
    const diffMinutes = nowMinutes - timeToMinutes(firstOverdue.appointment_time);

    return {
      type: 'overdue',
      now_time: nowHm,
      overdue_count: overdue.length,
      data: {
        appointment_id: firstOverdue.appointment_id,
        patient_id: firstOverdue.patient_id,
        patient_name: firstOverdue.patient_name,
        appointment_date: firstOverdue.appointment_date,
        appointment_time: firstOverdue.appointment_time,
        status: firstOverdue.status,
        diff_minutes: diffMinutes
      }
    };
  }

  const upcoming = todayScheduled.find(function(a) {
    return timeToMinutes(a.appointment_time) >= nowMinutes;
  });

  if (upcoming) {
    const diffMinutes = timeToMinutes(upcoming.appointment_time) - nowMinutes;

    return {
      type: 'upcoming',
      now_time: nowHm,
      overdue_count: 0,
      data: {
        appointment_id: upcoming.appointment_id,
        patient_id: upcoming.patient_id,
        patient_name: upcoming.patient_name,
        appointment_date: upcoming.appointment_date,
        appointment_time: upcoming.appointment_time,
        status: upcoming.status,
        diff_minutes: diffMinutes
      }
    };
  }

  return {
    type: 'none',
    now_time: nowHm,
    overdue_count: 0,
    data: null
  };
}

function normalizeDashboardTreatment(row) {
  return {
    treatment_id: String(row.treatment_id || ''),
    patient_id: String(row.patient_id || ''),
    patient_name: String(row.patient_name || ''),
    doctor_name: String(row.doctor_name || ''),
    treatment_date: extractYmd(row.treatment_date),
    total_cost: Number(row.total_cost || 0),
    created_at: formatCellValue(row.created_at || '')
  };
}

function normalizeDashboardTreatmentItem(row) {
  return {
    treatment_item_id: String(row.treatment_item_id || ''),
    treatment_id: String(row.treatment_id || ''),
    service_id: String(row.service_id || ''),
    service_name: String(row.service_name || ''),
    qty: Number(row.qty || 0),
    unit_price: Number(row.unit_price || 0),
    subtotal: Number(row.subtotal || 0)
  };
}

function normalizeDashboardRecall(row) {
  return {
    ortho_recall_id: String(row.ortho_recall_id || ''),
    patient_id: String(row.patient_id || ''),
    patient_name: String(row.patient_name || ''),
    phone: String(row.phone || ''),
    install_date: extractYmd(row.install_date),
    last_control_date: extractYmd(row.last_control_date),
    next_due_date: extractYmd(row.next_due_date),
    control_count: Number(row.control_count || 0),
    program_status: String(row.program_status || '').trim().toLowerCase(),
    followup_status: String(row.followup_status || '').trim().toLowerCase(),
    last_contact_date: extractYmd(row.last_contact_date),
    last_contact_note: String(row.last_contact_note || '')
  };
}

function normalizeDashboardFinanceBilling(row) {
  return {
    billing_id: String(row.billing_id || ''),
    billing_number: String(row.billing_number || ''),
    billing_date: extractYmd(row.billing_date),
    due_date: extractYmd(row.due_date),
    subtotal: Number(row.subtotal || 0),
    discount_total: Number(row.discount_total || 0),
    grand_total: Number(row.grand_total || 0),
    paid_total: Number(row.paid_total || 0),
    outstanding_total: Number(row.outstanding_total || 0),
    payment_status: String(row.payment_status || '').trim().toLowerCase(),
    billing_status: String(row.billing_status || '').trim().toLowerCase(),
    created_at: formatCellValue(row.created_at || '')
  };
}

function normalizeDashboardFinancePayment(row) {
  return {
    payment_id: String(row.payment_id || ''),
    billing_id: String(row.billing_id || ''),
    payment_date: extractYmd(row.payment_date),
    payment_method: String(row.payment_method || '').trim().toLowerCase(),
    amount: Number(row.amount || 0),
    created_at: formatCellValue(row.created_at || '')
  };
}

function getDashboardFinanceBillingsRaw_() {
  try {
    const opts = getDashboardUiReadOptions_();

    if (typeof FinanceRepository !== 'undefined' && FinanceRepository.getBillingsRaw) {
      return FinanceRepository.getBillingsRaw(opts) || [];
    }

    if (typeof getBillingsRaw === 'function' && !isDashboardUiReadSupabaseMode_()) {
      return getBillingsRaw() || [];
    }

    return getDashboardRowsByTable_(REPO_TABLES.BILLINGS || 'Billings');
  } catch (err) {
    return [];
  }
}

function getDashboardFinancePaymentsRaw_() {
  try {
    const opts = getDashboardUiReadOptions_();

    if (typeof FinanceRepository !== 'undefined' && FinanceRepository.getPaymentsRaw) {
      return FinanceRepository.getPaymentsRaw(opts) || [];
    }

    if (typeof getPaymentsRaw === 'function' && !isDashboardUiReadSupabaseMode_()) {
      return getPaymentsRaw() || [];
    }

    return getDashboardRowsByTable_(REPO_TABLES.PAYMENTS || 'Payments');
  } catch (err) {
    return [];
  }
}

function getDashboardFeedbacksRaw_() {
  try {
    const opts = getDashboardUiReadOptions_();

    if (typeof FinanceRepository !== 'undefined' && FinanceRepository.getBillingFeedbacksRaw) {
      return FinanceRepository.getBillingFeedbacksRaw(opts) || [];
    }

    if (typeof getBillingFeedbacksRaw === 'function' && !isDashboardUiReadSupabaseMode_()) {
      return getBillingFeedbacksRaw() || [];
    }

    return getDashboardRowsByTable_(REPO_TABLES.BILLING_FEEDBACKS || 'BillingFeedbacks');
  } catch (err) {
    return [];
  }
}

function buildDashboardFeedbackSummary(startYmd, endYmd) {
  const feedbacksRaw = getDashboardFeedbacksRaw_();

  if (typeof buildBillingFeedbackSummaryForRange_ === 'function') {
    try {
      return buildBillingFeedbackSummaryForRange_(startYmd, endYmd, {
        feedbacks: feedbacksRaw
      });
    } catch (err) {
      // Fallback sederhana di bawah akan dipakai bila helper Finance gagal.
    }
  }

  const summary = {
    submitted_count: 0,
    average_rating: 0,
    satisfied_count: 0,
    neutral_count: 0,
    unsatisfied_count: 0,
    pending_count: 0,
    latest_feedbacks: []
  };

  let ratingTotal = 0;
  let ratingCount = 0;

  feedbacksRaw.forEach(function(row) {
    const status = String(row.feedback_status || '').trim().toLowerCase();
    const submittedYmd = extractYmd(row.submitted_at || '');
    const createdYmd = extractYmd(row.created_at || '');
    const dateForFilter = status === 'submitted'
      ? submittedYmd
      : createdYmd;

    if (!isDateBetweenYmd(dateForFilter, startYmd, endYmd)) {
      return;
    }

    if (status === 'submitted') {
      const rating = Number(row.rating || 0);

      summary.submitted_count++;

      if (rating > 0) {
        ratingTotal += rating;
        ratingCount++;
      }

      if (rating >= 4) {
        summary.satisfied_count++;
      } else if (rating === 3) {
        summary.neutral_count++;
      } else if (rating > 0) {
        summary.unsatisfied_count++;
      }

      summary.latest_feedbacks.push({
        billing_id: String(row.billing_id || ''),
        patient_name: String(row.patient_name || ''),
        rating: rating,
        comment: String(row.comment || ''),
        submitted_at: String(row.submitted_at || ''),
        submitted_ymd: submittedYmd
      });

      return;
    }

    summary.pending_count++;
  });

  summary.average_rating = ratingCount
    ? Math.round((ratingTotal / ratingCount) * 10) / 10
    : 0;

  summary.latest_feedbacks = summary.latest_feedbacks
    .sort(function(a, b) {
      return String(b.submitted_at || b.submitted_ymd || '').localeCompare(
        String(a.submitted_at || a.submitted_ymd || '')
      );
    })
    .slice(0, 5);

  return summary;
}

function buildDashboardFinanceSummary(startYmd, endYmd) {
  const billings = getDashboardFinanceBillingsRaw_()
    .map(normalizeDashboardFinanceBilling);

  const payments = getDashboardFinancePaymentsRaw_()
    .map(normalizeDashboardFinancePayment);

  const activeBillings = billings.filter(function(row) {
    return row.billing_status !== 'cancelled';
  });

  const billingsInPeriod = activeBillings.filter(function(row) {
    return isDateBetweenYmd(row.billing_date, startYmd, endYmd);
  });

  const paymentsInPeriod = payments.filter(function(row) {
    return isDateBetweenYmd(row.payment_date, startYmd, endYmd);
  });

  const grossBilling = billingsInPeriod.reduce(function(sum, row) {
    return sum + Number(row.subtotal || 0);
  }, 0);

  const discountTotal = billingsInPeriod.reduce(function(sum, row) {
    return sum + Number(row.discount_total || 0);
  }, 0);

  const netBilling = billingsInPeriod.reduce(function(sum, row) {
    return sum + Number(row.grand_total || 0);
  }, 0);

  const cashIn = paymentsInPeriod.reduce(function(sum, row) {
    return sum + Number(row.amount || 0);
  }, 0);

  const outstandingTotal = activeBillings.reduce(function(sum, row) {
    return sum + Number(row.outstanding_total || 0);
  }, 0);

  const unpaidBillingCount = activeBillings.filter(function(row) {
    return Number(row.outstanding_total || 0) > 0;
  }).length;

  return {
    billing_count: billingsInPeriod.length,
    gross_billing: grossBilling,
    discount_total: discountTotal,
    net_billing: netBilling,
    cash_in: cashIn,
    outstanding_total: outstandingTotal,
    unpaid_billing_count: unpaidBillingCount
  };
}

function getDashboardRecallPriorityRank(status) {
  const value = String(status || '').trim().toLowerCase();

  if (value === 'overdue') return 1;
  if (value === 'due') return 2;
  if (value === 'upcoming') return 3;
  if (value === 'reached_target') return 4;
  return 5;
}

function buildDashboardRecallSummary(recallRows) {
  const activeRows = (recallRows || []).filter(function(row) {
    return String(row.program_status || '') === 'active';
  });

  const dueToday = activeRows.filter(function(row) {
    return String(row.followup_status || '') === 'due';
  });

  const overdue = activeRows.filter(function(row) {
    return String(row.followup_status || '') === 'overdue';
  });

  const reachedTarget = activeRows.filter(function(row) {
    return String(row.followup_status || '') === 'reached_target';
  });

  const contacted = activeRows.filter(function(row) {
    return !!String(row.last_contact_date || '').trim();
  });

  const notContacted = activeRows.filter(function(row) {
    return !String(row.last_contact_date || '').trim();
  });

  const dueList = activeRows
    .slice()
    .sort(function(a, b) {
      const rankCompare = getDashboardRecallPriorityRank(a.followup_status) - getDashboardRecallPriorityRank(b.followup_status);
      if (rankCompare !== 0) return rankCompare;

      const dueCompare = String(a.next_due_date || '').localeCompare(String(b.next_due_date || ''));
      if (dueCompare !== 0) return dueCompare;

      return String(a.patient_name || '').localeCompare(String(b.patient_name || ''));
    })
    .slice(0, 5);

  return {
    active_total: activeRows.length,
    due_total: dueToday.length,
    overdue_total: overdue.length,
    reached_target_total: reachedTarget.length,
    contacted_total: contacted.length,
    not_contacted_total: notContacted.length,
    due_list: dueList
  };
}

function getDashboardOwnerSummary(period) {
  const normalizedPeriod = String(period || 'today').toLowerCase();
  const dashboardReadOptions = getDashboardUiReadOptions_();
  const dashboardBackendMode = getDashboardUiReadBackendMode_();

  const cacheKey = buildCacheKey([
    'dashboardOwnerSummary',
    'dashFeedback1d',
    dashboardBackendMode,
    normalizedPeriod
  ]);

  const cached = getCachedJson(cacheKey);
  if (cached) {
    return cached;
  }

  const range = getDateRangeByPeriod(normalizedPeriod);
  const startYmd = range.start;
  const endYmd = range.end;

  const patientsRaw = getDashboardRowsByTable_(REPO_TABLES.PATIENTS || 'Patients');
  const appointmentsRaw = getDashboardRowsByTable_(REPO_TABLES.APPOINTMENTS || 'Appointments');
  const treatmentsRaw = getDashboardRowsByTable_(REPO_TABLES.TREATMENTS || 'Treatments');
  const treatmentItemsRaw = getDashboardRowsByTable_(REPO_TABLES.TREATMENT_ITEMS || 'TreatmentItems');

  if (!isDashboardUiReadSupabaseMode_()) {
    try {
      refreshAllOrthoRecallStatuses();
    } catch (err) {
      // Dashboard tetap jalan walaupun refresh recall gagal.
    }
  }

  const recallRaw = (typeof OrthoRecallRepository !== 'undefined' && OrthoRecallRepository.getOrthoRecallRaw)
    ? (OrthoRecallRepository.getOrthoRecallRaw(dashboardReadOptions) || [])
    : getDashboardRowsByTable_(REPO_TABLES.ORTHO_RECALL || 'OrthoRecall');

  const activePatients = [];
  const newPatients = [];

  patientsRaw.forEach(function(p) {
    const isActive = isPatientActiveValue(p.is_active);
    if (!isActive) return;

    activePatients.push(p);

    const createdYmd = extractYmd(p.created_at);
    if (isDateBetweenYmd(createdYmd, startYmd, endYmd)) {
      newPatients.push(p);
    }
  });

  const appointments = appointmentsRaw.map(normalizeDashboardAppointment);
  const treatments = treatmentsRaw.map(normalizeDashboardTreatment);
  const treatmentItems = treatmentItemsRaw.map(normalizeDashboardTreatmentItem);
  const recalls = recallRaw.map(normalizeDashboardRecall);

  const apptPeriod = [];
  const scheduled = [];
  const completed = [];
  const cancelled = [];

  appointments.forEach(function(a) {
    if (!isDateBetweenYmd(a.appointment_date, startYmd, endYmd)) return;

    apptPeriod.push(a);

    if (a.status === 'scheduled') scheduled.push(a);
    if (a.status === 'completed') completed.push(a);
    if (a.status === 'cancelled') cancelled.push(a);
  });

  const treatPeriod = [];
  const treatmentIdSet = {};
  const patientVisitCount = {};
  let treatmentValueTotal = 0;

  treatments.forEach(function(t) {
    patientVisitCount[t.patient_id] = (patientVisitCount[t.patient_id] || 0) + 1;

    if (!isDateBetweenYmd(t.treatment_date, startYmd, endYmd)) return;

    treatPeriod.push(t);
    treatmentIdSet[t.treatment_id] = true;
    treatmentValueTotal += Number(t.total_cost || 0);
  });

  const returningPatients = Object.keys(patientVisitCount).filter(function(pid) {
    return patientVisitCount[pid] > 1;
  });

  const avgTreatment = treatPeriod.length
    ? Math.round(treatmentValueTotal / treatPeriod.length)
    : 0;

  const serviceMap = {};

  treatmentItems.forEach(function(item) {
    if (!treatmentIdSet[item.treatment_id]) return;

    const name = String(item.service_name || 'Unknown');

    if (!serviceMap[name]) {
      serviceMap[name] = {
        name: name,
        qty: 0,
        total: 0
      };
    }

    serviceMap[name].qty += Number(item.qty || 0);
    serviceMap[name].total += Number(item.subtotal || 0);
  });

  const topServices = Object.values(serviceMap)
    .sort(function(a, b) {
      return b.qty - a.qty;
    })
    .slice(0, 5);

  const latestAppointments = appointments
    .slice()
    .sort(function(a, b) {
      const dateCompare = String(b.appointment_date || '').localeCompare(String(a.appointment_date || ''));
      if (dateCompare !== 0) return dateCompare;
      return String(b.appointment_time || '').localeCompare(String(a.appointment_time || ''));
    })
    .slice(0, 5);

  const latestTreatments = treatments
    .slice()
    .sort(function(a, b) {
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    })
    .slice(0, 5);

  const priorityAppointment = getPriorityAppointment(appointments);
  const recallSummary = buildDashboardRecallSummary(recalls);
  const financeSummary = buildDashboardFinanceSummary(startYmd, endYmd);
  const feedbackSummary = buildDashboardFeedbackSummary(startYmd, endYmd);

  const result = {
    success: true,
    data: {
      kpi: {
        appointment_total: apptPeriod.length,
        scheduled_total: scheduled.length,
        completed_total: completed.length,
        cancelled_total: cancelled.length,

        active_patients: activePatients.length,
        new_patients: newPatients.length,
        returning_patients: returningPatients.length,

        treatment_total: treatPeriod.length,
        treatment_value_total: treatmentValueTotal,
        revenue_total: treatmentValueTotal,
        avg_treatment: avgTreatment,

        billing_count: financeSummary.billing_count,
        gross_billing: financeSummary.gross_billing,
        discount_total: financeSummary.discount_total,
        net_billing: financeSummary.net_billing,
        cash_in: financeSummary.cash_in,
        outstanding_total: financeSummary.outstanding_total,
        unpaid_billing_count: financeSummary.unpaid_billing_count,

        completed_rate: apptPeriod.length ? Math.round((completed.length / apptPeriod.length) * 100) : 0,
        cancelled_rate: apptPeriod.length ? Math.round((cancelled.length / apptPeriod.length) * 100) : 0,

        recall_active_total: recallSummary.active_total,
        recall_due_total: recallSummary.due_total,
        recall_overdue_total: recallSummary.overdue_total,
        recall_reached_target_total: recallSummary.reached_target_total
      },
      priority_appointment: priorityAppointment,
      latest_appointments: latestAppointments,
      latest_treatments: latestTreatments,
      top_services: topServices,
      recall_summary: recallSummary,
      recall_due_list: recallSummary.due_list || [],
      feedback_summary: feedbackSummary,
      period: range
    }
  };

  putCachedJson(cacheKey, result, 20);
  return result;
}

function testDashboardServicePhase6GUiReadLog() {
  const result = {
    success: true,
    stage: '6G-DashboardService',
    checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
    ui_read_backend_mode: getDashboardUiReadBackendMode_(),
    ui_read_supabase_test_enabled: typeof repoIsUiReadSupabaseTestEnabled_ === 'function'
      ? repoIsUiReadSupabaseTestEnabled_()
      : false,
    issue_count: 0,
    issues: [],
    summary_probe: {}
  };

  try {
    const summary = getDashboardOwnerSummary('all');

    result.summary_probe.success = !!(summary && summary.success);
    result.summary_probe.period = summary && summary.data ? summary.data.period : null;
    result.summary_probe.kpi = summary && summary.data ? summary.data.kpi : null;

    if (!summary || !summary.success) {
      result.issues.push({
        issue: 'DASHBOARD_SUMMARY_FAILED'
      });
    }

    if (!result.summary_probe.kpi) {
      result.issues.push({
        issue: 'DASHBOARD_KPI_NOT_AVAILABLE'
      });
    }

    let supabaseWriteBlocked = false;
    let supabaseWriteMessage = '';

    try {
      dbInsert_(REPO_TABLES.APPOINTMENTS, {
        appointment_id: 'TEST-SHOULD-NOT-INSERT'
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
      stage: '6G-DashboardService',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error')
    };

    Logger.log(JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}