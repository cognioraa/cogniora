const { build } = require('./fixtures');
const results = [];
function check(id, title, pass, detail) { results.push({ id, title, pass, detail }); console.log((pass ? 'PASS' : 'FAIL') + '  ' + id + '  ' + title + (detail ? '\n        -> ' + detail : '')); }
const dir = process.env.GASDIR || undefined;
const F = () => build(dir ? { dir } : {});

// ---------- T1: Owner dashboard KPIs required by blueprint 8.6 ----------
{
  const f = F();
  const o = f.call('adminOverview_', f.tok.owner);
  const need = ['active_enrollments', 'revenue_this_month', 'outstanding_payments', 'upcoming_sessions'];
  const missing = need.filter(k => !(k in o));
  check('T1', 'Owner overview exposes KPIs + upcoming_sessions that the UI reads', missing.length === 0, missing.length ? 'missing keys: ' + missing.join(', ') : '');
}

// ---------- T2: Expense date filters ----------
{
  const f = F();
  const add = (d, a) => f.call('adminSaveExpense_', f.tok.owner, { date: d, category: 'Rent', description: 'x', amount: a, payment_method: 'CASH' });
  add('2026-11-02', 100); add('2026-11-10', 200); add('2026-12-01', 400);
  const r = f.call('adminExpenses_', f.tok.owner, { from: '2026-11-01', to: '2026-11-30' });
  check('T2a', 'adminExpenses_ filters by date range (expect 2 rows in Nov)', r.length === 2, 'got ' + r.length + ' rows');
  const rep = f.call('buildCognioraReport_', 'expenses', { from: '2026-11-01', to: '2026-11-30' });
  check('T2b', 'Expense report honours from/to (expect 2 rows)', rep.rows.length === 2, 'got ' + rep.rows.length);
  const fs = f.call('buildCognioraReport_', 'financial_summary', { from: '2026-11-01', to: '2026-11-30' });
  const exp = fs.rows.find(x => x[0] === 'Operating expenses');
  check('T2c', 'Financial summary sums Nov expenses = 300', exp && exp[1] === 300, 'got ' + (exp && exp[1]));
}

// ---------- T3: Payment approval / credit grant ----------
{
  const f = F(); const now = f.R('now_()');
  f.mk('Data_Invoice', { ID_Invoice: 'INV1', Invoice_Number: 'CGN-INV-1', ID_Enrollment: 'ENR1', Billing_Month: '2026-11', Nominal: 250000, Due_Date: '2026-11-05', Status: 'PENDING', Created_At: now, Updated_At: now, Harga_Asli: 250000 });
  const pay = id => f.mk('Data_Payment', { ID_Payment: id, ID_Invoice: 'INV1', ID_Enrollment: 'ENR1', Nominal: 250000, Payment_Method: 'BANK_TRANSFER', Proof_Drive_File_ID: 'F', Submitted_At: now, Status: 'PENDING', Approved_By: '', Approved_At: '', Rejection_Reason: '' });
  pay('PAY1'); pay('PAY2');
  f.call('adminApprovePayment_', f.tok.owner, 'PAY1');
  const b1 = f.call('packageCreditBalance_', 'ENR1');
  check('T3a', 'Approve grants credits once (8)', b1 === 8, 'balance ' + b1);
  const again = f.try('adminApprovePayment_', f.tok.owner, 'PAY1');
  const b2 = f.call('packageCreditBalance_', 'ENR1');
  check('T3b', 'Re-approving same payment stays idempotent', b2 === 8, 'balance ' + b2);
  const second = f.try('adminApprovePayment_', f.tok.owner, 'PAY2');
  const b3 = f.call('packageCreditBalance_', 'ENR1');
  check('T3c', 'A 2nd payment on an already-PAID invoice must not grant credits again', b3 === 8, 'balance ' + b3 + ' (second approve ' + (second.ok ? 'accepted' : 'blocked: ' + second.msg) + ')');
  // reject after approval
  const f2 = F(); const n2 = f2.R('now_()');
  f2.mk('Data_Invoice', { ID_Invoice: 'INV1', Invoice_Number: 'CGN-INV-1', ID_Enrollment: 'ENR1', Billing_Month: '2026-11', Nominal: 250000, Due_Date: '2026-11-05', Status: 'PENDING', Created_At: n2, Updated_At: n2, Harga_Asli: 250000 });
  f2.mk('Data_Payment', { ID_Payment: 'PAYX', ID_Invoice: 'INV1', ID_Enrollment: 'ENR1', Nominal: 250000, Payment_Method: 'BANK_TRANSFER', Proof_Drive_File_ID: 'F', Submitted_At: n2, Status: 'PENDING', Approved_By: '', Approved_At: '', Rejection_Reason: '' });
  f2.call('adminApprovePayment_', f2.tok.owner, 'PAYX');
  const rj = f2.try('adminRejectPayment_', f2.tok.owner, 'PAYX', 'salah');
  const bal = f2.call('packageCreditBalance_', 'ENR1');
  check('T3d', 'Rejecting an APPROVED payment reverses the granted credits (ledger reversal) or is blocked', bal === 0 || !rj.ok, 'reject ' + (rj.ok ? 'accepted' : 'blocked') + ', balance ' + bal);
}

// ---------- T4: attendance -> ledger ----------
{
  const f = F();
  f.call('addPackageCreditLedger_', { enrollment_id: 'ENR1', package_id: 'PKG1', transaction_type: 'PURCHASE', credit_change: 8, source_key: 'PAYMENT:SEED', created_by: 'T' });
  f.call('tutorSaveAttendance_', f.tok.t1, { schedule_id: 'SCH-A1', records: [{ enrollment_id: 'ENR1', status: 'PRESENT' }] });
  let b = f.call('packageCreditBalance_', 'ENR1');
  check('T4a', 'PRESENT deducts 1 credit', b === 7, 'balance ' + b);
  f.call('tutorSaveAttendance_', f.tok.t1, { schedule_id: 'SCH-A1', records: [{ enrollment_id: 'ENR1', status: 'ABSENT' }] });
  b = f.call('packageCreditBalance_', 'ENR1');
  check('T4b', 'Changing PRESENT->ABSENT (rule: absent not deducted) reverses to 8', b === 8, 'balance ' + b);
  f.call('tutorSaveAttendance_', f.tok.t1, { schedule_id: 'SCH-A1', records: [{ enrollment_id: 'ENR1', status: 'PRESENT' }] });
  f.call('tutorSaveAttendance_', f.tok.t1, { schedule_id: 'SCH-A1', records: [{ enrollment_id: 'ENR1', status: 'PRESENT' }] });
  b = f.call('packageCreditBalance_', 'ENR1');
  check('T4c', 'Repeated PRESENT does not double deduct', b === 7, 'balance ' + b);
  // cancelled session
  f.R('updateObject_("Data_Schedule","ID_Schedule","SCH-A2",{Status:"CANCELLED"})');
  const r = f.try('tutorSaveAttendance_', f.tok.t1, { schedule_id: 'SCH-A2', records: [{ enrollment_id: 'ENR1', status: 'PRESENT' }] });
  b = f.call('packageCreditBalance_', 'ENR1');
  check('T4d', 'Attendance on a CANCELLED session must not deduct credits', b === 7, 'balance ' + b);
  // cancel after attendance recorded
  f.call('tutorSaveAttendance_', f.tok.t1, { schedule_id: 'SCH-A1', records: [{ enrollment_id: 'ENR1', status: 'PRESENT' }] });
  f.call('adminSaveSchedule_', f.tok.owner, { id_schedule: 'SCH-A1', batch_id: 'BAT-A', type: 'GOOGLE_MEET', meet_url: 'https://meet.google.com/abc-defg-hij', title: 'Meet SCH-A1', date: '2026-11-23', start: '19:00', end: '20:00', month: 1, meeting_no: 1, status: 'CANCELLED' });
  b = f.call('packageCreditBalance_', 'ENR1');
  check('T4e', 'Cancelling a session that already consumed credit refunds it', b === 8, 'balance ' + b);
}

// ---------- T5: ledger ordering ----------
{
  const f = F(); const env = f.env;
  const times = ['2026-11-01 10:00:00', '2026-11-02 10:00:00', '2026-11-03 10:00:00'];
  times.forEach((t, i) => f.mk('Package_Credit_Ledger', { ID_Ledger: 'L' + i, ID_Enrollment: 'ENR1', ID_Package: 'PKG1', ID_Schedule: '', Source_Key: 'k' + i, Transaction_Type: 'ADJUSTMENT', Credit_Change: 1, Balance_After: i + 1, Note: 'n' + i, Created_By: 'x', Created_At: t }));
  const s = f.call('studentPackageBalance_', f.tok.s1, {});
  const order = s.transactions.map(x => x.note).join(',');
  check('T5', 'Student ledger history is newest-first', order === 'n2,n1,n0', 'order: ' + order);
}

// ---------- T6: tutor scoping ----------
{
  const f = F();
  const a = f.try('tutorSaveAttendance_', f.tok.t2, { schedule_id: 'SCH-A1', records: [{ enrollment_id: 'ENR1', status: 'PRESENT' }] });
  check('T6a', 'Tutor 2 cannot take attendance in Batch A', !a.ok && a.code === 'AUTH_FORBIDDEN', a.ok ? 'allowed!' : a.code);
  // expired assignment
  f.R('updateObject_("Batch_Tutor_Assignment","ID_Assignment","TAS1",{End_Date:"2026-11-10"})');
  const b = f.try('tutorSaveAttendance_', f.tok.t1, { schedule_id: 'SCH-A1', records: [{ enrollment_id: 'ENR1', status: 'PRESENT' }] });
  check('T6b', 'Assignment with End_Date in the past no longer grants access (blueprint 11.2)', !b.ok, b.ok ? 'still allowed' : b.code);
  // future-dated assignment
  const f2 = F();
  f2.R('updateObject_("Batch_Tutor_Assignment","ID_Assignment","TAS1",{Start_Date:"2027-06-01"})');
  const c = f2.try('tutorSaveAttendance_', f2.tok.t1, { schedule_id: 'SCH-A1', records: [{ enrollment_id: 'ENR1', status: 'PRESENT' }] });
  check('T6c', 'Assignment not yet started (Start_Date in future) does not grant access', !c.ok, c.ok ? 'still allowed' : c.code);
  // deactivated tutor
  const f3 = F();
  f3.call('adminSetTutorStatus_', f3.tok.owner, { tutor_id: 'ADM-T1', status: 'INACTIVE' });
  const d = f3.try('tutorDashboard_', f3.tok.t1);
  check('T6d', 'Deactivated tutor session is rejected', !d.ok, d.ok ? 'still allowed' : d.code);
  // material overwrite
  const f4 = F();
  const m = f4.call('adminSaveMaterial_', f4.tok.owner, { title: 'Owner material', type: 'MODULE' });
  const w = f4.try('tutorSaveMaterial_', f4.tok.t1, { id_material: m.id, title: 'HACKED', type: 'MODULE' });
  const after = f4.R('findOne_("Data_Material","ID_Material","' + m.id + '").Judul');
  check('T6e', "Tutor cannot overwrite a material they did not create", after === 'Owner material', 'title now: ' + after);
  // reassign someone else's batch-material row to own batch
  const bm = f4.call('adminAssignMaterialToBatch_', f4.tok.owner, { material_id: m.id, batch_id: 'BAT-B', month: 1, status: 'ACTIVE' });
  const hij = f4.try('tutorAssignMaterial_', f4.tok.t1, { id_batch_material: bm.id, material_id: m.id, batch_id: 'BAT-A', month: 1 });
  const row = f4.R('findOne_("Batch_Materials","ID_Batch_Material","' + bm.id + '").ID_Batch');
  check('T6f', "Tutor cannot hijack another batch's material mapping via id_batch_material", row === 'BAT-B', 'mapping now points to ' + row);
}

// ---------- T7: enrollment ownership ----------
{
  const f = F();
  const r = f.try('studentSelectEnrollment_', f.tok.s1, { enrollment_id: 'ENR2' });
  check('T7a', "Student cannot select another student's enrollment", !r.ok && r.code === 'AUTH_FORBIDDEN', r.ok ? 'allowed' : r.code);
  const r2 = f.try('studentPackageBalance_', f.tok.s1, { enrollment_id: 'ENR2' });
  const own = r2.ok && r2.v.enrollment_id === 'ENR1';
  check('T7b', "Passing someone else's enrollment_id never exposes their data", own || !r2.ok, r2.ok ? 'returned enrollment ' + r2.v.enrollment_id : r2.code);
}

// ---------- T8: assessment ----------
{
  const f = F();
  const a = f.call('adminSaveAssessment_', f.tok.owner, { title: 'Quiz', type: 'TEST', duration_minutes: 10, max_attempts: 1, status: 'DRAFT', show_score: true });
  f.call('adminSaveAssessmentQuestion_', f.tok.owner, { assessment_id: a.id, question_type: 'MCQ', prompt: 'Q1', options_json: '[{"id":"A","label":"a"},{"id":"B","label":"b"}]', correct_answer_json: '"A"', points: 1, explanation: 'because' });
  f.call('adminSaveAssessmentQuestion_', f.tok.owner, { assessment_id: a.id, question_type: 'ESSAY', prompt: 'Essay', options_json: '[]', points: 2 });
  const unpublished = f.try('studentAssessmentStart_', f.tok.s1, { assessment_id: a.id });
  check('T8-pre', 'Draft assessment cannot be started by a student', !unpublished.ok);
  f.call('adminAssignAssessment_', f.tok.owner, { assessment_id: a.id, batch_id: 'BAT-A', status: 'PUBLISHED' });
  const st = f.call('studentAssessmentStart_', f.tok.s1, { assessment_id: a.id });
  const leaked = JSON.stringify(st).match(/correct_answer|because|Correct_Answer/);
  check('T8a', 'Start payload contains no answer key/explanation', !leaked, leaked ? 'leaked: ' + leaked[0] : '');
  const q1 = st.questions.find(q => q.prompt === 'Q1');
  f.call('studentAssessmentSaveAnswer_', f.tok.s1, { attempt_id: st.attempt_id, question_id: q1.id, answer: 'A' });
  const sub1 = f.call('studentAssessmentSubmit_', f.tok.s1, { attempt_id: st.attempt_id });
  const sub2 = f.call('studentAssessmentSubmit_', f.tok.s1, { attempt_id: st.attempt_id });
  check('T8b', 'Objective auto-graded; essay -> PENDING_REVIEW', sub1.status === 'PENDING_REVIEW', JSON.stringify(sub1));
  check('T8c', 'Second submit is a no-op (cannot submit twice)', sub2.status === 'PENDING_REVIEW' && f.R('findMany_("Assessment_Attempts","ID_Assessment","' + a.id + '").length') === 1);
  const other = f.try('studentAssessmentSubmit_', f.tok.s2, { attempt_id: st.attempt_id });
  check('T8d', "Another student cannot submit/read someone's attempt", !other.ok && other.code === 'AUTH_FORBIDDEN', other.ok ? 'allowed' : other.code);
  const tOther = f.try('tutorAssessmentAttemptDetail_', f.tok.t2, { attempt_id: st.attempt_id });
  check('T8e', "Tutor of another batch cannot view the attempt", !tOther.ok, tOther.ok ? 'allowed' : tOther.code);
  // show_score off should not leak per-question scores while pending review
  f.R('updateObject_("Data_Assessment","ID_Assessment","' + a.id + '",{Show_Score:false})');
  const res = f.call('studentAssessmentResult_', f.tok.s1, { attempt_id: st.attempt_id });
  const leakScores = (res.answers || []).some(x => x.score !== null);
  check('T8f', 'With Show_Score=false no per-question scores are revealed', !leakScores, leakScores ? 'scores revealed while hidden' : '');
}

// ---------- T9: login / session ----------
{
  const f = F();
  const l = f.try('adminLogin_', { email: 'owner@x.com', password: 'ownerpass1' });
  check('T9a', 'Owner can log in', l.ok);
  const bad = f.try('adminLogin_', { email: 'owner@x.com', password: 'nope' });
  check('T9b', 'Wrong password rejected', !bad.ok);
  const ch = f.try('apiInvoke', 'auth.admin.changePassword', { current_password: 'tutorpass1', new_password: 'newtutorpw1' }, f.tok.t1);
  check('T9c', 'Tutor/Owner can change own password (blueprint 4.2)', ch.ok && ch.v && ch.v.success === true, ch.ok ? JSON.stringify(ch.v).slice(0, 120) : ch.msg);
  const studentChange = f.call('apiInvoke', 'auth.changePassword', { current_password: 'studentpass', new_password: 'newstudentpass1' }, f.tok.s1);
  const studentLogin = f.try('studentLogin_', { email: 's1@x.com', password: 'newstudentpass1' });
  check('T9d', 'Student change-password action updates the password and allows a new login', studentChange.success === true && studentLogin.ok, studentChange.message || (studentLogin.ok ? 'login OK' : studentLogin.msg));
}

// ---------- T10: report types required by blueprint 14.2 ----------
{
  const f = F();
  const types = ['students', 'attendance', 'skill_progress', 'assessment_results', 'assignments', 'material_completion', 'package_credits', 'tutor_activity', 'invoices', 'payments', 'expenses', 'financial_summary'];
  const supported = types.filter(t => f.try('buildCognioraReport_', t, {}).ok);
  const missing = types.filter(t => !supported.includes(t));
  check('T10', 'Report Center covers assignment, material completion, tutor activity, invoice/piutang reports', missing.length === 0, 'unsupported: ' + missing.join(', '));
  const fs = f.try('buildCognioraReport_', 'financial_summary', {});
  const hasPiutang = fs.ok && fs.v.rows.some(r => /piutang|receivable|outstanding/i.test(String(r[0])));
  check('T10b', 'Financial summary includes receivables (piutang) per blueprint 14.2-K', hasPiutang);
}


// ---------- T11: Tutor assessment authoring and assignment ----------
{
  const f = F();
  const draftRes = f.call('apiInvoke', 'tutor.assessment.save', { title: 'Tutor Draft', type: 'PRACTICE', status: 'DRAFT', duration_minutes: 15 }, f.tok.t1);
  const draft = draftRes && draftRes.data;
  const qRes = f.call('apiInvoke', 'tutor.assessment.question.save', { assessment_id: draft.id, question_type: 'MCQ', prompt: 'Tutor question?', options_json: '[{"id":"A","label":"A"},{"id":"B","label":"B"}]', correct_answer_json: '"A"', points: 5 }, f.tok.t1);
  const q = qRes && qRes.data;
  const ownRes = f.call('apiInvoke', 'tutor.assessment.questions', { assessment_id: draft.id }, f.tok.t1);
  const own = ownRes && ownRes.data || [];
  check('T11a', 'Tutor assessment save/question routes create a draft and accept questions', !!draft && !!q && own.length === 1 && own[0].id === q.id, 'questions: ' + own.length);
  const batchRes = f.call('apiInvoke', 'tutor.batches', {}, f.tok.t1);
  const batches = batchRes && batchRes.data || [];
  check('T11b', 'Tutor batch API only returns assigned active batches', !!batchRes.success && batches.length === 1 && batches[0].id === 'BAT-A', 'batches: ' + batches.map(x => x.id).join(','));
  const assignRes = f.call('apiInvoke', 'tutor.assessment.assign', { assessment_id: draft.id, batch_id: 'BAT-A', status: 'PUBLISHED' }, f.tok.t1);
  const assigned = assignRes && assignRes.data;
  const saved = f.R('findOne_("Data_Assessment","ID_Assessment","' + draft.id + '")');
  check('T11c', 'Tutor assignment route publishes own assessment to assigned batch', !!assignRes.success && assigned.status === 'PUBLISHED' && saved.Batch_ID === 'BAT-A', JSON.stringify(assigned));
  const other = f.call('apiInvoke', 'tutor.assessment.assign', { assessment_id: draft.id, batch_id: 'BAT-B', status: 'PUBLISHED' }, f.tok.t2);
  check('T11d', 'Another tutor cannot reassign an assessment they did not create', !other.success && other.code === 'AUTH_FORBIDDEN', other.success ? 'allowed' : other.code);
}

// ---------- T12: monthly material access control ----------
{
  const f = F();
  f.mk('Data_Material', { ID_Material: 'MAT-M2', Judul: 'Month Two Material', Tipe: 'MODULE', Deskripsi: 'Locked until the second month', Status: 'ACTIVE', Created_At: f.R('now_()'), Updated_At: f.R('now_()') });
  f.mk('Batch_Materials', { ID_Batch_Material: 'BM-M2', ID_Batch: 'BAT-A', ID_Material: 'MAT-M2', Month_No: 2, Required: true, Unlock_After_Meeting_No: 0, Unlock_Date: '', Status: 'ACTIVE' });
  const materials = f.call('studentMaterials_', f.tok.s1, {});
  const m = materials.find(x => x.batch_material_id === 'BM-M2');
  check('T12a', 'Month 2 material stays locked while enrollment is in Month 1', !!m && m.locked === true && /Month 2/.test(m.lock_reason), m ? JSON.stringify({ locked: m.locked, reason: m.lock_reason }) : 'material missing');
  const complete = f.try('completeMaterial_', f.tok.s1, { batch_material_id: 'BM-M2' });
  check('T12b', 'Server rejects completion of a locked month material', !complete.ok && complete.code === 'ACCESS_RESTRICTED', complete.ok ? 'allowed' : complete.code);
  const f2 = F();
  f2.R('updateObject_("Data_Batch","ID_Batch","BAT-A",{Pertemuan_Per_Bulan:2})');
  f2.mk('Student_Attendance', { ID_Attendance: 'AT-M1-1', ID_Enrollment: 'ENR1', ID_Schedule: 'SCH-A1', Status: 'PRESENT' });
  f2.mk('Student_Attendance', { ID_Attendance: 'AT-M1-2', ID_Enrollment: 'ENR1', ID_Schedule: 'SCH-A2', Status: 'PRESENT' });
  f2.mk('Data_Report', { ID_Report: 'REP-M1', ID_Enrollment: 'ENR1', Month_No: 1, Average: 90 });
  f2.mk('Data_Material', { ID_Material: 'MAT-M2', Judul: 'Month Two Material', Tipe: 'MODULE', Deskripsi: '', Status: 'ACTIVE' });
  f2.mk('Batch_Materials', { ID_Batch_Material: 'BM-M2', ID_Batch: 'BAT-A', ID_Material: 'MAT-M2', Month_No: 2, Required: true, Unlock_After_Meeting_No: 0, Unlock_Date: '', Status: 'ACTIVE' });
  const unlocked = f2.call('studentMaterials_', f2.tok.s1, {}).find(x => x.batch_material_id === 'BM-M2');
  check('T12c', 'Month 2 material unlocks after Month 1 attendance and score requirements are met', !!unlocked && unlocked.locked === false, unlocked ? JSON.stringify({ locked: unlocked.locked, month: unlocked.month }) : 'material missing');
}

const failed = results.filter(r => !r.pass);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
require('fs').writeFileSync(process.env.OUT || '/tmp/results.json', JSON.stringify(results, null, 2));
