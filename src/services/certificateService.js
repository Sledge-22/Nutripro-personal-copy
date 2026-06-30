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
    const certificates = getMockCertificates();
    const created = { id: createMockId(certificates), ...payload };
    setMockCertificates([created, ...certificates]);
    return created;
  }

  try {
    // TODO(database): Persist generated certificates against the final Supabase certificates table schema.
    const { data, error } = await supabase.from("certificates").insert(payload).select().single();
    if (error) throw error;
    return data;
  } catch {
    const certificates = getMockCertificates();
    const created = { id: createMockId(certificates), ...payload };
    setMockCertificates([created, ...certificates]);
    return created;
  }
}

export async function getStudentCertificates(studentId) {
  if (!isSupabaseConfigured) {
    return getMockCertificates().filter((certificate) => certificate.studentId === studentId);
  }

  try {
    // TODO(database): Retrieve student certificates against the final Supabase certificates table schema.
    const { data, error } = await supabase.from("certificates").select("*").eq("studentId", studentId).order("id", { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch {
    return getMockCertificates().filter((certificate) => certificate.studentId === studentId);
  }
}
