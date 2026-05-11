/* =========================================================
   FINANCE FEEDBACK SERVICE
   Feedback kepuasan layanan dari invoice digital
   ========================================================= */

function generateBillingFeedbackToken_() {
  return Utilities.getUuid().replace(/-/g, '') + '-' + generateSafeId('TOK');
}

function findBillingFeedbackRawByBillingId_(billingId) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) return null;

  return getBillingFeedbacksRaw().find(function(row) {
    return String(row.billing_id || '').trim() === normalizedBillingId;
  }) || null;
}

function findBillingFeedbackRawByToken_(token) {
  const normalizedToken = String(token || '').trim();

  if (!normalizedToken) return null;

  return getBillingFeedbacksRaw().find(function(row) {
    return String(row.feedback_token || '').trim() === normalizedToken;
  }) || null;
}

const CLOUDFLARE_FEEDBACK_PUBLIC_BASE_URL = 'https://feedback.hajaraswaddentalclinic.workers.dev/feedback';

function getBillingFeedbackBaseUrl_() {
  return CLOUDFLARE_FEEDBACK_PUBLIC_BASE_URL;
}

function buildBillingFeedbackUrl_(token) {
  const normalizedToken = String(token || '').trim();
  const baseUrl = getBillingFeedbackBaseUrl_();

  if (!baseUrl || !normalizedToken) return '';

  return baseUrl + '?token=' + encodeURIComponent(normalizedToken);
}

function ensureBillingFeedbackTokenForBilling(billingId, options) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'ENSURE_BILLING_FEEDBACK_TOKEN',
    module: 'FinanceFeedbackService',
    action: 'ensureBillingFeedbackTokenForBilling',
    __test_freeze_enabled: options && options.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const opts = options || {};
  const useLock = opts.use_lock !== false;
  const lock = useLock ? LockService.getScriptLock() : null;
  let lockAcquired = false;

  try {
    if (lock) {
      lock.waitLock(5000);
      lockAcquired = true;
    }

    return ensureBillingFeedbackTokenForBilling_(billingId, opts);

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat menyiapkan link feedback: ' + (err && err.message ? err.message : err)
    };
  } finally {
    if (lock && lockAcquired) {
      lock.releaseLock();
    }
  }
}

function ensureBillingFeedbackTokenForBilling_(billingId, options) {
  const opts = options || {};

  if (opts.ensure_setup === true) {
    setupFinanceStage1Sheets();
  }

  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) {
    return {
      success: false,
      message: 'Billing ID tidak ditemukan'
    };
  }

  const billing = findBillingRawById(normalizedBillingId);

  if (!billing) {
    return {
      success: false,
      message: 'Data billing tidak ditemukan'
    };
  }

  let feedback = findBillingFeedbackRawByBillingId_(normalizedBillingId);
  const now = nowIso();

  if (!feedback) {
    feedback = {
      feedback_id: generateNextBillingFeedbackId(),
      billing_id: normalizedBillingId,
      feedback_token: generateBillingFeedbackToken_(),
      feedback_status: 'pending',
      rating: '',
      service_quality: '',
      staff_friendliness: '',
      clinic_cleanliness: '',
      waiting_time: '',
      comment: '',
      submitted_at: '',
      patient_id: String(billing.patient_id || '').trim(),
      patient_name: String(billing.patient_name || '').trim(),
      created_at: now,
      updated_at: now
    };

    dbInsert_('BillingFeedbacks', feedback);

    if (typeof hardenFinanceTextColumnsForObjectRow_ === 'function' && !repoIsSupabaseBackendMode_()) {
      const hardenFeedbackRowRes = hardenFinanceTextColumnsForObjectRow_(
        'BillingFeedbacks',
        'feedback_id',
        feedback.feedback_id,
        feedback
      );

      if (!hardenFeedbackRowRes || !hardenFeedbackRowRes.success) {
        return {
          success: false,
          message: 'Feedback token tersimpan, tetapi hardening text row BillingFeedbacks gagal: ' +
            ((hardenFeedbackRowRes && hardenFeedbackRowRes.message) || 'Unknown error')
        };
      }
    }

  } else {
    const patch = {};

    if (!String(feedback.feedback_id || '').trim()) {
      patch.feedback_id = generateNextBillingFeedbackId();
    }

    if (!String(feedback.feedback_token || '').trim()) {
      patch.feedback_token = generateBillingFeedbackToken_();
    }

    if (!String(feedback.feedback_status || '').trim()) {
      patch.feedback_status = 'pending';
    }

    if (!String(feedback.patient_id || '').trim()) {
      patch.patient_id = String(billing.patient_id || '').trim();
    }

    if (!String(feedback.patient_name || '').trim()) {
      patch.patient_name = String(billing.patient_name || '').trim();
    }

    if (Object.keys(patch).length) {
      patch.updated_at = now;

      const updateKey = String(feedback.feedback_id || '').trim()
        ? 'feedback_id'
        : 'billing_id';

      const updateValue = String(feedback.feedback_id || '').trim()
        ? String(feedback.feedback_id || '').trim()
        : normalizedBillingId;

      const ok = dbUpdateById_('BillingFeedbacks', updateKey, updateValue, patch);

      if (!ok) {
        return {
          success: false,
          message: 'Gagal memperbarui token feedback billing'
        };
      }

      feedback = Object.assign({}, feedback, patch);

      if (typeof hardenFinanceTextColumnsForObjectRow_ === 'function' && !repoIsSupabaseBackendMode_()) {
        const hardenFeedbackUpdateRes = hardenFinanceTextColumnsForObjectRow_(
          'BillingFeedbacks',
          'feedback_id',
          String(feedback.feedback_id || '').trim(),
          feedback
        );

        if (!hardenFeedbackUpdateRes || !hardenFeedbackUpdateRes.success) {
          return {
            success: false,
            message: 'Token feedback berhasil diperbarui, tetapi hardening text row BillingFeedbacks gagal: ' +
              ((hardenFeedbackUpdateRes && hardenFeedbackUpdateRes.message) || 'Unknown error')
          };
        }
      }
    }
  }

  const feedbackToken = String(feedback.feedback_token || '').trim();

  if (!feedbackToken) {
    return {
      success: false,
      message: 'Token feedback gagal dibuat'
    };
  }

  const feedbackUrl = buildBillingFeedbackUrl_(feedbackToken);

  if (!feedbackUrl) {
    return {
      success: false,
      message: 'Web app URL belum tersedia. Deploy ulang Apps Script sebagai Web App terlebih dahulu.'
    };
  }

  return {
    success: true,
    data: {
      feedback: normalizeFinanceRow(feedback),
      feedback_url: feedbackUrl
    }
  };
}

function getBillingFeedbackByBillingId(billingId) {
  const normalizedBillingId = String(billingId || '').trim();

  if (!normalizedBillingId) {
    return {
      success: false,
      message: 'Billing ID tidak ditemukan'
    };
  }

  const feedback = findBillingFeedbackRawByBillingId_(normalizedBillingId);

  if (!feedback) {
    return {
      success: true,
      data: null
    };
  }

  return {
    success: true,
    data: normalizeFinanceRow(feedback)
  };
}

function normalizeBillingFeedbackForReport(row) {
  return {
    feedback_id: String(row.feedback_id || ''),
    billing_id: String(row.billing_id || ''),
    feedback_token: String(row.feedback_token || ''),
    feedback_status: String(row.feedback_status || '').trim().toLowerCase(),
    rating: Number(row.rating || 0),
    service_quality: String(row.service_quality || '').trim(),
    staff_friendliness: String(row.staff_friendliness || '').trim(),
    clinic_cleanliness: String(row.clinic_cleanliness || '').trim(),
    waiting_time: String(row.waiting_time || '').trim(),
    comment: String(row.comment || ''),
    submitted_at: formatCellValue(row.submitted_at || ''),
    submitted_ymd: financeExtractYmd_(row.submitted_at || ''),
    patient_id: String(row.patient_id || ''),
    patient_name: String(row.patient_name || ''),
    created_at: formatCellValue(row.created_at || ''),
    updated_at: formatCellValue(row.updated_at || '')
  };
}

function getBillingFeedbackSentiment_(rating) {
  const value = Number(rating || 0);

  if (value >= 4) return 'satisfied';
  if (value === 3) return 'neutral';
  if (value > 0) return 'unsatisfied';

  return 'unknown';
}

function buildBillingFeedbackSummaryForRange_(startYmd, endYmd, options) {
  const opts = options || {};
  const sourceFeedbacks = Array.isArray(opts.feedbacks)
    ? opts.feedbacks
    : getBillingFeedbacksRaw();

  const allFeedbacks = sourceFeedbacks
    .map(normalizeBillingFeedbackForReport);

  const submittedInPeriod = allFeedbacks.filter(function(row) {
    return row.feedback_status === 'submitted' &&
      financeIsDateBetweenYmd_(row.submitted_ymd, startYmd, endYmd);
  });

  const pendingAll = allFeedbacks.filter(function(row) {
    return row.feedback_status !== 'submitted';
  });

  let ratingSum = 0;
  let satisfiedCount = 0;
  let neutralCount = 0;
  let unsatisfiedCount = 0;

  const ratingDistribution = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0
  };

  submittedInPeriod.forEach(function(row) {
    const rating = Number(row.rating || 0);

    if (rating >= 1 && rating <= 5) {
      ratingSum += rating;
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
    }

    const sentiment = getBillingFeedbackSentiment_(rating);

    if (sentiment === 'satisfied') {
      satisfiedCount++;
    } else if (sentiment === 'neutral') {
      neutralCount++;
    } else if (sentiment === 'unsatisfied') {
      unsatisfiedCount++;
    }
  });

  const submittedCount = submittedInPeriod.length;
  const averageRating = submittedCount > 0
    ? Math.round((ratingSum / submittedCount) * 10) / 10
    : 0;

  const latestFeedbacks = submittedInPeriod
    .slice()
    .sort(function(a, b) {
      return String(b.submitted_at || '').localeCompare(String(a.submitted_at || ''));
    })
    .slice(0, 5);

  return {
    submitted_count: submittedCount,
    pending_count: pendingAll.length,
    average_rating: averageRating,
    satisfied_count: satisfiedCount,
    neutral_count: neutralCount,
    unsatisfied_count: unsatisfiedCount,
    rating_distribution: ratingDistribution,
    latest_feedbacks: latestFeedbacks
  };
}

function getBillingFeedbackSummary(period) {
  const range = getFinanceDateRange(period || 'today');

  return {
    success: true,
    data: {
      period: range,
      summary: buildBillingFeedbackSummaryForRange_(range.start, range.end)
    }
  };
}

function getBillingFeedbackPageData(token) {
  const normalizedToken = String(token || '').trim();

  if (!normalizedToken) {
    return {
      success: false,
      message: 'Token feedback tidak ditemukan'
    };
  }

  const feedback = findBillingFeedbackRawByToken_(normalizedToken);

  if (!feedback) {
    return {
      success: false,
      message: 'Link feedback tidak valid atau sudah tidak tersedia'
    };
  }

  const billing = findBillingRawById(feedback.billing_id);

  if (!billing) {
    return {
      success: false,
      message: 'Data billing tidak ditemukan'
    };
  }

  return {
    success: true,
    data: {
      feedback: normalizeFinanceRow(feedback),
      billing: normalizeFinanceRow(billing),
      already_submitted: String(feedback.feedback_status || '').trim().toLowerCase() === 'submitted'
    }
  };
}

function validateBillingFeedbackPayload_(payload) {
  const errors = {};

  const token = String((payload && payload.feedback_token) || '').trim();
  const rating = Number((payload && payload.rating) || 0);
  const serviceQuality = String((payload && payload.service_quality) || '').trim();
  const staffFriendliness = String((payload && payload.staff_friendliness) || '').trim();
  const clinicCleanliness = String((payload && payload.clinic_cleanliness) || '').trim();
  const waitingTime = String((payload && payload.waiting_time) || '').trim();
  const comment = String((payload && payload.comment) || '').trim();

  const allowedValues = ['very_satisfied', 'satisfied', 'neutral', 'not_satisfied'];

  if (!token) {
    errors.feedback_token = 'Token feedback tidak ditemukan';
  }

  if (!rating || rating < 1 || rating > 5) {
    errors.rating = 'Rating wajib dipilih antara 1 sampai 5';
  }

  if (!serviceQuality || allowedValues.indexOf(serviceQuality) === -1) {
    errors.service_quality = 'Kualitas layanan wajib dipilih';
  }

  if (!staffFriendliness || allowedValues.indexOf(staffFriendliness) === -1) {
    errors.staff_friendliness = 'Keramahan staf wajib dipilih';
  }

  if (!clinicCleanliness || allowedValues.indexOf(clinicCleanliness) === -1) {
    errors.clinic_cleanliness = 'Kebersihan klinik wajib dipilih';
  }

  if (!waitingTime || allowedValues.indexOf(waitingTime) === -1) {
    errors.waiting_time = 'Penilaian waktu tunggu wajib dipilih';
  }

  if (comment.length > 1000) {
    errors.comment = 'Komentar maksimal 1000 karakter';
  }

  return errors;
}

function submitBillingFeedback(payload) {
  const freezeCheck = repoCheckProductionMutationAllowed_({
    operation: 'SUBMIT_BILLING_FEEDBACK',
    module: 'FinanceFeedbackService',
    action: 'submitBillingFeedback',
    __test_freeze_enabled: payload && payload.__test_freeze_enabled === true
  });

  if (!freezeCheck.allowed) {
    return {
      success: false,
      message: freezeCheck.message
    };
  }

  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    lock.waitLock(5000);
    locked = true;

    const errors = validateBillingFeedbackPayload_(payload);

    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        message: 'Validasi gagal',
        errors: errors
      };
    }

    const token = String(payload.feedback_token || '').trim();
    const feedback = findBillingFeedbackRawByToken_(token);

    if (!feedback) {
      return {
        success: false,
        message: 'Link feedback tidak valid atau sudah tidak tersedia'
      };
    }

    const currentStatus = String(feedback.feedback_status || '').trim().toLowerCase();

    if (currentStatus === 'submitted') {
      return {
        success: false,
        message: 'Feedback untuk invoice ini sudah pernah dikirim'
      };
    }

    const now = nowIso();

    const updated = {
      feedback_status: 'submitted',
      rating: Number(payload.rating || 0),
      service_quality: String(payload.service_quality || '').trim(),
      staff_friendliness: String(payload.staff_friendliness || '').trim(),
      clinic_cleanliness: String(payload.clinic_cleanliness || '').trim(),
      waiting_time: String(payload.waiting_time || '').trim(),
      comment: String(payload.comment || '').trim(),
      submitted_at: now,
      updated_at: now
    };

    const ok = dbUpdateById_('BillingFeedbacks', 'feedback_id', feedback.feedback_id, updated);

    if (!ok) {
      return {
        success: false,
        message: 'Gagal menyimpan feedback'
      };
    }

    const savedFeedback = Object.assign({}, feedback, updated);

    if (typeof hardenFinanceTextColumnsForObjectRow_ === 'function' && !repoIsSupabaseBackendMode_()) {
      const hardenSubmittedFeedbackRes = hardenFinanceTextColumnsForObjectRow_(
        'BillingFeedbacks',
        'feedback_id',
        String(savedFeedback.feedback_id || '').trim(),
        savedFeedback
      );

      if (!hardenSubmittedFeedbackRes || !hardenSubmittedFeedbackRes.success) {
        return {
          success: false,
          message: 'Feedback tersimpan, tetapi hardening text row BillingFeedbacks gagal: ' +
            ((hardenSubmittedFeedbackRes && hardenSubmittedFeedbackRes.message) || 'Unknown error')
        };
      }
    }

    return {
      success: true,
      message: 'Terima kasih, feedback Anda berhasil dikirim',
      data: normalizeFinanceRow(savedFeedback)
    };

  } catch (err) {
    return {
      success: false,
      message: 'Terjadi kesalahan saat menyimpan feedback: ' + (err && err.message ? err.message : err)
    };
  } finally {
    if (locked) {
      lock.releaseLock();
    }
  }
}

/* =========================================================
   FINANCE FEEDBACK MANUAL TESTS / DEV ONLY
   Function di bawah ini hanya untuk inspeksi manual feedback.
   Tidak dipanggil otomatis oleh UI Finance.
   ========================================================= */

function testEnsureBillingFeedbackTokenManual() {
  const billingId = 'ISI_BILLING_ID_DI_SINI';

  if (!billingId || billingId === 'ISI_BILLING_ID_DI_SINI') {
    const result = {
      success: false,
      message: 'Isi billingId terlebih dahulu untuk menjalankan test token feedback manual'
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }

  const result = ensureBillingFeedbackTokenForBilling(billingId, {
    ensure_setup: true
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testGetBillingFeedbackByBillingIdManual() {
  const billingId = 'ISI_BILLING_ID_DI_SINI';

  if (!billingId || billingId === 'ISI_BILLING_ID_DI_SINI') {
    const result = {
      success: false,
      message: 'Isi billingId terlebih dahulu untuk menjalankan test feedback billing manual'
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }

  const result = getBillingFeedbackByBillingId(billingId);

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testGetBillingFeedbackSummaryToday() {
  const result = getBillingFeedbackSummary('today');

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testCutoverPhase8BFinanceFeedbackFreezeGuardLog() {
  const result = {
    success: true,
    stage: '8B-9-FinanceFeedbackService-FreezeGuard',
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
      default_off_ensure_token_normal_flow_reached: false,
      default_off_submit_feedback_normal_flow_reached: false,
      simulated_freeze_ensure_token_blocked: false,
      simulated_freeze_submit_feedback_blocked: false,
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
      billings: getBillingsRaw().length,
      billing_feedbacks: getBillingFeedbacksRaw().length
    };
  }

  function isFreezeMessage_(res) {
    return !!(
      res &&
      res.success === false &&
      String(res.message || '').indexOf('Sistem sedang dalam proses migrasi database') !== -1
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

    const defaultOffEnsure = ensureBillingFeedbackTokenForBilling('', {
      use_lock: false
    });

    result.messages.default_off_ensure_token = defaultOffEnsure && defaultOffEnsure.message
      ? defaultOffEnsure.message
      : '';

    result.checks.default_off_ensure_token_normal_flow_reached = !!(
      defaultOffEnsure &&
      defaultOffEnsure.success === false &&
      (
        defaultOffEnsure.message === 'Billing ID tidak ditemukan' ||
        defaultOffEnsure.message === 'Data billing tidak ditemukan'
      )
    );

    if (!result.checks.default_off_ensure_token_normal_flow_reached) {
      addIssue('DEFAULT_OFF_ENSURE_TOKEN_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffEnsure
      });
    }

    const defaultOffSubmit = submitBillingFeedback({
      feedback_token: '',
      rating: 0,
      service_quality: '',
      staff_friendliness: '',
      clinic_cleanliness: '',
      waiting_time: '',
      comment: ''
    });

    result.messages.default_off_submit_feedback = defaultOffSubmit && defaultOffSubmit.message
      ? defaultOffSubmit.message
      : '';

    result.checks.default_off_submit_feedback_normal_flow_reached = !!(
      defaultOffSubmit &&
      defaultOffSubmit.success === false &&
      (
        defaultOffSubmit.message === 'Validasi gagal' ||
        defaultOffSubmit.message === 'Link feedback tidak valid atau sudah tidak tersedia'
      )
    );

    if (!result.checks.default_off_submit_feedback_normal_flow_reached) {
      addIssue('DEFAULT_OFF_SUBMIT_FEEDBACK_DID_NOT_REACH_NORMAL_FLOW', {
        response: defaultOffSubmit
      });
    }

    const simulatedFreezeEnsure = ensureBillingFeedbackTokenForBilling(
      'BIL-20260505-140855694-907',
      {
        use_lock: false,
        __test_freeze_enabled: true
      }
    );

    result.messages.simulated_freeze_ensure_token = simulatedFreezeEnsure && simulatedFreezeEnsure.message
      ? simulatedFreezeEnsure.message
      : '';

    result.checks.simulated_freeze_ensure_token_blocked = isFreezeMessage_(simulatedFreezeEnsure);

    if (!result.checks.simulated_freeze_ensure_token_blocked) {
      addIssue('SIMULATED_FREEZE_ENSURE_TOKEN_NOT_BLOCKED', {
        response: simulatedFreezeEnsure
      });
    }

    const simulatedFreezeSubmit = submitBillingFeedback({
      __test_freeze_enabled: true,
      feedback_token: 'TOKEN-SHOULD-NOT-WRITE-8B',
      rating: 5,
      service_quality: 'very_satisfied',
      staff_friendliness: 'very_satisfied',
      clinic_cleanliness: 'very_satisfied',
      waiting_time: 'very_satisfied',
      comment: 'SHOULD NOT WRITE 8B'
    });

    result.messages.simulated_freeze_submit_feedback = simulatedFreezeSubmit && simulatedFreezeSubmit.message
      ? simulatedFreezeSubmit.message
      : '';

    result.checks.simulated_freeze_submit_feedback_blocked = isFreezeMessage_(simulatedFreezeSubmit);

    if (!result.checks.simulated_freeze_submit_feedback_blocked) {
      addIssue('SIMULATED_FREEZE_SUBMIT_FEEDBACK_NOT_BLOCKED', {
        response: simulatedFreezeSubmit
      });
    }

    result.after_counts = getCounts_();

    result.checks.counts_unchanged =
      result.after_counts.billings === result.before_counts.billings &&
      result.after_counts.billing_feedbacks === result.before_counts.billing_feedbacks;

    if (!result.checks.counts_unchanged) {
      addIssue('FINANCE_FEEDBACK_COUNTS_CHANGED_DURING_FREEZE_GUARD_TEST', {
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
      stage: '8B-9-FinanceFeedbackService-FreezeGuard',
      checked_at: typeof nowIso === 'function' ? nowIso() : new Date().toISOString(),
      message: err && err.message ? err.message : String(err || 'Unknown error'),
      issue_count: 1,
      issues: [
        {
          issue: 'FINANCE_FEEDBACK_FREEZE_GUARD_TEST_ERROR',
          message: err && err.message ? err.message : String(err || 'Unknown error')
        }
      ]
    };

    Logger.log(JSON.stringify(errorResult));
    return errorResult;
  }
}