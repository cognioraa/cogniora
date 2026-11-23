function normalizeReferralCode_(code) {
  return String(code || "").trim().toUpperCase();
}

function validBillingMonth_(value) {
  return /^\d{4}-\d{2}$/.test(String(value || ""));
}

function firstBillingMonthForEnrollment_(enrollment) {
  var d = parseDateValue_(enrollment && enrollment.Tanggal_Mulai);
  if (!d) d = parseDateValue_(enrollment && enrollment.Created_At);
  if (!d) d = new Date();
  return Utilities.formatDate(d, getSetting_("TIMEZONE", "Asia/Jakarta"), "yyyy-MM");
}

function referralForStudent_(studentId, referralCode) {
  var code = normalizeReferralCode_(referralCode);
  if (!code || !studentId) return null;
  var rows = sheetToObjects_("Data_Referral").filter(function (x) {
    return normalizeReferralCode_(x.Kode_Referral) === code && String(x.ID_Siswa || "").trim() === String(studentId).trim();
  });
  if (!rows.length) return null;
  rows.sort(function (a, b) { return Number(b.Diskon_Persen || 0) - Number(a.Diskon_Persen || 0); });
  var r = rows[0];
  var pct = Math.max(0, Math.min(100, Number(r.Diskon_Persen || 0)));
  return {
    code: code,
    student_id: String(r.ID_Siswa || ""),
    owner: String(r.Pemilik_Kode || ""),
    discount_percent: pct
  };
}

function invoiceDiscountForEnrollment_(enrollment, referralCode, billingMonth) {
  var original = Number(enrollment.Harga_Disepakati_Per_Bulan || 0);
  var firstMonth = firstBillingMonthForEnrollment_(enrollment);
  var referral = String(referralCode || "").trim();
  var match = null;
  if (referral && String(billingMonth || "") === String(firstMonth)) {
    match = referralForStudent_(enrollment.ID_Siswa, referral);
  }
  var pct = match ? Number(match.discount_percent || 0) : 0;
  var discount = Math.round(original * pct / 100);
  var finalAmount = Math.max(0, original - discount);
  return {
    original_amount: original,
    referral_code: match ? match.code : "",
    referral_owner: match ? match.owner : "",
    discount_percent: pct,
    discount_amount: discount,
    final_amount: finalAmount,
    first_billing_month: firstMonth,
    referral_match: !!match
  };
}


// V35: daftar bulan tagihan yang diharapkan untuk sebuah enrollment (dipakai cek eligibility sertifikat).
function billingMonthsForEnrollment_(enrollment) {
  var batch = findOne_("Data_Batch", "ID_Batch", enrollment && enrollment.ID_Batch);
  var count = Math.max(1, Number(batch && batch.Durasi_Bulan || 1));
  var first = firstBillingMonthForEnrollment_(enrollment).split("-");
  var y = Number(first[0]), m = Number(first[1]);
  var out = [];
  for (var i = 0; i < count; i++) {
    out.push(y + "-" + ("0" + m).slice(-2));
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

// V35: seluruh kode referral yang terdaftar untuk seorang siswa (Data_Referral).
function referralOptionsForStudent_(studentId) {
  if (!studentId) return [];
  return sheetToObjects_("Data_Referral").filter(function (x) {
    return String(x.ID_Siswa || "").trim() === String(studentId).trim() && normalizeReferralCode_(x.Kode_Referral);
  }).map(function (r) {
    return {
      code: normalizeReferralCode_(r.Kode_Referral),
      owner: String(r.Pemilik_Kode || ""),
      discount_percent: Math.max(0, Math.min(100, Number(r.Diskon_Persen || 0)))
    };
  });
}

function invoicePastDue_(dueDate) {
  var d = parseDateValue_(dueDate);
  if (!d) return false;
  var today = parseDateValue_(today_()) || new Date();
  var day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return due.getTime() < day.getTime();
}

function makeInvoiceForEnrollment_(enrollment, billingMonth, dueDate, referralCode) {
  var existing = findMany_("Data_Invoice", "ID_Enrollment", enrollment.ID_Enrollment).filter(function (x) {
    return billingMonthKey_(x.Billing_Month) === String(billingMonth || "") && String(x.Status || "") !== "CANCELLED";
  });
  if (existing.length) return { created: false, invoice: existing[0], reason: "EXISTS" };

  var calc = invoiceDiscountForEnrollment_(enrollment, referralCode, billingMonth);
  var due = String(dueDate || "").trim();
  require_(/^\d{4}-\d{2}-\d{2}$/.test(due), "VALIDATION_ERROR", "Due date is invalid.");
  var invoice = {
    ID_Invoice: makeId_("INV"),
    Invoice_Number: makeInvoiceNumber_(),
    ID_Enrollment: enrollment.ID_Enrollment,
    Billing_Month: billingMonth,
    Nominal: calc.final_amount,
    Due_Date: due,
    Status: invoicePastDue_(due) ? "OVERDUE" : "UNPAID",
    Created_At: now_(),
    Updated_At: now_(),
    Harga_Asli: calc.original_amount,
    Kode_Referral: calc.referral_code,
    Diskon_Persen: calc.discount_percent,
    Potongan_Nominal: calc.discount_amount
  };
  appendObject_("Data_Invoice", invoice);
  return { created: true, invoice: invoice, calculation: calc };
}

function adminInvoices_(token, filters) {
  assertAdmin_(getAuthContext_(token, "ADMIN"));
  filters = filters || {};
  var rows = sheetToObjects_("Data_Invoice");
  if (filters.status && filters.status !== "ALL") rows = rows.filter(function (x) { return String(x.Status) === String(filters.status); });
  if (filters.batch_id) {
    var enrByBatch = findMany_("Data_Enrollment", "ID_Batch", String(filters.batch_id)).map(function (x) { return x.ID_Enrollment; });
    rows = rows.filter(function (x) { return enrByBatch.indexOf(x.ID_Enrollment) >= 0; });
  }
  return rows.sort(function (a, b) { return String(b.Created_At).localeCompare(String(a.Created_At)); }).slice(0, 1000).map(function (x) {
    var e = findOne_("Data_Enrollment", "ID_Enrollment", x.ID_Enrollment);
    var s = e && findOne_("Data_Siswa", "ID_Siswa", e.ID_Siswa);
    var b = e && findOne_("Data_Batch", "ID_Batch", e.ID_Batch);
    var p = b && findOne_("Data_Program", "ID_Program", b.ID_Program);
    return {
      id: x.ID_Invoice,
      number: x.Invoice_Number,
      enrollment_id: x.ID_Enrollment,
      student_id: s && s.ID_Siswa,
      student_name: s && s.Nama_Lengkap,
      batch_id: b && b.ID_Batch,
      batch_name: b && b.Nama_Batch,
      program_name: p && p.Nama_Program,
      billing_month: billingMonthKey_(x.Billing_Month),
      original_amount: Number(x.Harga_Asli || x.Nominal || 0),
      amount: Number(x.Nominal || 0),
      final_amount: Number(x.Nominal || 0),
      referral_code: x.Kode_Referral || "",
      discount_percent: Number(x.Diskon_Persen || 0),
      discount_amount: Number(x.Potongan_Nominal || 0),
      due_date: toClientDate_(x.Due_Date),
      status: x.Status
    };
  });
}

function adminPreviewBatchInvoices_(token, data) {
  assertAdmin_(getAuthContext_(token, "ADMIN"));
  data = data || {};
  var batchId = String(data.batch_id || "").trim();
  var billingMonth = String(data.billing_month || "").trim();
  require_(batchId, "VALIDATION_ERROR", "Batch is required.");
  require_(validBillingMonth_(billingMonth), "VALIDATION_ERROR", "Billing month is invalid.");
  var batch = findOne_("Data_Batch", "ID_Batch", batchId);
  require_(batch, "NOT_FOUND", "Batch not found.");
  var enrollments = findMany_("Data_Enrollment", "ID_Batch", batchId).filter(function (e) { return String(e.Status) !== "CANCELLED"; });
  var allInvoices = sheetToObjects_("Data_Invoice");
  return enrollments.map(function (e) {
    var s = findOne_("Data_Siswa", "ID_Siswa", e.ID_Siswa);
    var original = Number(e.Harga_Disepakati_Per_Bulan || 0);
    var first = firstBillingMonthForEnrollment_(e);
    var existing = allInvoices.filter(function (x) {
      return String(x.ID_Enrollment) === String(e.ID_Enrollment) && billingMonthKey_(x.Billing_Month) === billingMonth && String(x.Status || "") !== "CANCELLED";
    })[0];
    var options = referralOptionsForStudent_(e.ID_Siswa);
    return {
      enrollment_id: e.ID_Enrollment,
      student_id: s && s.ID_Siswa,
      student_name: s && s.Nama_Lengkap,
      student_email: s && s.Email,
      enrollment_status: e.Status,
      original_amount: original,
      first_billing_month: first,
      is_first_month: first === billingMonth,
      referral_options: options,
      existing_invoice_id: existing && existing.ID_Invoice,
      existing_status: existing && existing.Status,
      existing_number: existing && existing.Invoice_Number
    };
  });
}

function adminGenerateBatchInvoices_(token, data) {
  var ctx = getAuthContext_(token, "ADMIN");
  data = data || {};
  var batchId = String(data.batch_id || "").trim();
  var billingMonth = String(data.billing_month || "").trim();
  var dueDate = String(data.due_date || "").trim();
  var globalReferral = normalizeReferralCode_(data.referral_code);
  // V35: admin dapat memilih siswa tertentu (enrollment_ids) dan kode referral per siswa (referrals).
  var selected = Array.isArray(data.enrollment_ids) ? data.enrollment_ids.map(String) : null;
  var referrals = (data.referrals && typeof data.referrals === "object") ? data.referrals : {};
  require_(batchId, "VALIDATION_ERROR", "Batch is required.");
  require_(validBillingMonth_(billingMonth), "VALIDATION_ERROR", "Billing month is invalid.");
  require_(/^\d{4}-\d{2}-\d{2}$/.test(dueDate), "VALIDATION_ERROR", "Due date is invalid.");
  if (selected) require_(selected.length, "VALIDATION_ERROR", "Select at least one student.");
  var batch = findOne_("Data_Batch", "ID_Batch", batchId);
  require_(batch && String(batch.Status) !== "CANCELLED", "NOT_FOUND", "Batch not found or cancelled.");

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var summary, toEmail = [];
  try {
    var enrollments = findMany_("Data_Enrollment", "ID_Batch", batchId).filter(function (e) {
      if (String(e.Status) === "CANCELLED") return false;
      return selected ? selected.indexOf(String(e.ID_Enrollment)) >= 0 : true;
    });
    var created = 0, skipped = 0, errors = [], results = [];
    enrollments.forEach(function (e) {
      try {
        var code = normalizeReferralCode_(referrals[e.ID_Enrollment]) || (selected ? "" : globalReferral);
        var r = makeInvoiceForEnrollment_(e, billingMonth, dueDate, code);
        if (r.created) {
          created++;
          toEmail.push({ enrollment: e, invoice: r.invoice });
          invalidateStudentDashboardCache_(e.ID_Siswa);
          audit_(ctx, "CREATE_INVOICE", "Data_Invoice", r.invoice.ID_Invoice, "Batch invoice " + billingMonth, "SUCCESS");
          results.push({ status: "created", enrollment_id: e.ID_Enrollment, invoice_id: r.invoice.ID_Invoice, student_id: e.ID_Siswa, final_amount: r.invoice.Nominal, discount_percent: Number(r.invoice.Diskon_Persen || 0) });
        } else {
          skipped++;
          results.push({ status: "skipped", enrollment_id: e.ID_Enrollment, invoice_id: r.invoice.ID_Invoice, student_id: e.ID_Siswa, reason: r.reason });
        }
      } catch (err) {
        errors.push({ enrollment_id: e.ID_Enrollment, message: err.message || "Invoice generation failed." });
      }
    });
    summary = { batch_id: batchId, billing_month: billingMonth, due_date: dueDate, created_count: created, skipped_count: skipped, error_count: errors.length, errors: errors, results: results };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }

  // V38: kirim email invoice ke siswa (di luar lock; kegagalan email tidak membatalkan invoice).
  var emailSent = 0, emailFailed = 0;
  if (data.send_email !== false) {
    toEmail.forEach(function (x) {
      try {
        var student = findOne_("Data_Siswa", "ID_Siswa", x.enrollment.ID_Siswa);
        sendInvoiceEmail_(student, x.enrollment, x.invoice);
        emailSent++;
      } catch (mailErr) {
        emailFailed++;
        try { audit_(ctx, "INVOICE_EMAIL", "Data_Invoice", x.invoice.ID_Invoice, String(mailErr && mailErr.message || mailErr), "FAILED"); } catch (a) {}
      }
    });
  }
  summary.email_sent_count = emailSent;
  summary.email_failed_count = emailFailed;
  return summary;
}

function adminSaveInvoice_(token, data) {
  return adminGenerateBatchInvoices_(token, data);
}
