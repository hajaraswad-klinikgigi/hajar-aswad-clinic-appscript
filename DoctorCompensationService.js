/* =========================================================
   DOCTOR COMPENSATION SERVICE
   Kalkulasi dan manajemen fee dokter berdasarkan aturan
   yang tersimpan di tabel doctor_compensation_rules.
   ========================================================= */

const DOCTOR_COMP_OPTIONS = { backend_mode: 'supabase' };

/* =========================================================
   HELPERS INTERNAL
   ========================================================= */

function getDoctorCompRulesRaw_() {
  return dbFindAll_('DoctorCompensationRules', DOCTOR_COMP_OPTIONS);
}

function buildServiceIndex_() {
  const services = dbFindAll_('ServiceCatalog', DOCTOR_COMP_OPTIONS);
  const index = {};
  services.forEach(function(s) { index[s.service_id] = s; });
  return index;
}

function buildRuleIndex_() {
  const rules = getDoctorCompRulesRaw_();
  const index = {};
  rules.forEach(function(r) { index[r.doctor_name] = r; });
  return index;
}

function calculateFeeForTreatment_(treatment, items, serviceIndex, rule) {
  if (!rule) {
    return {
      doctor_name: treatment.doctor_name,
      fee_total: 0, skipped: true,
      warning: 'Tidak ada konfigurasi fee untuk dokter ini'
    };
  }

  if (rule.fee_type === 'fixed') {
    return {
      doctor_name: treatment.doctor_name,
      fee_total: 0, skipped: true,
      skip_reason: 'fixed_salary'
    };
  }

  const basePct    = Number(rule.base_percentage || 0);
  const controlPct = Number(rule.control_percentage || basePct);
  const matDeduct  = Number(rule.material_deduction || 0);

  let feeTotal = 0;
  const breakdown = [];

  (items || []).forEach(function(item) {
    const svc      = serviceIndex[item.service_id] || {};
    const isCtrl   = svc.is_ortho_control === true;
    const subtotal = Number(item.subtotal || 0);
    const pct      = isCtrl ? controlPct : basePct;

    if (!pct || !subtotal) return;

    let fee = subtotal * pct;
    if (matDeduct > 0) fee = fee * (1 - matDeduct);

    feeTotal += fee;
    breakdown.push({
      service_name:       item.service_name,
      subtotal:           subtotal,
      is_control:         isCtrl,
      percentage_used:    pct,
      material_deduction: matDeduct,
      fee:                Math.round(fee)
    });
  });

  return {
    doctor_name: treatment.doctor_name,
    fee_total:   Math.round(feeTotal),
    breakdown:   breakdown,
    skipped:     false
  };
}

function checkFeeAlreadyConfirmed_(date) {
  const all = dbFindAll_('Expenses', DOCTOR_COMP_OPTIONS);
  return all.some(function(e) {
    return String(e.expense_date || '').slice(0, 10) === date &&
           String(e.category || '') === 'doctor_fee';
  });
}

/* =========================================================
   READ
   ========================================================= */

function getDoctorCompensationRules(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const rules = getDoctorCompRulesRaw_();
    return { success: true, data: rules };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil data: ' + (err.message || err) };
  }
}

function getDoctorCompensationRule(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const doctorName = String((payload && payload.doctor_name) || '').trim();
    if (!doctorName) return { success: false, message: 'doctor_name wajib diisi.' };

    const rule = dbFindById_(
      'DoctorCompensationRules', 'doctor_name', doctorName, DOCTOR_COMP_OPTIONS
    );
    if (!rule) return { success: false, message: 'Konfigurasi tidak ditemukan: ' + doctorName };

    return { success: true, data: rule };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil data: ' + (err.message || err) };
  }
}

/* =========================================================
   WRITE (untuk halaman Settings)
   ========================================================= */

function addDoctorCompensationRule(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const doctorName = String((payload && payload.doctor_name) || '').trim();
    const feeType    = String((payload && payload.fee_type) || '').trim();

    if (!doctorName) return { success: false, message: 'Nama dokter wajib diisi.' };
    if (!feeType || ['percentage', 'fixed'].indexOf(feeType) === -1) {
      return { success: false, message: 'fee_type harus percentage atau fixed.' };
    }
    if (feeType === 'percentage' && !payload.base_percentage) {
      return { success: false, message: 'base_percentage wajib diisi untuk sistem persentase.' };
    }
    if (feeType === 'fixed' && !payload.fixed_salary) {
      return { success: false, message: 'fixed_salary wajib diisi untuk sistem gaji tetap.' };
    }

    const row = {
      doctor_name:        doctorName,
      fee_type:           feeType,
      fixed_salary:       payload.fixed_salary ? Number(payload.fixed_salary) : null,
      base_percentage:    payload.base_percentage ? Number(payload.base_percentage) : null,
      control_percentage: payload.control_percentage ? Number(payload.control_percentage) : null,
      material_deduction: payload.material_deduction ? Number(payload.material_deduction) : null,
      is_active:          true,
      notes:              payload.notes ? String(payload.notes).trim() : null
    };

    const inserted = dbInsert_('DoctorCompensationRules', row, DOCTOR_COMP_OPTIONS);
    return { success: true, data: inserted };
  } catch (err) {
    return { success: false, message: 'Gagal menyimpan: ' + (err.message || err) };
  }
}

function updateDoctorCompensationRule(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const doctorName = String((payload && payload.doctor_name) || '').trim();
    if (!doctorName) return { success: false, message: 'doctor_name wajib diisi.' };

    const patch = {};
    const fields = [
      'fee_type', 'fixed_salary', 'base_percentage',
      'control_percentage', 'material_deduction', 'is_active', 'notes'
    ];
    fields.forEach(function(f) {
      if (payload[f] !== undefined) patch[f] = payload[f];
    });
    patch.updated_at = new Date().toISOString();

    const updated = dbUpdateById_(
      'DoctorCompensationRules', 'doctor_name', doctorName, patch, DOCTOR_COMP_OPTIONS
    );
    return { success: true, data: updated };
  } catch (err) {
    return { success: false, message: 'Gagal update: ' + (err.message || err) };
  }
}

/* =========================================================
   KALKULASI FEE (CORE)
   ========================================================= */

function calculateDoctorFeeDraft(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const date = String((payload && payload.date) || formatTodayYmd()).trim();
    const opts = DOCTOR_COMP_OPTIONS;

    const treatments = dbFindWhere_('Treatments',
      function(t) { return String(t.treatment_date || '').slice(0, 10) === date; },
      opts
    );

    const treatmentIds = treatments.map(function(t) { return t.treatment_id; });

    const allItems = treatmentIds.length
      ? dbFindWhere_('TreatmentItems',
          function(i) { return treatmentIds.indexOf(i.treatment_id) !== -1; },
          opts
        )
      : [];

    const serviceIndex = buildServiceIndex_();
    const ruleIndex    = buildRuleIndex_();

    const itemsByTreatment = {};
    allItems.forEach(function(item) {
      if (!itemsByTreatment[item.treatment_id]) itemsByTreatment[item.treatment_id] = [];
      itemsByTreatment[item.treatment_id].push(item);
    });

    const feeByDoctor = {};
    const warnings = [];

    treatments.forEach(function(treatment) {
      const dName = String(treatment.doctor_name || '').trim();
      if (!dName) return;

      const rule  = ruleIndex[dName];
      const items = itemsByTreatment[treatment.treatment_id] || [];
      const res   = calculateFeeForTreatment_(treatment, items, serviceIndex, rule);

      if (res.warning) warnings.push(res.warning);

      if (!feeByDoctor[dName]) {
        feeByDoctor[dName] = {
          doctor_name:     dName,
          fee_type:        rule ? rule.fee_type : 'unknown',
          is_calculated:   !res.skipped,
          skip_reason:     res.skip_reason || null,
          warning:         res.warning || null,
          fee_total:       0,
          treatment_count: 0,
          breakdown:       []
        };
      }

      feeByDoctor[dName].fee_total += res.fee_total;
      feeByDoctor[dName].treatment_count++;
      feeByDoctor[dName].breakdown = feeByDoctor[dName].breakdown.concat(res.breakdown || []);
    });

    const doctors = Object.keys(feeByDoctor).map(function(k) { return feeByDoctor[k]; });
    const totalAutoFee = doctors.reduce(function(s, d) { return s + (d.fee_total || 0); }, 0);
    const alreadyConfirmed = checkFeeAlreadyConfirmed_(date);

    return {
      success: true,
      data: {
        date:              date,
        warnings:          warnings,
        doctors:           doctors,
        total_auto_fee:    totalAutoFee,
        already_confirmed: alreadyConfirmed
      }
    };

  } catch (err) {
    return { success: false, message: 'Gagal kalkulasi fee: ' + (err.message || err) };
  }
}

function confirmDoctorFeeToExpenses(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const date       = String((payload && payload.date) || '').trim();
    const doctorFees = Array.isArray(payload && payload.doctor_fees) ? payload.doctor_fees : [];

    if (!date) return { success: false, message: 'date wajib diisi.' };
    if (!doctorFees.length) return { success: false, message: 'doctor_fees tidak boleh kosong.' };

    let created = 0;
    const createdExpenses = [];
    doctorFees.forEach(function(df) {
      const dName = String(df.doctor_name || '').trim();
      const amt   = Number(df.fee_amount || 0);
      if (!dName || amt <= 0) return;

      const expenseId = 'EXP-' + date.replace(/-/g, '') + '-FEE-' +
                        dName.replace(/\s+/g, '').toUpperCase().slice(0, 8);

      const expenseRow = {
        expense_id:   expenseId,
        expense_date: date,
        category:     'doctor_fee',
        description:  'Fee dokter ' + dName + ' - ' + date,
        amount:       amt,
        doctor_name:  dName,
        recorded_by:  auth.user.username,
        notes:        df.notes ? String(df.notes).trim() : null
      };

      const inserted = dbInsert_('Expenses', expenseRow, DOCTOR_COMP_OPTIONS);
      createdExpenses.push(inserted || expenseRow);
      created++;
    });

    return { success: true, data: { expenses_created: created, expenses: createdExpenses } };
  } catch (err) {
    return { success: false, message: 'Gagal simpan fee: ' + (err.message || err) };
  }
}
