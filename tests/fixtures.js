const { createEnv } = require('./gasmock');
function build(opts) {
  const env = createEnv(opts);
  const R = env.run;
  const mk = (sheet, obj) => { env.ctx.__o = obj; R('appendObject_("' + sheet + '", __o)'); return obj; };
  const salt = 'salt1234';
  const hash = pw => { env.ctx.__p = pw; return R('hashPassword_(__p,"' + salt + '")'); };
  const now = R('now_()');
  const F = { env };
  F.owner = mk('Data_Admin', { ID_Admin: 'ADM-OWNER', Nama: 'Owner', Email: 'owner@x.com', Password_Hash: hash('ownerpass1'), Password_Salt: salt, Role: 'OWNER', Status: 'ACTIVE', Created_At: now, Updated_At: now });
  F.tutor1 = mk('Data_Admin', { ID_Admin: 'ADM-T1', Nama: 'Tutor One', Email: 't1@x.com', Password_Hash: hash('tutorpass1'), Password_Salt: salt, Role: 'TUTOR', Status: 'ACTIVE', Created_At: now, Updated_At: now });
  F.tutor2 = mk('Data_Admin', { ID_Admin: 'ADM-T2', Nama: 'Tutor Two', Email: 't2@x.com', Password_Hash: hash('tutorpass2'), Password_Salt: salt, Role: 'TUTOR', Status: 'ACTIVE', Created_At: now, Updated_At: now });
  mk('Data_Program', { ID_Program: 'PRG1', Nama_Program: 'Conversation', Level: 'Spark', Deskripsi: '', Durasi_Default_Bulan: 3, Status: 'ACTIVE', Created_At: now, Updated_At: now });
  mk('Data_Package', { ID_Package: 'PKG1', ID_Program: 'PRG1', Nama_Paket: 'Speaking 8', Tipe_Kelas: 'GROUP', Harga_Per_Bulan: 250000, Deskripsi: '', Recommended: false, Payment_Frequency: 'MONTHLY', Status: 'ACTIVE', Created_At: now, Updated_At: now });
  for (const [id, nm] of [['BAT-A', 'Batch A'], ['BAT-B', 'Batch B']])
    mk('Data_Batch', { ID_Batch: id, Nama_Batch: nm, ID_Program: 'PRG1', Level: 'Spark', Tipe_Kelas: 'GROUP', Max_Students: 5, Tanggal_Mulai: '2026-11-01', Tanggal_Selesai: '2027-01-31', Durasi_Bulan: 3, Minimum_Attendance: 80, Minimum_Assignment: 80, Minimum_Score: 75, Status: 'ACTIVE', Syllabus_Mode: 'STANDARD', Created_At: now, Updated_At: now, Pertemuan_Per_Bulan: 8 });
  for (const [sid, nm, em] of [['STU1', 'Siti', 's1@x.com'], ['STU2', 'Budi', 's2@x.com']])
    mk('Data_Siswa', { ID_Siswa: sid, Nama_Lengkap: nm, Email: em, Nomor_WA: '0812', Password_Hash: hash('studentpass'), Password_Salt: salt, Must_Change_Password: false, Status_Akun: 'ACTIVE', Created_At: now, Updated_At: now });
  mk('Data_Enrollment', { ID_Enrollment: 'ENR1', ID_Siswa: 'STU1', ID_Batch: 'BAT-A', ID_Package: 'PKG1', Tanggal_Mulai: '2026-11-01', Tanggal_Selesai: '2027-01-31', Harga_Disepakati_Per_Bulan: 250000, Status: 'ACTIVE', Current_Month: 1, Current_Meeting: 0, Completion_Status: 'IN_PROGRESS', Created_At: now, Updated_At: now });
  mk('Data_Enrollment', { ID_Enrollment: 'ENR2', ID_Siswa: 'STU2', ID_Batch: 'BAT-B', ID_Package: 'PKG1', Tanggal_Mulai: '2026-11-01', Tanggal_Selesai: '2027-01-31', Harga_Disepakati_Per_Bulan: 250000, Status: 'ACTIVE', Current_Month: 1, Current_Meeting: 0, Completion_Status: 'IN_PROGRESS', Created_At: now, Updated_At: now });
  mk('Batch_Tutor_Assignment', { ID_Assignment: 'TAS1', ID_Batch: 'BAT-A', ID_Admin: 'ADM-T1', Start_Date: '2026-11-01', End_Date: '', Status: 'ACTIVE', Assigned_By: 'ADM-OWNER', Assigned_At: now, Notes: '' });
  mk('Batch_Tutor_Assignment', { ID_Assignment: 'TAS2', ID_Batch: 'BAT-B', ID_Admin: 'ADM-T2', Start_Date: '2026-11-01', End_Date: '', Status: 'ACTIVE', Assigned_By: 'ADM-OWNER', Assigned_At: now, Notes: '' });
  for (const [id, b, n, d] of [['SCH-A1', 'BAT-A', 1, '2026-11-23'], ['SCH-A2', 'BAT-A', 2, '2026-11-25'], ['SCH-B1', 'BAT-B', 1, '2026-11-24']])
    mk('Data_Schedule', { ID_Schedule: id, ID_Batch: b, Month_No: 1, Meeting_No: n, Tipe: 'GOOGLE_MEET', Judul: 'Meet ' + id, Tanggal: d, Jam_Mulai: '19:00', Jam_Selesai: '20:00', Google_Meet_URL: 'https://meet.google.com/abc-defg-hij', ID_Material: '', Requires_Attendance: true, Status: 'ACTIVE', Created_At: now, Updated_At: now, Created_By: 'ADM-OWNER' });
  mk('Data_Package_Rules', { ID_Rule: 'PKR1', ID_Package: 'PKG1', Credit_Amount: 8, Validity_Days: 0, Deduct_On_Present: true, Deduct_On_Late: true, Deduct_On_Absent: false, Deduct_On_Excused: false, Credit_Cost_Per_Session: 1, Status: 'ACTIVE', Created_At: now, Updated_At: now });
  F.tok = {
    owner: R('createSession_("ADMIN","ADM-OWNER","OWNER","")'),
    t1: R('createSession_("ADMIN","ADM-T1","TUTOR","")'),
    t2: R('createSession_("ADMIN","ADM-T2","TUTOR","")'),
    s1: R('createSession_("STUDENT","STU1","STUDENT","ENR1")'),
    s2: R('createSession_("STUDENT","STU2","STUDENT","ENR2")'),
  };
  F.call = (fn, ...a) => env.call(fn, ...a);
  F.mk = mk; F.R = R;
  F.try = (fn, ...a) => { try { return { ok: true, v: env.call(fn, ...a) }; } catch (e) { return { ok: false, code: e.name, msg: e.message }; } };
  return F;
}
module.exports = { build };
