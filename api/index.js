/**
 * COGNIORA Vercel API Proxy
 * -----------------------------------------
 * Browser -> /api -> this Vercel Function -> Google Apps Script /exec
 *
 * Required Vercel Environment Variable:
 *   GAS_WEBAPP_URL = https://script.google.com/macros/s/DEPLOYMENT_ID/exec
 *
 * No Google credential is exposed to the browser.
 */

const ALLOWED_ACTIONS = new Set([
  // Public / landing
  "registerLead",
  "getLandingImages",
  "getAboutLearningGallery",
  "getAboutLearningImage",
  "verifyCertificatePublic",

  // Student auth/session
  "loginStudent",
  "validateSession",
  "logoutSession",
  "acceptTermsOfService",

  // Student
  "getDashboardData",
  "getMaterials",
  "getAssignments",
  "getSchedule",
  "getPayments",
  "getReports",
  "getMonthlyProgress",
  "getCertificate",
  "getCertificatePdf",
  "getStudentProfile",
  "getStudentPhoto",
  "searchStudentContent",

  // Admin auth/session
  "loginAdmin",
  "validateAdminSession",
  "logoutAdminSession",

  // Admin overview / CRM
  "getAdminOverview",
  "getAdminLeads",
  "getAdminBatches",
  "getAdminStudents",
  "getAdminMaterials",
  "getAdminTasks",
  "getAdminAssignmentReview",
  "getAdminTaskSubmissions",
  "getAdminSchedule",
  "getAdminPayments",
  "getAdminReportBook",

  // Admin mutations
  "convertLeadsToStudents",
  "assignStudentBatch",
  "updateStudentActiveStatus",
  "saveAdminBatch",
  "saveAdminMaterial",
  "saveAdminTask",
  "saveAdminSchedule",
  "saveSubmissionGrade",
  "reviewPaymentProof",
  "saveReportAspect",
  "saveReportScores",

  // Certificates / Google Docs
  "getAdminCertificates",
  "getAdminCertificateConfig",
  "saveCertificateTemplateSettings",
  "authorizeGoogleDocsAccess",
  "validateCertificateTemplate",
  "generateCertificate",
  "generateCertificatesForBatch",
  "regenerateCertificate",
  "reissueCertificate",
  "revokeCertificate",

  // Student profile image
  // These are included for API compatibility. The current
  // HTML-form Blob upload needs a separate upload transport.
  "saveStudentProfilePhoto",

  // Existing assignment/payment functions.
  // See README: file uploads need a separate route because
  // Vercel Function request bodies are size-limited.
  "submitAssignment",
  "uploadPaymentProof"
]);

function sendJson(response, status, payload) {
  response.status(status);
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.json(payload);
}

function getBody(request) {
  try {
    if (request && request.body != null) {
      return typeof request.body === "string"
        ? JSON.parse(request.body)
        : request.body;
    }
  } catch (e) {
    throw new Error("JSON request body tidak valid.");
  }
  return {};
}

async function readUpstreamResponse(upstream) {
  const text = await upstream.text();

  try {
    return {
      ok: true,
      data: JSON.parse(text),
      raw: text
    };
  } catch (e) {
    return {
      ok: false,
      data: null,
      raw: text
    };
  }
}

export default async function handler(request, response) {
  // Health check:
  // https://your-domain.vercel.app/api?api=health
  if (request.method === "GET") {
    const url = new URL(request.url);

    if (url.searchParams.get("api") === "health") {
      return sendJson(response, 200, {
        success: true,
        service: "cogniora-vercel-api",
        status: "healthy",
        time: new Date().toISOString()
      });
    }

    return sendJson(response, 200, {
      success: true,
      service: "cogniora-vercel-api",
      message: "Use POST /api for Cogniora actions."
    });
  }

  if (request.method !== "POST") {
    return sendJson(response, 405, {
      success: false,
      message: "Method tidak diizinkan."
    });
  }

  const gasUrl = String(process.env.GAS_WEBAPP_URL || "").trim();

  if (!gasUrl) {
    return sendJson(response, 500, {
      success: false,
      message: "GAS_WEBAPP_URL belum dikonfigurasi di Vercel."
    });
  }

  let body;

  try {
    body = getBody(request);
  } catch (err) {
    return sendJson(response, 400, {
      success: false,
      message: err.message
    });
  }

  const action = String(body?.action || "").trim();
  const args = Array.isArray(body?.args) ? body.args : [];

  if (!action) {
    return sendJson(response, 400, {
      success: false,
      message: "Action API belum diisi."
    });
  }

  if (!ALLOWED_ACTIONS.has(action)) {
    return sendJson(response, 400, {
      success: false,
      message: `Action API tidak diizinkan: ${action}`
    });
  }

  try {
    const upstream = await fetch(gasUrl, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        action,
        args
      })
    });

    const parsed = await readUpstreamResponse(upstream);

    if (!parsed.ok) {
      console.error("Apps Script returned non-JSON:", parsed.raw.slice(0, 1000));

      return sendJson(response, 502, {
        success: false,
        message: "Apps Script tidak mengembalikan JSON.",
        upstreamStatus: upstream.status,
        upstreamPreview: parsed.raw.slice(0, 500)
      });
    }

    // Keep the application's own success:false as HTTP 200.
    // The current Cogniora frontend handles r.success itself.
    return sendJson(response, 200, parsed.data);

  } catch (err) {
    console.error("GAS proxy error:", err);

    return sendJson(response, 502, {
      success: false,
      message: "Gagal menghubungi Google Apps Script.",
      detail: err?.message || String(err)
    });
  }
}
