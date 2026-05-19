/* =========================================================
   DOCTOR COMPENSATION SERVICE
   Kalkulasi & manajemen fee dokter.

   Model:
   - doctor_compensation_rules: percentage/fixed + operational_deduction.
   - doctor_material_deductions: potongan bahan/lab per (dokter, layanan,
     kategori) dalam NOMINAL Rupiah, dengan tipe hitung fixed | per_tooth.

   Formula fee per treatment:
     bahan = SUM(potongan kategori='material' utk tiap item)
     lab   = SUM(potongan kategori='lab'      utk tiap item)
     fee   = (subtotal_treatment - bahan - lab)
             × (1 - operational_deduction)
             × percentage
   ========================================================= */

const DOCTOR_COMP_OPTIONS = { backend_mode: 'supabase' };

/* =========================================================
   HELPERS INTERNAL
   ========================================================= */

function getDoctorCompRulesRaw_() {
  return dbFindAll_('DoctorCompensationRules', DOCTOR_COMP_OPTIONS);
}

function getDoctorMaterialDeductionsRaw_() {
  return dbFindAll_('DoctorMaterialDeductions', DOCTOR_COMP_OPTIONS);
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

/**
 * Build index potongan: doctor_name → service_id → category → rule
 */
function buildDeductionIndex_() {
  const rows = getDoctorMaterialDeductionsRaw_().filter(function(r) {
    return r.is_active !== false;
  });
  const index = {};
  rows.forEach(function(r) {
    const dn = String(r.doctor_name || '');
    const sid = String(r.service_id || '');
    const cat = String(r.category || '');
    if (!index[dn]) index[dn] = {};
    if (!index[dn][sid]) index[dn][sid] = {};
    index[dn][sid][cat] = r;
  });
  return index;
}

/**
 * Hitung nominal potongan untuk satu item treatment dan satu kategori (material/lab).
 * Returns 0 kalau tidak ada aturan match.
 */
function computeDeductionAmount_(rule, qty) {
  if (!rule) return 0;
  const q = Math.max(0, Number(qty || 0));
  if (q <= 0) return 0;

  switch (String(rule.deduction_type || '')) {
    case 'fixed':
      return Number(rule.amount || 0);

    case 'per_tooth':
      return Number(rule.per_tooth_amount || 0) * q;

    default:
      return 0;
  }
}

/**
 * Hitung total bahan & lab untuk satu treatment, lookup dari deductionIndex.
 */
function computeMaterialAndLabForTreatment_(items, doctorName, deductionIndex) {
  var totalMaterial = 0;
  var totalLab = 0;
  const breakdown = [];
  const perDoctor = deductionIndex[doctorName] || {};

  (items || []).forEach(function(item) {
    const sid = String(item.service_id || '');
    const qty = Number(item.qty || 0);
    const perService = perDoctor[sid] || {};

    const matRule = perService['material'];
    const labRule = perService['lab'];
    const matAmt = computeDeductionAmount_(matRule, qty);
    const labAmt = computeDeductionAmount_(labRule, qty);

    totalMaterial += matAmt;
    totalLab      += labAmt;

    if (matAmt > 0 || labAmt > 0) {
      breakdown.push({
        treatment_item_id: item.treatment_item_id,
        service_id:        sid,
        service_name:      item.service_name,
        qty:               qty,
        material_amount:   matAmt,
        lab_amount:        labAmt
      });
    }
  });

  return { material: totalMaterial, lab: totalLab, breakdown: breakdown };
}

function calculateFeeForTreatment_(treatment, items, serviceIndex, rule, deductionIndex) {
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
  const opDeduct   = Math.min(1, Math.max(0, Number(rule.operational_deduction || 0)));

  let subtotal = 0;
  let hasControl = false;
  let hasNonControl = false;
  const itemBreakdown = [];

  (items || []).forEach(function(item) {
    const svc      = serviceIndex[item.service_id] || {};
    const isCtrl   = svc.is_ortho_control === true;
    const itemSubtotal = Number(item.subtotal || 0);
    if (!itemSubtotal) return;

    subtotal += itemSubtotal;
    if (isCtrl) hasControl = true; else hasNonControl = true;

    itemBreakdown.push({
      service_name: item.service_name,
      subtotal:     itemSubtotal,
      is_control:   isCtrl
    });
  });

  if (subtotal <= 0) {
    return {
      doctor_name: treatment.doctor_name,
      fee_total: 0, skipped: false,
      subtotal: 0, material: 0, lab: 0,
      operational_deduction: opDeduct,
      percentage_used: basePct, breakdown: []
    };
  }

  // Potongan bahan & lab
  const md = computeMaterialAndLabForTreatment_(items, treatment.doctor_name, deductionIndex);

  // Persentase: kalau ada item kontrol DAN non-kontrol, kita pakai kombinasi
  // proporsional (subtotal kontrol × controlPct + subtotal non-control × basePct) / subtotal.
  // Selama treatment yg normal hanya berisi salah satu jenis, hasil = pct tunggal.
  let percentage;
  if (hasControl && hasNonControl) {
    const ctrlSub = itemBreakdown
      .filter(function(b) { return b.is_control; })
      .reduce(function(s, b) { return s + b.subtotal; }, 0);
    const nonSub = subtotal - ctrlSub;
    percentage = (ctrlSub * controlPct + nonSub * basePct) / subtotal;
  } else if (hasControl) {
    percentage = controlPct;
  } else {
    percentage = basePct;
  }

  const afterDeduction = Math.max(0, subtotal - md.material - md.lab);
  const afterOperational = afterDeduction * (1 - opDeduct);
  const fee = afterOperational * percentage;

  return {
    doctor_name:           treatment.doctor_name,
    fee_total:             Math.round(fee),
    subtotal:              subtotal,
    material:              md.material,
    lab:                   md.lab,
    operational_deduction: opDeduct,
    percentage_used:       percentage,
    breakdown:             itemBreakdown,
    material_breakdown:    md.breakdown,
    skipped:               false
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
   READ — Compensation Rules
   ========================================================= */

function getDoctorCompensationRules(payload) {
  try {
    const auth = requireRole(payload, ['admin_finance']);
    if (!auth.success) return auth;

    const rules = getDoctorCompRulesRaw_();
    return { success: true, data: rules };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil data: ' + (err.message || err) };
  }
}

function getDoctorCompensationRule(payload) {
  try {
    const auth = requireRole(payload, ['admin_finance']);
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
   WRITE — Compensation Rules
   ========================================================= */

function addDoctorCompensationRule(payload) {
  try {
    const auth = requireRole(payload, []);
    if (!auth.success) return auth;

    const doctorName = String((payload && payload.doctor_name) || '').trim();
    const feeType    = String((payload && payload.fee_type) || '').trim();

    if (!doctorName) return { success: false, message: 'Nama dokter wajib diisi.' };
    if (!feeType || ['percentage', 'fixed'].indexOf(feeType) === -1) {
      return { success: false, message: 'fee_type harus percentage atau fixed.' };
    }

    // base_percentage/fixed_salary boleh null saat create — diisi via Edit setelah dokter dibuat.
    const opDeduct = payload.operational_deduction !== undefined && payload.operational_deduction !== null
      ? Number(payload.operational_deduction) : 0;
    if (opDeduct < 0 || opDeduct > 1) {
      return { success: false, message: 'operational_deduction harus antara 0 dan 1.' };
    }

    const row = {
      doctor_name:           doctorName,
      fee_type:              feeType,
      fixed_salary:          payload.fixed_salary ? Number(payload.fixed_salary) : null,
      base_percentage:       payload.base_percentage ? Number(payload.base_percentage) : null,
      control_percentage:    payload.control_percentage ? Number(payload.control_percentage) : null,
      operational_deduction: opDeduct,
      is_active:             true,
      notes:                 payload.notes ? String(payload.notes).trim() : null
    };

    const inserted = dbInsert_('DoctorCompensationRules', row, DOCTOR_COMP_OPTIONS);

    writeAuditLog_({
      actor: auth.user,
      entity_type: 'doctor_compensation_rule',
      entity_id: doctorName,
      action: 'create',
      old_value: null,
      new_value: inserted
    });

    return { success: true, data: inserted };
  } catch (err) {
    return { success: false, message: 'Gagal menyimpan: ' + (err.message || err) };
  }
}

function updateDoctorCompensationRule(payload) {
  try {
    const auth = requireRole(payload, []);
    if (!auth.success) return auth;

    const doctorName = String((payload && payload.doctor_name) || '').trim();
    if (!doctorName) return { success: false, message: 'doctor_name wajib diisi.' };

    const oldRule = dbFindById_('DoctorCompensationRules', 'doctor_name', doctorName, DOCTOR_COMP_OPTIONS);

    const patch = {};
    const fields = [
      'fee_type', 'fixed_salary', 'base_percentage',
      'control_percentage', 'operational_deduction', 'is_active', 'notes'
    ];
    fields.forEach(function(f) {
      if (payload[f] !== undefined) patch[f] = payload[f];
    });

    if (patch.operational_deduction !== undefined && patch.operational_deduction !== null) {
      const v = Number(patch.operational_deduction);
      if (isNaN(v) || v < 0 || v > 1) {
        return { success: false, message: 'operational_deduction harus antara 0 dan 1.' };
      }
      patch.operational_deduction = v;
    }

    patch.updated_at = new Date().toISOString();

    const updated = dbUpdateById_(
      'DoctorCompensationRules', 'doctor_name', doctorName, patch, DOCTOR_COMP_OPTIONS
    );

    // Deteksi semantik action: pure is_active toggle → activate/deactivate, else update.
    const patchKeysExcludingMeta = Object.keys(patch).filter(function(k) { return k !== 'updated_at'; });
    let auditAction = 'update';
    if (patchKeysExcludingMeta.length === 1 && patchKeysExcludingMeta[0] === 'is_active') {
      auditAction = patch.is_active === false ? 'deactivate' : 'activate';
    }

    writeAuditLog_({
      actor: auth.user,
      entity_type: 'doctor_compensation_rule',
      entity_id: doctorName,
      action: auditAction,
      old_value: oldRule,
      new_value: updated
    });

    return { success: true, data: updated };
  } catch (err) {
    return { success: false, message: 'Gagal update: ' + (err.message || err) };
  }
}

/* =========================================================
   READ — Material/Lab Deductions
   ========================================================= */

function getDoctorMaterialDeductions(payload) {
  try {
    const auth = requireRole(payload, ['admin_finance']);
    if (!auth.success) return auth;

    const doctorName = String((payload && payload.doctor_name) || '').trim();
    const all = getDoctorMaterialDeductionsRaw_();
    const data = doctorName
      ? all.filter(function(r) { return String(r.doctor_name) === doctorName; })
      : all;
    return { success: true, data: data };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil data: ' + (err.message || err) };
  }
}

/* =========================================================
   WRITE — Material/Lab Deductions
   ========================================================= */

function validateDeductionPayload_(payload) {
  const category = String((payload && payload.category) || '').trim();
  if (['material', 'lab'].indexOf(category) === -1) {
    return { ok: false, message: 'category harus material atau lab.' };
  }
  const type = String((payload && payload.deduction_type) || '').trim();
  if (['fixed', 'per_tooth'].indexOf(type) === -1) {
    return { ok: false, message: 'deduction_type harus fixed atau per_tooth.' };
  }
  if (type === 'fixed') {
    const a = Number(payload.amount);
    if (isNaN(a) || a < 0) return { ok: false, message: 'amount wajib > 0 untuk tipe fixed.' };
  } else if (type === 'per_tooth') {
    const a = Number(payload.per_tooth_amount);
    if (isNaN(a) || a < 0) return { ok: false, message: 'per_tooth_amount wajib > 0 untuk tipe per_tooth.' };
  }
  return { ok: true };
}

function buildDeductionRow_(payload) {
  const type = String(payload.deduction_type).trim();
  return {
    doctor_name:      String(payload.doctor_name || '').trim(),
    service_id:       String(payload.service_id || '').trim(),
    category:         String(payload.category).trim(),
    deduction_type:   type,
    amount:           type === 'fixed' ? Number(payload.amount) : null,
    per_tooth_amount: type === 'per_tooth' ? Number(payload.per_tooth_amount) : null,
    is_active:        true,
    notes:            payload.notes ? String(payload.notes).trim() : null
  };
}

function addDoctorMaterialDeduction(payload) {
  try {
    const auth = requireRole(payload, []);
    if (!auth.success) return auth;

    if (!payload.doctor_name) return { success: false, message: 'doctor_name wajib diisi.' };
    if (!payload.service_id)  return { success: false, message: 'service_id wajib diisi.' };

    const v = validateDeductionPayload_(payload);
    if (!v.ok) return { success: false, message: v.message };

    const row = buildDeductionRow_(payload);
    const inserted = dbInsert_('DoctorMaterialDeductions', row, DOCTOR_COMP_OPTIONS);

    writeAuditLog_({
      actor: auth.user,
      entity_type: 'doctor_material_deduction',
      entity_id: String((inserted && inserted.id) || ''),
      action: 'create',
      old_value: null,
      new_value: inserted
    });

    return { success: true, data: inserted };
  } catch (err) {
    return { success: false, message: 'Gagal menyimpan: ' + (err.message || err) };
  }
}

function updateDoctorMaterialDeduction(payload) {
  try {
    const auth = requireRole(payload, []);
    if (!auth.success) return auth;

    const id = payload && payload.id;
    if (!id) return { success: false, message: 'id wajib diisi.' };

    // Kalau client mengirim deduction_type baru, perlu re-validate
    if (payload.deduction_type) {
      const v = validateDeductionPayload_(payload);
      if (!v.ok) return { success: false, message: v.message };
    }

    const oldRow = dbFindById_('DoctorMaterialDeductions', 'id', id, DOCTOR_COMP_OPTIONS);

    const patch = {};
    const fields = [
      'service_id', 'category', 'deduction_type',
      'amount', 'per_tooth_amount',
      'is_active', 'notes'
    ];
    fields.forEach(function(f) {
      if (payload[f] !== undefined) patch[f] = payload[f];
    });
    patch.updated_at = new Date().toISOString();

    const updated = dbUpdateById_(
      'DoctorMaterialDeductions', 'id', id, patch, DOCTOR_COMP_OPTIONS
    );

    const patchKeysExcludingMeta = Object.keys(patch).filter(function(k) { return k !== 'updated_at'; });
    let auditAction = 'update';
    if (patchKeysExcludingMeta.length === 1 && patchKeysExcludingMeta[0] === 'is_active') {
      auditAction = patch.is_active === false ? 'deactivate' : 'activate';
    }

    writeAuditLog_({
      actor: auth.user,
      entity_type: 'doctor_material_deduction',
      entity_id: String(id),
      action: auditAction,
      old_value: oldRow,
      new_value: updated
    });

    return { success: true, data: updated };
  } catch (err) {
    return { success: false, message: 'Gagal update: ' + (err.message || err) };
  }
}

function deleteDoctorMaterialDeduction(payload) {
  // Soft delete — set is_active = false. Audit log dihasilkan oleh
  // updateDoctorMaterialDeduction (action='deactivate' karena pure is_active toggle).
  return updateDoctorMaterialDeduction(Object.assign({}, payload, { is_active: false }));
}

/* =========================================================
   KALKULASI FEE (CORE)
   ========================================================= */

function calculateDoctorFeeDraft(payload) {
  try {
    const auth = requireRole(payload, ['admin_finance']);
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

    const serviceIndex   = buildServiceIndex_();
    const ruleIndex      = buildRuleIndex_();
    const deductionIndex = buildDeductionIndex_();

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
      const res   = calculateFeeForTreatment_(treatment, items, serviceIndex, rule, deductionIndex);

      if (res.warning) warnings.push(res.warning);

      if (!feeByDoctor[dName]) {
        feeByDoctor[dName] = {
          doctor_name:           dName,
          fee_type:              rule ? rule.fee_type : 'unknown',
          is_calculated:         !res.skipped,
          skip_reason:           res.skip_reason || null,
          warning:               res.warning || null,
          subtotal:              0,
          material:              0,
          lab:                   0,
          operational_deduction: rule ? Number(rule.operational_deduction || 0) : 0,
          base_percentage:       rule ? Number(rule.base_percentage || 0) : 0,
          control_percentage:    rule ? Number(rule.control_percentage || rule.base_percentage || 0) : 0,
          fee_total:             0,
          treatment_count:       0,
          breakdown:             [],
          material_breakdown:    []
        };
      }

      const agg = feeByDoctor[dName];
      agg.subtotal           += Number(res.subtotal || 0);
      agg.material           += Number(res.material || 0);
      agg.lab                += Number(res.lab || 0);
      agg.fee_total          += Number(res.fee_total || 0);
      agg.treatment_count++;
      agg.breakdown           = agg.breakdown.concat(res.breakdown || []);
      agg.material_breakdown  = agg.material_breakdown.concat(res.material_breakdown || []);
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
    const auth = requireRole(payload, ['admin_finance']);
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

      writeAuditLog_({
        actor: auth.user,
        entity_type: 'expense',
        entity_id: expenseId,
        action: 'confirm_doctor_fee',
        old_value: null,
        new_value: inserted || expenseRow,
        notes: 'Konfirmasi fee dokter ' + dName + ' tanggal ' + date
      });
    });

    return { success: true, data: { expenses_created: created, expenses: createdExpenses } };
  } catch (err) {
    return { success: false, message: 'Gagal simpan fee: ' + (err.message || err) };
  }
}
