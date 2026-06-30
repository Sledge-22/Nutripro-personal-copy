import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";
import { createMockId, getMockCertificates, setMockCertificates } from "./mockStore.js";

function createCertificateNumber() {
  return `NP-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
}

function createIssueDate() {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeCertificate(row) {
  return {
    id: row.id,
    studentId: row.student_id ?? row.studentId,
    student: row.student_name ?? row.student ?? "",
    courseId: row.course_id ?? row.courseId,
    course: row.course_title ?? row.course ?? "",
    number: row.certificate_number ?? row.number ?? "",
    issueDate: row.issue_date ?? row.issueDate ?? "",
    status: row.status ?? "Issued",
  };
}

function createMockCertificate(payload) {
  const certificates = getMockCertificates();
  const created = { id: createMockId(certificates), ...payload };
  setMockCertificates([created, ...certificates]);
  return created;
}

export async function getCertificates() {
  if (!isSupabaseConfigured) return getMockCertificates();

  try {
    const { data, error } = await supabase.from("certificates").select("*").order("id", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(normalizeCertificate);
  } catch {
    return getMockCertificates();
  }
}

export async function generateCertificate({ studentId, student, courseId, course }) {
  const payload = {
    studentId,
    student,
    courseId,
    course,
    number: createCertificateNumber(),
    issueDate: createIssueDate(),
    status: "Issued",
  };

  if (!isSupabaseConfigured) {
    return createMockCertificate(payload);
  }

  try {
    const { data, error } = await supabase
      .from("certificates")
      .insert({
        student_id: payload.studentId,
        student_name: payload.student,
        course_id: payload.courseId,
        course_title: payload.course,
        certificate_number: payload.number,
        issue_date: payload.issueDate,
        status: payload.status,
      })
      .select("*")
      .single();

    if (error) throw error;
    return normalizeCertificate(data);
  } catch {
    return createMockCertificate(payload);
  }
}

export async function getStudentCertificates(studentId) {
  if (!isSupabaseConfigured) {
    return getMockCertificates().filter((certificate) => certificate.studentId === studentId);
  }

  try {
    const { data, error } = await supabase.from("certificates").select("*").eq("student_id", studentId).order("id", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(normalizeCertificate);
  } catch {
    return getMockCertificates().filter((certificate) => certificate.studentId === studentId);
  }
}
