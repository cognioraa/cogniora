var COGNIORA_SCHEMA = {
  Data_Settings: ["Setting_Key","Setting_Value","Description","Data_Type","Updated_At","Updated_By"],
  Data_Admin: ["ID_Admin","Nama","Email","Password_Hash","Password_Salt","Role","Status","Foto_File_ID","Last_Login","Created_At","Updated_At"],
  Data_Program: ["ID_Program","Nama_Program","Level","Deskripsi","Durasi_Default_Bulan","Status","Created_At","Updated_At"],
  Data_Package: ["ID_Package","ID_Program","Nama_Paket","Tipe_Kelas","Harga_Per_Bulan","Deskripsi","Recommended","Payment_Frequency","Status","Created_At","Updated_At"],
  Data_Batch: ["ID_Batch","Nama_Batch","ID_Program","Level","Tipe_Kelas","Max_Students","Tanggal_Mulai","Tanggal_Selesai","Durasi_Bulan","Minimum_Attendance","Minimum_Assignment","Minimum_Score","Status","Syllabus_Mode","Created_At","Updated_At","Pertemuan_Per_Bulan","Level_ID"],
  Data_Leads: ["ID_Lead","Timestamp","Nama_Lengkap","Email","Nomor_WA","ID_Package","Kode_Referral","Pesan","Status","ID_Siswa","Converted_At","Converted_By","Source"],
  Data_Siswa: ["ID_Siswa","Nama_Lengkap","Email","Nomor_WA","Password_Hash","Password_Salt","Must_Change_Password","Foto_File_ID","Student_Folder_ID","Status_Akun","Welcome_Email_Status","Welcome_Email_Sent_At","Last_Login","Created_At","Updated_At"],
  Data_Enrollment: ["ID_Enrollment","ID_Siswa","ID_Batch","ID_Package","Tanggal_Mulai","Tanggal_Selesai","Harga_Disepakati_Per_Bulan","Status","Current_Month","Current_Meeting","Completion_Status","Created_At","Updated_At"],
  // V40: topik bulanan per Learning Package (diisi manual; dipakai saat generate certificate).
  Monthly_Topic: ["ID_Topic","ID_Package","Learning_Package","Month_No","Urutan","Topic","Status"],
  Data_Syllabus: ["ID_Syllabus","ID_Program","Month_No","Urutan","Topik","Learning_Objective","Description","Status"],
  Batch_Syllabus: ["ID_Batch_Syllabus","ID_Batch","ID_Syllabus","Month_No","Urutan","Topik","Learning_Objective","Description","Is_Customized","Status"],
  Data_Material: ["ID_Material","Judul","Tipe","Deskripsi","ID_Syllabus","YouTube_Video_ID","Drive_File_ID","External_URL","Status","Created_At","Updated_At","Created_By"],
  Batch_Materials: ["ID_Batch_Material","ID_Batch","ID_Material","Month_No","Required","Unlock_After_Meeting_No","Unlock_Date","Status","Created_At","Updated_At"],
  Student_Material_Progress: ["ID_Student_Material","ID_Enrollment","ID_Batch_Material","Status","Started_At","Completed_At","Last_Accessed_At"],
  Data_Assignment: ["ID_Assignment","Judul","Deskripsi","Month_No","ID_Syllabus","Due_Date","Required","Status","Created_At","Updated_At","Created_By"],
  Batch_Assignment: ["ID_Batch_Assignment","ID_Batch","ID_Assignment","Unlock_After_Meeting_No","Status","Created_At","Updated_At","Unlock_Date"],
  Student_Assignment: ["ID_Student_Assignment","ID_Enrollment","ID_Batch_Assignment","Status","Score","Feedback","Revision_Count","Reviewed_By","Reviewed_At","Updated_At"],
  Assignment_Submissions: ["ID_Submission","ID_Student_Assignment","Attempt_No","Submission_Text","Drive_File_ID","Submitted_At","Status","Reviewed_By","Reviewed_At"],
  Data_Schedule: ["ID_Schedule","ID_Batch","Month_No","Meeting_No","Tipe","Judul","Tanggal","Jam_Mulai","Jam_Selesai","Google_Meet_URL","ID_Material","Requires_Attendance","Status","Created_At","Updated_At","Created_By"],
  Student_Attendance: ["ID_Attendance","ID_Schedule","ID_Enrollment","Status","Check_In","Note","Recorded_By","Recorded_At"],
  Data_Invoice: ["ID_Invoice","Invoice_Number","ID_Enrollment","Billing_Month","Nominal","Due_Date","Status","Created_At","Updated_At","Harga_Asli","Kode_Referral","Diskon_Persen","Potongan_Nominal"],
  Data_Referral: ["ID_Referral","Kode_Referral","ID_Siswa","Pemilik_Kode","Diskon_Persen"],
  Data_Payment: ["ID_Payment","ID_Invoice","ID_Enrollment","Nominal","Payment_Method","Proof_Drive_File_ID","Submitted_At","Status","Approved_By","Approved_At","Rejection_Reason"],
  Data_Report: ["ID_Report","ID_Enrollment","Month_No","Listening","Speaking","Reading","Writing","Grammar","Average","Listening_Feedback","Speaking_Feedback","Reading_Feedback","Writing_Feedback","Grammar_Feedback","General_Feedback","Updated_By","Updated_At"],
  Data_Achievement: ["ID_Achievement","Nama_Achievement","Description","Icon_File_ID","Type","Requirement_Type","Requirement_Value","Status","Created_At","Created_By","ID_Batch"],
  Student_Achievement: ["ID_Student_Achievement","ID_Enrollment","ID_Achievement","Awarded_At","Awarded_By","Source","Note"],
  Data_Certificate: ["ID_Certificate","ID_Enrollment","No_Sertifikat","Verification_Code","Issue_Date","File_ID","File_URL","Status","Version","Generated_At","Generated_By"],
  Certificate_History: ["ID_History","ID_Certificate","Version","Action","Previous_File_ID","New_File_ID","Reason","Performed_By","Performed_At"],
  Terms_Versions: ["Terms_ID","Version","Effective_Date","Title","Content_URL","Status","Created_At"],
  Terms_Acceptance: ["ID_Acceptance","ID_Siswa","Terms_ID","Accepted_At"],
  Password_Reset_Tokens: ["ID_Reset","ID_Siswa","Token_Hash","Created_At","Expires_At","Used_At","Status"],
  Data_Testimonial: ["ID_Testimonial","Nama","Role","Testimonial","Foto_File_ID","Rating","Urutan","Status","Created_At","Updated_At"],
  Audit_Log: ["ID_Log","Timestamp","Actor_ID","Actor_Role","Action","Entity","Entity_ID","Description","Result"],

  // COGNIORA V2 — tabel tambahan. Tabel lama sengaja tidak diubah.
  Data_Tutor_Profile: ["ID_Tutor_Profile","ID_Admin","Spesialisasi","Bio","Nomor_WA","Status","Created_At","Updated_At"],
  Batch_Tutor_Assignment: ["ID_Assignment","ID_Batch","ID_Admin","Start_Date","End_Date","Status","Assigned_By","Assigned_At","Notes"],
  Data_Level: ["ID_Level","Level_Code","Level_Name","Order_No","Description","Entry_Criteria","Completion_Criteria","Status","Created_At","Updated_At"],
  Data_Package_Rules: ["ID_Rule","ID_Package","Credit_Amount","Validity_Days","Deduct_On_Present","Deduct_On_Late","Deduct_On_Absent","Deduct_On_Excused","Credit_Cost_Per_Session","Status","Created_At","Updated_At"],
  Package_Credit_Ledger: ["ID_Ledger","ID_Enrollment","ID_Package","ID_Schedule","Source_Key","Transaction_Type","Credit_Change","Balance_After","Note","Created_By","Created_At"],
  Data_Schedule_History: ["ID_History","ID_Schedule","Old_Date","Old_Start","Old_End","New_Date","New_Start","New_End","Reason","Changed_By","Changed_At"],
  Data_Lesson_Report: ["ID_Lesson_Report","ID_Schedule","ID_Batch","ID_Enrollment","Tutor_ID","Topic","Learning_Objective","Activities","Vocabulary","Competency","Student_Performance","Challenges","Follow_Up","Created_At","Updated_At"],
  Data_Assessment: ["ID_Assessment","Title","Description","Assessment_Type","Batch_ID","Program_ID","Level_ID","Start_At","End_At","Duration_Minutes","Max_Attempts","Randomize_Questions","Randomize_Options","Show_Score","Status","Created_By","Created_At","Updated_At"],
  Data_Question_Bank: ["ID_Question","Question_Type","Prompt","Media_Type","Media_URL","Options_JSON","Correct_Answer_JSON","Points","Explanation","Program_ID","Level_ID","Status","Created_By","Created_At","Updated_At"],
  Assessment_Question_Map: ["ID_Map","ID_Assessment","ID_Question","Order_No","Points_Override"],
  Assessment_Attempts: ["ID_Attempt","ID_Assessment","ID_Enrollment","ID_Siswa","Attempt_No","Started_At","Deadline_At","Submitted_At","Status","Score","Max_Score","Question_Order_JSON","Graded_At","Graded_By"],
  Assessment_Answers: ["ID_Answer","ID_Attempt","ID_Question","Answer_JSON","Is_Correct","Score_Awarded","Feedback","Saved_At"],
  Student_Skill_Assessments: ["ID_Skill_Assessment","ID_Enrollment","Skill","Score","Max_Score","Rubric_JSON","Feedback","Evidence_File_ID","Assessment_Date","Assessed_By","Created_At"],
  Data_Expenses: ["ID_Expense","Expense_Date","Category","Description","Amount","Payment_Method","Receipt_File_ID","Created_By","Created_At","Updated_At"],
  Data_Notifications: ["ID_Notification","Recipient_ID","Recipient_Role","Title","Message","Link_Route","Is_Read","Created_At","Read_At"],
  Data_Export_Log: ["ID_Export","Report_Type","Filters_JSON","File_ID","File_Name","Format","Generated_By","Generated_At","Status"],
  Data_Export_Queue: ["ID_Queue","Report_Type","Filters_JSON","Format","Requested_By","Status","Result_File_ID","Error_Message","Created_At","Updated_At"]
};

var COGNIORA_ENUMS = {
  ACCOUNT_STATUS: ["ACTIVE","INACTIVE","LOCKED"],
  BATCH_STATUS: ["PLANNED","ACTIVE","COMPLETED","CANCELLED"],
  ENROLLMENT_STATUS: ["ACTIVE","INACTIVE","COMPLETED","CANCELLED"],
  LEAD_STATUS: ["NEW","CONTACTED","CONVERTED","CLOSED"],
  MATERIAL_STATUS: ["ACTIVE","INACTIVE"],
  MATERIAL_PROGRESS_STATUS: ["NOT_STARTED","IN_PROGRESS","COMPLETED"],
  ASSIGNMENT_STATUS: ["ACTIVE","PLANNED","EXPIRED","INACTIVE"],
  STUDENT_ASSIGNMENT_STATUS: ["NOT_SUBMITTED","SUBMITTED","NEED_REVISION","ACCEPTED"],
  SUBMISSION_STATUS: ["SUBMITTED","REVIEWED","SUPERSEDED"],
  SCHEDULE_TYPE: ["LEARNING_SOURCE","GOOGLE_MEET"],
  SCHEDULE_STATUS: ["PLANNED","ACTIVE","EXPIRED","COMPLETED","CANCELLED"],
  ATTENDANCE_STATUS: ["PRESENT","LATE","ABSENT","EXCUSED"],
  INVOICE_STATUS: ["UNPAID","PENDING","PAID","OVERDUE","CANCELLED"],
  PAYMENT_STATUS: ["PENDING","APPROVED","REJECTED"],
  ACHIEVEMENT_TYPE: ["MANUAL","AUTOMATIC"],
  CERTIFICATE_STATUS: ["LOCKED","ELIGIBLE","GENERATED","ISSUED"],
  CERTIFICATE_ACTION: ["GENERATED","REGENERATED","REISSUED","REVOKED"],
  RESET_STATUS: ["ACTIVE","USED","EXPIRED"]
};

var COGNIORA_ALLOWED_ACTIONS = {
  PUBLIC: [
    "public.content","public.programs","public.packages","public.syllabus","public.testimonials",
    "public.leads.create","public.certificate.verify","public.image"
  ]
};

// ===================== PAYMENT CONFIGURATION (SECURE) =====================
// Nomor rekening tidak disimpan di source code/GitHub.
// Atur Script Property COGNIORA_PAYMENT_ACCOUNTS_JSON berisi array JSON:
// [{"bank":"Bank","number":"nomor","holder":"nama pemilik"}]
var COGNIORA_PAYMENT_ACCOUNTS = [];

// Kolom yang HARUS disimpan sebagai teks (agar "2026-10" tidak berubah menjadi tanggal oleh Google Sheets).
var COGNIORA_TEXT_COLUMNS = {
  Data_Invoice: ["Billing_Month"],
  // V42: nomor WA (angka 0 di depan hilang) dan hash/salt password harus selalu teks.
  Data_Siswa: ["Nomor_WA","Password_Hash","Password_Salt"],
  Data_Leads: ["Nomor_WA"],
  Data_Admin: ["Password_Hash","Password_Salt"]
};

// ===================== V36: normalisasi kolom tanggal/jam =====================
// Google Sheets mengubah "2026-10-12" / "19:00" / "2026-10" menjadi objek Date saat dibaca.
// Kolom di bawah dinormalisasi kembali menjadi teks ("yyyy-MM-dd", "HH:mm", "yyyy-MM") di sheetToObjects_.
var COGNIORA_NORMALIZE_COLUMNS = {
  Data_Schedule:    { Tanggal: "date", Jam_Mulai: "time", Jam_Selesai: "time" },
  Batch_Materials:  { Unlock_Date: "date" },
  Batch_Assignment: { Unlock_Date: "date" },
  Data_Assignment:  { Due_Date: "date" },
  Data_Invoice:     { Billing_Month: "month", Due_Date: "date", Created_At: "datetime" },
  Data_Batch:       { Tanggal_Mulai: "date", Tanggal_Selesai: "date" },
  Data_Enrollment:  { Tanggal_Mulai: "date", Tanggal_Selesai: "date", Updated_At: "datetime", Created_At: "datetime" },
  // V2.1: kolom V2 yang dibandingkan/diurutkan sebagai teks harus dinormalisasi (Sheets mengubahnya menjadi Date).
  Data_Expenses:             { Expense_Date: "date", Created_At: "datetime", Updated_At: "datetime" },
  Data_Payment:              { Submitted_At: "datetime", Approved_At: "datetime" },
  Package_Credit_Ledger:     { Created_At: "datetime" },
  Student_Skill_Assessments: { Assessment_Date: "date", Created_At: "datetime" },
  Batch_Tutor_Assignment:    { Start_Date: "date", End_Date: "date", Assigned_At: "datetime" },
  Data_Lesson_Report:        { Created_At: "datetime", Updated_At: "datetime" },
  Data_Assessment:           { Created_At: "datetime", Updated_At: "datetime" },
  Data_Export_Log:           { Generated_At: "datetime" }
};


// ===================== V41: URL LOGIN UNTUK EMAIL =====================
// Dipakai pada email welcome, reset password, password sementara, dan invoice.
var COGNIORA_LOGIN_URL = ""; // URL login dibaca dari Script Property COGNIORA_LOGIN_URL atau Data_Settings.LOGIN_URL
