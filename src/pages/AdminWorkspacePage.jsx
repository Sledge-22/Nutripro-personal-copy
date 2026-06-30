import React, { useState } from "react";
import { Icon, OverviewCard, Stat, Status, Welcome } from "../components/ui.jsx";
import { uploadModulePdf, uploadModuleVideo } from "../services/storageService.js";

function createId() {
  return Date.now() + Math.floor(Math.random() * 100000);
}

function createModuleDraft(sortOrder = 1) {
  return {
    id: createId(),
    sortOrder,
    title: "",
    description: "",
    pdfUrl: "",
    pdfLabel: "No PDF selected",
    pdfUploading: false,
    pdfError: "",
    videoUrl: "",
    video: {
      id: createId(),
      title: "",
      description: "",
      duration: "10 min",
      link: "",
      url: "",
      uploadLabel: "No video selected",
      uploading: false,
      error: "",
    },
  };
}

function createCourseDraft(course = null) {
  if (!course) return { title: "", description: "", modules: [createModuleDraft()] };
  return {
    title: course.title,
    description: course.description,
    modules: course.modules.map((module, index) => ({
      id: module.id,
      sortOrder: module.sortOrder ?? index + 1,
      title: module.title,
      description: module.description,
      pdfUrl: module.pdfUrl || "",
      pdfLabel: module.pdfLabel || "No PDF selected",
      pdfUploading: false,
      pdfError: "",
      videoUrl: module.videoUrl || module.video?.url || module.video?.link || "",
      video: {
        id: module.video.id,
        title: module.video.title,
        description: module.video.description,
        duration: module.video.duration || "10 min",
        link: module.video.link || "",
        url: module.video.url || module.videoUrl || module.video.link || "",
        uploadLabel: module.video.uploadLabel || "No video selected",
        uploading: false,
        error: "",
      },
    })),
  };
}

function buildCoursePayload(form, editingId, existingCourse) {
  return {
    id: editingId || createId(),
    title: form.title.trim(),
    description: form.description.trim(),
    owners: existingCourse?.owners?.length ? existingCourse.owners : [1],
    modules: form.modules
      .filter((module) => module.title.trim())
      .map((module, index) => ({
        id: module.id,
        sortOrder: index + 1,
        title: module.title.trim(),
        description: module.description.trim(),
        pdfUrl: module.pdfUrl,
        pdfLabel: module.pdfLabel,
        videoUrl: module.videoUrl || module.video.url || module.video.link.trim(),
        video: {
          id: module.video.id || createId(),
          title: module.video.title.trim() || `${module.title.trim() || "Module"} video`,
          description: module.video.description.trim() || `${module.title.trim() || "Module"} video overview`,
          duration: module.video.duration || "10 min",
          link: module.video.link.trim(),
          url: module.video.url || module.videoUrl || module.video.link.trim(),
          uploadLabel: module.video.uploadLabel,
        },
      })),
  };
}

function slug(value) {
  return (value || "module").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "module";
}

export function AdminWorkspacePage({ pathname, users, courses, certificates, onUpdateUserStatus, onDeleteUser, onSaveCourse, onDeleteCourse, onGenerateCertificate }) {
  if (pathname === "/admin/users") return <UsersAdminPage users={users} onUpdateUserStatus={onUpdateUserStatus} onDeleteUser={onDeleteUser} />;
  if (pathname === "/admin/post-courses") return <PostCoursesPage courses={courses} onSaveCourse={onSaveCourse} onDeleteCourse={onDeleteCourse} />;
  if (pathname === "/admin/certificates") return <CertificatesGeneratorPage users={users} courses={courses} certificates={certificates} onGenerateCertificate={onGenerateCertificate} />;
  return <AdminDashboardPage users={users} courses={courses} certificates={certificates} />;
}

function AdminDashboardPage({ users, courses, certificates }) {
  const students = users.filter((user) => user.role === "Student");
  return <><Welcome title="Good morning, Alex." text="Here is a clear view of your Nutripro workspace." /><div className="stats-grid"><Stat icon="users" label="Total users" value={users.length} note={`${students.filter((user) => user.status === "Active").length} active students`} /><Stat icon="courses" label="Posted courses" value={courses.length} note="Ready for students" /><Stat icon="certificate" label="Certificates" value={certificates.length} note="Generated in total" /></div><section className="section-card"><div className="section-heading"><div><span className="eyebrow">ADMIN OVERVIEW</span><h2>Your three admin areas</h2></div></div><div className="overview-grid"><OverviewCard icon="users" title="Users Admin" text="Activate, deactivate, pause, or delete users." /><OverviewCard icon="courses" title="Post Courses" text="Create, edit, and manage posted courses." /><OverviewCard icon="certificate" title="Certificates Generator" text="Generate course certificates for students." /></div></section></>;
}

function UsersAdminPage({ users, onUpdateUserStatus, onDeleteUser }) {
  return <section className="section-card"><div className="section-heading"><div><span className="eyebrow">USER MANAGEMENT</span><h2>All users</h2><p>Manage access for Nutripro admins and students.</p></div><span className="count-badge">{users.length} users</span></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.email}</td><td><span className="subtle-badge">{user.role}</span></td><td><Status status={user.status} /></td><td><div className="table-actions"><button onClick={() => void onUpdateUserStatus(user.id, "Active")}>Activate</button><button onClick={() => void onUpdateUserStatus(user.id, "Inactive")}>Deactivate</button><button onClick={() => void onUpdateUserStatus(user.id, "Paused")}>Pause</button><button className="danger-text" onClick={() => void onDeleteUser(user.id)}>Delete</button></div></td></tr>)}</tbody></table></div></section>;
}

function PostCoursesPage({ courses, onSaveCourse, onDeleteCourse }) {
  const [form, setForm] = useState(createCourseDraft());
  const [editingId, setEditingId] = useState(null);
  const [saveError, setSaveError] = useState("");
  const reset = () => { setForm(createCourseDraft()); setEditingId(null); };
  const updateCourseField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateModule = (moduleId, updater) => setForm((current) => ({ ...current, modules: current.modules.map((module) => module.id === moduleId ? updater(module) : module) }));
  const addModule = () => setForm((current) => ({ ...current, modules: [...current.modules, createModuleDraft(current.modules.length + 1)] }));
  const deleteModule = (moduleId) => setForm((current) => ({ ...current, modules: current.modules.filter((module) => module.id !== moduleId).map((module, index) => ({ ...module, sortOrder: index + 1 })) }));
  const editCourse = (course) => { setEditingId(course.id); setForm(createCourseDraft(course)); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const previewCourse = buildCoursePayload(form, editingId, courses.find((course) => course.id === editingId));

  const submit = (event) => {
    event.preventDefault();
    setSaveError("");
    const existingCourse = courses.find((course) => course.id === editingId);
    const payload = buildCoursePayload(form, editingId, existingCourse);
    void Promise.resolve(onSaveCourse(payload, editingId))
      .then((result) => {
        if (result?.ok === false) {
          setSaveError(result.error || "Saving the course failed.");
          return;
        }
        reset();
      })
      .catch((error) => {
        console.error("Course save failed:", error);
        setSaveError("Saving the course failed.");
      });
  };

  const uploadPdf = async (moduleId, file) => {
    if (!file) return;
    updateModule(moduleId, (module) => ({ ...module, pdfUploading: true, pdfError: "", pdfLabel: file.name }));

    try {
      const uploaded = await uploadModulePdf(file, moduleId);
      updateModule(moduleId, (module) => ({
        ...module,
        pdfUploading: false,
        pdfError: "",
        pdfLabel: uploaded.fileName,
        pdfUrl: uploaded.publicUrl || module.pdfUrl,
        pdf_url: uploaded.publicUrl || module.pdfUrl,
      }));
    } catch (error) {
      console.error("PDF upload failed:", error);
      updateModule(moduleId, (module) => ({
        ...module,
        pdfUploading: false,
        pdfError: error.message || "PDF upload failed.",
      }));
    }
  };

  const uploadVideo = async (moduleId, file) => {
    if (!file) return;
    updateModule(moduleId, (module) => ({
      ...module,
      video: { ...module.video, uploading: true, error: "", uploadLabel: file.name },
    }));

    try {
      const uploaded = await uploadModuleVideo(file, moduleId);
      updateModule(moduleId, (module) => ({
        ...module,
        videoUrl: uploaded.publicUrl || module.videoUrl,
        video_url: uploaded.publicUrl || module.videoUrl,
        video: {
          ...module.video,
          uploading: false,
          error: "",
          uploadLabel: uploaded.fileName,
          url: uploaded.publicUrl || module.video.url,
          link: uploaded.publicUrl || module.video.link,
        },
      }));
    } catch (error) {
      console.error("Video upload failed:", error);
      updateModule(moduleId, (module) => ({
        ...module,
        video: {
          ...module.video,
          uploading: false,
          error: error.message || "Video upload failed.",
        },
      }));
    }
  };

  return <div className="split-layout"><form className="section-card course-form" onSubmit={submit}><div className="section-heading"><div><span className="eyebrow">{editingId ? "EDIT COURSE" : "NEW COURSE"}</span><h2>{editingId ? "Update course" : "Create and post"}</h2><p>Build the course structure as Course → Module → PDF → Video.</p></div></div><label>Course title<input required value={form.title} onChange={(event) => updateCourseField("title", event.target.value)} placeholder="e.g. Nutrition Essentials" /></label><label>Course description<textarea required rows="4" value={form.description} onChange={(event) => updateCourseField("description", event.target.value)} placeholder="What will students learn?" /></label>{saveError && <small className="field-note danger-text">{saveError}</small>}<div className="builder-stack"><div className="builder-header"><div><span className="eyebrow">MODULES</span><h3>Module files</h3></div><button type="button" className="secondary-btn" onClick={addModule}><Icon name="plus" />Add module</button></div>{form.modules.map((module, index) => <article className="module-editor-card" key={module.id}><div className="module-editor-head"><div><span className="count-badge">Module {index + 1}</span><h4>{module.title.trim() || "New module"}</h4></div><button type="button" className="danger-text mini-action" onClick={() => deleteModule(module.id)}>Delete module</button></div><div className="module-editor-grid"><label>Module title<input required value={module.title} onChange={(event) => updateModule(module.id, (currentModule) => ({ ...currentModule, title: event.target.value }))} placeholder="Module title" /></label><label>Module description<textarea rows="3" value={module.description} onChange={(event) => updateModule(module.id, (currentModule) => ({ ...currentModule, description: event.target.value }))} placeholder="What is covered in this module?" /></label></div><section className="nested-builder single-video-builder"><div className="nested-header"><span className="eyebrow">PDF</span><h5>{module.pdfLabel}</h5></div><label className="upload-field">Upload PDF<input type="file" accept="application/pdf" onChange={(event) => void uploadPdf(module.id, event.target.files?.[0])} /></label>{module.pdfUploading && <small className="field-note">Uploading PDF...</small>}{module.pdfError && <small className="field-note danger-text">{module.pdfError}</small>}{(module.pdf_url || module.pdfUrl) ? <a href={module.pdf_url || module.pdfUrl} target="_blank" rel="noreferrer">Open PDF</a> : <small className="field-note">No file uploaded yet.</small>}<div className="row-actions"><button type="button" onClick={() => updateModule(module.id, (currentModule) => ({ ...currentModule, pdfLabel: `${slug(currentModule.title)}.pdf` }))}>Replace PDF</button><button type="button" className="danger-text" onClick={() => updateModule(module.id, (currentModule) => ({ ...currentModule, pdfUrl: "", pdf_url: "", pdfLabel: "No PDF selected", pdfError: "" }))}>Remove PDF</button></div></section><section className="nested-builder single-video-builder"><div className="nested-header"><span className="eyebrow">VIDEO</span><h5>{module.video.uploadLabel !== "No video selected" ? module.video.uploadLabel : module.video.link || "No video selected"}</h5></div><label className="upload-field">Upload video<input type="file" accept="video/*" onChange={(event) => void uploadVideo(module.id, event.target.files?.[0])} /></label>{module.video.uploading && <small className="field-note">Uploading video...</small>}{module.video.error && <small className="field-note danger-text">{module.video.error}</small>}{(module.video_url || module.videoUrl) ? <><a href={module.video_url || module.videoUrl} target="_blank" rel="noreferrer">Open Video</a><div className="video-player-shell"><video controls width="100%" src={module.video_url || module.videoUrl} /></div></> : <small className="field-note">No file uploaded yet.</small>}<label>Optional video embed/link field<input value={module.video.link} onChange={(event) => updateModule(module.id, (currentModule) => ({ ...currentModule, videoUrl: event.target.value, video_url: event.target.value, video: { ...currentModule.video, link: event.target.value, url: event.target.value } }))} placeholder="https://example.com/video" /></label><div className="row-actions"><button type="button" onClick={() => updateModule(module.id, (currentModule) => ({ ...currentModule, video: { ...currentModule.video, uploadLabel: `${slug(currentModule.title)}-updated.mp4` } }))}>Replace video</button><button type="button" className="danger-text" onClick={() => updateModule(module.id, (currentModule) => ({ ...currentModule, videoUrl: "", video_url: "", video: { ...currentModule.video, link: "", url: "", uploadLabel: "No video selected", error: "" } }))}>Remove video</button></div><small className="field-note">{module.video.link ? `Video link: ${module.video.link}` : "No video link added."}</small></section></article>)}</div><div className="form-actions"><button className="primary-btn" type="submit"><Icon name={editingId ? "check" : "plus"} />{editingId ? "Save changes" : "Post Course"}</button>{editingId && <button type="button" className="secondary-btn" onClick={reset}>Cancel</button>}</div></form><div className="right-rail"><section className="section-card preview-card"><div className="section-heading"><div><span className="eyebrow">COURSE PREVIEW</span><h2>Preview before posting</h2><p>Course → Module → PDF → Video</p></div></div><div className="preview-shell"><h3>{previewCourse.title || "Course title"}</h3><p>{previewCourse.description || "Course description will appear here."}</p><span className="subtle-badge">Assigned to the demo student after posting</span><div className="preview-tree">{previewCourse.modules.length ? previewCourse.modules.map((module) => <article className="preview-module" key={module.id}><h4>{module.title}</h4><p>{module.description}</p><div className="preview-items"><div className="preview-item"><span className="subtle-badge">PDF</span><strong>{module.pdfLabel}</strong></div><div className="preview-item"><span className="subtle-badge">Video</span><strong>{module.video.uploadLabel !== "No video selected" ? module.video.uploadLabel : module.video_url || module.videoUrl || module.video.link || "No video selected"}</strong></div></div></article>) : <p className="empty-copy">Add at least one module to preview the course structure.</p>}</div></div></section><section className="section-card posted-list"><div className="section-heading"><div><span className="eyebrow">COURSE LIBRARY</span><h2>Posted courses</h2></div><span className="count-badge">{courses.length} courses</span></div><div className="course-admin-list">{courses.map((course) => <article key={course.id}><div className="course-symbol"><Icon name="courses" /></div><div className="course-info"><h3>{course.title}</h3><p>{course.description}</p><span>{course.modules.length} modules</span><span>{course.modules.filter((module) => module.pdf_url || module.pdfUrl || module.pdfLabel !== "No PDF selected").length} PDFs</span><span>{course.modules.filter((module) => module.video_url || module.videoUrl || module.video?.url || module.video?.link).length} videos</span></div><div className="row-actions"><button onClick={() => editCourse(course)}>Edit</button><button className="danger-text" onClick={() => void onDeleteCourse(course.id)}>Delete</button></div></article>)}</div></section></div></div>;
}

function CertificatesGeneratorPage({ users, courses, certificates, onGenerateCertificate }) {
  const students = users.filter((user) => user.role === "Student");
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [courseId, setCourseId] = useState(courses[0]?.id || "");

  const generate = (event) => {
    event.preventDefault();
    const student = students.find((user) => user.id === Number(studentId));
    const course = courses.find((entry) => entry.id === Number(courseId));
    if (!student || !course) return;
    void onGenerateCertificate({ studentId: student.id, student: student.name, courseId: course.id, course: course.title });
  };

  return <div className="cert-layout"><form className="section-card generator-card" onSubmit={generate}><span className="eyebrow">CERTIFICATE GENERATOR</span><h2>Generate a certificate</h2><p>Select a student and completed course.</p><label>Student<select value={studentId} onChange={(event) => setStudentId(event.target.value)}>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label><label>Course<select value={courseId} onChange={(event) => setCourseId(event.target.value)}>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label><button className="primary-btn" type="submit"><Icon name="certificate" />Generate certificate</button></form><section className="section-card"><div className="section-heading"><div><span className="eyebrow">GENERATED</span><h2>Certificate list</h2></div><span className="count-badge">{certificates.length} total</span></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Course</th><th>Certificate number</th><th>Issue date</th><th>Status</th></tr></thead><tbody>{certificates.map((certificate) => <tr key={certificate.id}><td><strong>{certificate.student}</strong></td><td>{certificate.course}</td><td><code>{certificate.number}</code></td><td>{certificate.issueDate}</td><td><Status status={certificate.status} /></td></tr>)}</tbody></table></div></section></div>;
}
