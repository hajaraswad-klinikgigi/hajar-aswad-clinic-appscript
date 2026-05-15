/* =========================================================
   EXPENSE SERVICE
   CRUD dan summary untuk tabel expenses (Supabase only)
   ========================================================= */

const EXPENSE_OPTIONS = { backend_mode: 'supabase' };

const VALID_EXPENSE_CATEGORIES = [
  'doctor_fee',
  'doctor_salary',
  'doctor_meal',
  'doctor_standby',
  'operational',
  'utility',
  'owner_withdrawal',
  'other'
];

const DOCTOR_RELATED_CATEGORIES = [
  'doctor_salary',
  'doctor_meal',
  'doctor_standby'
];

/* =========================================================
   INTERNAL HELPERS
   ========================================================= */

function generateExpenseId_(date) {
  const ymd = String(date || '').replace(/-/g, '');
  const existing = supabaseSelect_('expenses', { expense_date: 'eq.' + date }, { select: 'expense_id' });
  const seq = String(existing.length + 1).padStart(3, '0');
  return 'EXP-' + ymd + '-' + seq;
}

function getExpensesRaw_(options) {
  return dbFindAll_('Expenses', Object.assign({}, EXPENSE_OPTIONS, options || {}));
}

function parseAmount_(val) {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function buildExpenseSummaryByCategory_(expenses) {
  const byCategory = {};
  VALID_EXPENSE_CATEGORIES.forEach(function(cat) { byCategory[cat] = 0; });

  expenses.forEach(function(e) {
    const cat = String(e.category || '').trim();
    if (byCategory[cat] !== undefined) {
      byCategory[cat] += parseAmount_(e.amount);
    } else {
      byCategory['other'] = (byCategory['other'] || 0) + parseAmount_(e.amount);
    }
  });

  return byCategory;
}

function buildExpenseSummaryByDoctor_(expenses) {
  const byDoctor = {};
  expenses.forEach(function(e) {
    const name = String(e.doctor_name || '').trim();
    if (!name) return;
    byDoctor[name] = (byDoctor[name] || 0) + parseAmount_(e.amount);
  });
  return byDoctor;
}

function buildDateRangeForPeriod_(period, startDate, endDate) {
  const today = formatTodayYmd();

  if (period === 'today') {
    return { start: today, end: today };
  }

  if (period === 'week') {
    const d = new Date();
    const dayOfWeek = d.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    const start = Utilities.formatDate(monday, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return { start: start, end: today };
  }

  if (period === 'month') {
    const d = new Date();
    const start = Utilities.formatDate(
      new Date(d.getFullYear(), d.getMonth(), 1),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
    return { start: start, end: today };
  }

  if (period === 'year') {
    const d = new Date();
    const start = Utilities.formatDate(
      new Date(d.getFullYear(), 0, 1),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
    return { start: start, end: today };
  }

  if (period === 'custom') {
    return { start: String(startDate || ''), end: String(endDate || '') };
  }

  return { start: today, end: today };
}

/* =========================================================
   VALIDASI
   ========================================================= */

function validateExpenseInput_(data) {
  const today = formatTodayYmd();
  const date = String(data.expense_date || '').trim();
  const category = String(data.category || '').trim();
  const description = String(data.description || '').trim();
  const amount = parseAmount_(data.amount);
  const doctorName = String(data.doctor_name || '').trim();

  if (!date) return 'Tanggal pengeluaran wajib diisi.';
  if (date > today) return 'Tanggal pengeluaran tidak boleh tanggal yang akan datang.';
  if (!category) return 'Kategori wajib diisi.';
  if (VALID_EXPENSE_CATEGORIES.indexOf(category) === -1) {
    return 'Kategori tidak valid: ' + category;
  }
  if (!description) return 'Keterangan wajib diisi.';
  if (description.length < 3) return 'Keterangan minimal 3 karakter.';
  if (!amount || amount <= 0) return 'Nominal pengeluaran harus lebih dari 0.';
  if (DOCTOR_RELATED_CATEGORIES.indexOf(category) !== -1 && !doctorName) {
    return 'Nama dokter wajib diisi untuk kategori ' + category + '.';
  }

  return null;
}

/* =========================================================
   READ
   ========================================================= */

function getExpensesByDate(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const date = String((payload && payload.date) || '').trim();
    if (!date) return { success: false, message: 'Tanggal wajib diisi.' };

    const all = getExpensesRaw_();
    const expenses = all.filter(function(e) {
      return String(e.expense_date || '').slice(0, 10) === date;
    });

    return { success: true, data: expenses };

  } catch (err) {
    return { success: false, message: 'Gagal mengambil data pengeluaran: ' + (err.message || err) };
  }
}

function getExpensesByDateRange(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const startDate = String((payload && payload.start_date) || '').trim();
    const endDate = String((payload && payload.end_date) || '').trim();

    if (!startDate || !endDate) return { success: false, message: 'start_date dan end_date wajib diisi.' };

    const all = getExpensesRaw_();
    const expenses = all.filter(function(e) {
      const d = String(e.expense_date || '').slice(0, 10);
      return d >= startDate && d <= endDate;
    });

    const total = expenses.reduce(function(sum, e) { return sum + parseAmount_(e.amount); }, 0);
    const byCategory = buildExpenseSummaryByCategory_(expenses);

    return {
      success: true,
      data: expenses,
      summary: { total: total, by_category: byCategory }
    };

  } catch (err) {
    return { success: false, message: 'Gagal mengambil data pengeluaran: ' + (err.message || err) };
  }
}

/* =========================================================
   WRITE
   ========================================================= */

function addExpense(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const validationError = validateExpenseInput_(payload);
    if (validationError) return { success: false, message: validationError };

    const date = String(payload.expense_date).trim();
    const expenseId = generateExpenseId_(date);

    const row = {
      expense_id:   expenseId,
      expense_date: date,
      category:     String(payload.category).trim(),
      subcategory:  payload.subcategory ? String(payload.subcategory).trim() : null,
      description:  String(payload.description).trim(),
      amount:       parseAmount_(payload.amount),
      doctor_name:  payload.doctor_name ? String(payload.doctor_name).trim() : null,
      recorded_by:  auth.user.username,
      notes:        payload.notes ? String(payload.notes).trim() : null
    };

    const inserted = dbInsert_('Expenses', row, EXPENSE_OPTIONS);

    return { success: true, data: inserted };

  } catch (err) {
    return { success: false, message: 'Gagal menyimpan pengeluaran: ' + (err.message || err) };
  }
}

function updateExpense(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const expenseId = String((payload && payload.expense_id) || '').trim();
    if (!expenseId) return { success: false, message: 'expense_id wajib diisi.' };

    const existing = dbFindById_('Expenses', 'expense_id', expenseId, EXPENSE_OPTIONS);
    if (!existing) return { success: false, message: 'Data pengeluaran tidak ditemukan: ' + expenseId };

    const today = formatTodayYmd();
    const existingDate = String(existing.expense_date || '').slice(0, 10);
    if (existingDate !== today) {
      return { success: false, message: 'Pengeluaran tanggal lampau tidak dapat diubah.' };
    }

    const patch = {};

    if (payload.expense_date !== undefined) {
      const date = String(payload.expense_date).trim();
      const today = formatTodayYmd();
      if (date > today) return { success: false, message: 'Tanggal tidak boleh tanggal yang akan datang.' };
      patch.expense_date = date;
    }

    if (payload.category !== undefined) {
      const cat = String(payload.category).trim();
      if (VALID_EXPENSE_CATEGORIES.indexOf(cat) === -1) {
        return { success: false, message: 'Kategori tidak valid: ' + cat };
      }
      patch.category = cat;
    }

    if (payload.subcategory !== undefined) patch.subcategory = payload.subcategory ? String(payload.subcategory).trim() : null;
    if (payload.description !== undefined) {
      const desc = String(payload.description).trim();
      if (desc.length < 3) return { success: false, message: 'Keterangan minimal 3 karakter.' };
      patch.description = desc;
    }
    if (payload.amount !== undefined) {
      const amount = parseAmount_(payload.amount);
      if (amount <= 0) return { success: false, message: 'Nominal harus lebih dari 0.' };
      patch.amount = amount;
    }
    if (payload.doctor_name !== undefined) patch.doctor_name = payload.doctor_name ? String(payload.doctor_name).trim() : null;
    if (payload.notes !== undefined) patch.notes = payload.notes ? String(payload.notes).trim() : null;

    const effectiveCategory = patch.category || existing.category;
    const effectiveDoctorName = patch.doctor_name !== undefined ? patch.doctor_name : existing.doctor_name;
    if (DOCTOR_RELATED_CATEGORIES.indexOf(effectiveCategory) !== -1 && !effectiveDoctorName) {
      return { success: false, message: 'Nama dokter wajib diisi untuk kategori ' + effectiveCategory + '.' };
    }

    patch.updated_at = new Date().toISOString();

    const updated = dbUpdateById_('Expenses', 'expense_id', expenseId, patch, EXPENSE_OPTIONS);

    return { success: true, data: updated };

  } catch (err) {
    return { success: false, message: 'Gagal mengupdate pengeluaran: ' + (err.message || err) };
  }
}

function deleteExpense(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const expenseId = String((payload && payload.expense_id) || '').trim();
    if (!expenseId) return { success: false, message: 'expense_id wajib diisi.' };

    const existing = dbFindById_('Expenses', 'expense_id', expenseId, EXPENSE_OPTIONS);
    if (!existing) return { success: false, message: 'Data pengeluaran tidak ditemukan: ' + expenseId };

    const today = formatTodayYmd();
    const existingDate = String(existing.expense_date || '').slice(0, 10);
    if (existingDate !== today) {
      return { success: false, message: 'Pengeluaran tanggal lampau tidak dapat dihapus.' };
    }

    dbDeleteById_('Expenses', 'expense_id', expenseId, EXPENSE_OPTIONS);

    return { success: true };

  } catch (err) {
    return { success: false, message: 'Gagal menghapus pengeluaran: ' + (err.message || err) };
  }
}

/* =========================================================
   SUMMARY
   ========================================================= */

function getExpenseSummary(payload) {
  try {
    const auth = readAuthSession_(payload);
    if (!auth.success) return auth;

    const period = String((payload && payload.period) || 'today').trim();
    const validPeriods = ['today', 'week', 'month', 'year', 'custom'];
    if (validPeriods.indexOf(period) === -1) {
      return { success: false, message: 'Period tidak valid: ' + period };
    }

    const range = buildDateRangeForPeriod_(period, payload.start_date, payload.end_date);

    if (!range.start || !range.end) {
      return { success: false, message: 'start_date dan end_date wajib diisi untuk period custom.' };
    }

    const all = getExpensesRaw_();
    const expenses = all.filter(function(e) {
      const d = String(e.expense_date || '').slice(0, 10);
      return d >= range.start && d <= range.end;
    });

    const total = expenses.reduce(function(sum, e) { return sum + parseAmount_(e.amount); }, 0);
    const byCategory = buildExpenseSummaryByCategory_(expenses);
    const byDoctor = buildExpenseSummaryByDoctor_(expenses);

    return {
      success: true,
      data: {
        period: period,
        start_date: range.start,
        end_date: range.end,
        total_expense: total,
        by_category: byCategory,
        by_doctor: byDoctor,
        items: expenses
      }
    };

  } catch (err) {
    return { success: false, message: 'Gagal mengambil summary pengeluaran: ' + (err.message || err) };
  }
}
