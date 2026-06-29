import React, { useState } from "react";
import { Icon, OverviewCard, Stat, Status, Welcome } from "../components/ui.jsx";

function createId() {
  return Date.now() + Math.floor(Math.random() * 100000);
}

function createModuleDraft() {
  return {
    id: createId(),
    title: "",
    description: "",
    pdfLabel: "No PDF selected",
    video: {
      id: createId(),
      title: "",
      description: "",
      duration: "10 min",
      link: "",
      uploadLabel: "No video selected",
    },
  };
}

function createCourseDraft(course = null) {
  if (!course) return { title: "", description: "", modules: [createModuleDraft()] };
  return {
    title: course.title,
    description: course.description,
    modules: course.modules.map((module) => ({
      id: module.id,
      title: module.title,
      description: module.description,
      pdfLabel: module.pdfLabel || "No PDF selected",
      video: {
        id: module.video.id,
        title: module.video.title,
        description: module.video.description,
        duration: module.video.duration || "10 min",
        link: module.video.link || "",
        uploadLabel: module.video.uploadLabel || "No video selected",
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
    modules: form.modules.filter((module) => module.title.trim()).map((module) => ({
      id: module.id,
      title: module.title.trim(),
      description: module.description.trim(),
      pdfLabel: module.pdfLabel,
      video: {
        id: module.video.id || createId(),
        title: module.video.title.trim() || `${module.title.trim() || "Module"} video`,
        description: module.video.description.trim() || `${module.title.trim() || "Module"} video overview`,
        duration: module.video.duration || "10 min",
        link: module.video.link.trim(),
        uploadLabel: module.video.uploadLabel,
      },
    })),
  };
}

function slug(value) {
  return (value || "module").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "module";
}

export function AdminWorkspacePage({ pathname, users, setUsers, courses, setCourses, certificates, setCertificates }) {
  if (pathname === "/admin/users") return <UsersAdminPage users={users} setUsers={setUsers} />;
  if (pathname === "/admin/post-courses") return <PostCoursesPage courses={courses} setCourses={setCourses} />;
  if (pathname === "/admin/certificates") return <CertificatesGeneratorPage users={users} courses={courses} certificates={certificates} setCertificates={setCertificates} />;
  return <AdminDashboardPage users={users} courses={courses} certificates={certificates} />;
}

function AdminDashboardPage({ users, courses, certificates }) {
  const students = users.filter((user) => user.role === "Student");
  return <><Welcome title="Good morning, Alex." text="Here is a clear view of your Nutripro workspace." /><div className="stats-grid"><Stat icon="users" label="Total users" value={users.length} note={`${students.filter((user) => user.status === "Active").length} active students`} /><Stat icon="courses" label="Posted courses" value={courses.length} note="Ready for students" /><Stat icon="certificate" label="Certificates" value={certificates.length} note="Generated in total" /></div><section className="section-card"><div className="section-heading"><div><span className="eyebrow">ADMIN OVERVIEW</span><h2>Your three admin areas</h2></div></div><div className="overview-grid"><OverviewCard icon="users" title="Users Admin" text="Activate, deactivate, pause, or delete users." /><OverviewCard icon="courses" title="Post Courses" text="Create, edit, and manage posted courses." /><OverviewCard icon="certificate" title="Certificates Generator" text="Generate course certificates for students." /></div></section></>;
}

function UsersAdminPage({ users, setUsers }) {
  const updateStatus = (id, status) => setUsers((current) => current.map((user) => user.id === id ? { ...user, status } : user));
  const removeUser = (id) => setUsers((current) => current.filter((user) => user.id !== id));
  return <section className="section-card"><div className="section-heading"><div><span className="eyebrow">USER MANAGEMENT</span><h2>All users</h2><p>Manage access for Nutripro admins and students.</p></div><span className="count-badge">{users.length} users</span></div><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.email}</td><td><span className="subtle-badge">{user.role}</span></td><td><Status status={user.status} /></td><td><div className="table-actions"><button onClick={() => updateStatus(user.id, "Active")}>Activate</button><button onClick={() => updateStatus(user.id, "Inactive")}>Deactivate</button><button onClick={() => updateStatus(user.id, "Paused")}>Pause</button><button className="danger-text" onClick={() => removeUser(user.id)}>Delete</button></div></td></tr>)}</tbody></table></div></section>;
}

function PostCoursesPage({ courses, setCourses }) {
  const [form, setForm] = useState(createCourseDraft());
  const [editingId, setEditingId] = useState(null);
  const reset = () => { setForm(createCourseDraft()); setEditingId(null); };
  const updateCourseField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateModule = (moduleId, updater) => setForm((current) => ({ ...current, modules: current.modules.map((module) => module.id === moduleId ? updater(module) : module) }));
  const addModule = () => setForm((current) => ({ ...current, modules: [...current.modules, createModuleDraft()] }));
  const deleteModule = (moduleId) => setForm((current) => ({ ...current, modules: current.modules.filter((module) => module.id !== moduleId) }));
  const editCourse = (course) => { setEditingId(course.id); setForm(createCourseDraft(course)); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const previewCourse = buildCoursePayload(form, editingId, courses.find((course) => course.id === editingId));

  const submit = (event) => {
    event.preventDefault();
    const existingCourse = courses.find((course) => course.id === editingId);
    const payload = buildCoursePayload(form, editingId, existingCourse);
    // TODO(database): Persist courses, modules, PDF uploads, and video uploads in the database and storage layer.
    if (editingId) setCourses((current) => current.map((course) => course.id === editingId ? payload : course));
    else setCourses((current) => [...current, payload]);
    reset();
  };

  return <div className="split-layout"><form className="section-card course-form" onSubmit={submit}><div className="section-heading"><div><span className="eyebrow">{editingId ? "EDIT COURSE" : "NEW COURSE"}</span><h2>{editingId ? "Update course" : "Create and post"}</h2><p>Build the course structure as Course → Module → PDF → Video.</p></div></div><label>Course title<input required value={form.title} onChange={(event) => updateCourseField("title", event.target.value)} placeholder="e.g. Nutrition Essentials" /></label><label>Course description<textarea required rows="4" value={form.description} onChange={(event) => updateCourseField("description", event.target.value)} placeholder="What will students learn?" /></label><div className="builder-stack"><div className="builder-header"><div><span className="eyebrow">MODULES</span><h3>Module files</h3></div><button type="button" className="secondary-btn" onClick={addModule}><Icon name="plus" />Add module</button></div>{form.modules.map((module, index) => <article className="module-editor-card" key={module.id}><div className="module-editor-head"><div><span className="count-badge">Module {index + 1}</span><h4>{module.title.trim() || "New module"}</h4></div><button type="button" className="danger-text mini-action" onClick={() => deleteModule(module.id)}>Delete module</button></div><div className="module-editor-grid"><label>Module title<input required value={module.title} onChange={(event) => updateModule(module.id, (currentModule) => ({ ...currentModule, title: event.target.value }))} placeholder="Module title" /></label><label>Module description<textarea rows="3" value={module.description} onChange={(event) => updateModule(module.id, (currentModule) => ({ ...currentModule, description: event.target.value }))} placeholder="What is covered in this module?" /></label></div><section className="nested-builder single-video-builder"><div className="nested-header"><span className="eyebrow">PDF</span><h5>{module.pdfLabel}</h5></div><button type="button" className="secondary-btn placeholder-btn" onClick={() => updateModule(module.id, (currentModule) => ({ ...currentModule, pdfLabel: `${slug(currentModule.title)}.pdf` }))}><Icon name="plus" />PDF upload placeholder button</button><div className="row-actions"><button type="button" onClick={() => updateModule(module.id, (currentModule) => ({ ...currentModule, pdfLabel: `${slug(currentModule.title)}-updated.pdf` }))}>Replace PDF</button><button type="button" className="danger-text" onClick={() => updateModule(module.id, (currentModule) => ({ ...currentModule, pdfLabel: "No PDF selected" }))}>Remove PDF</button></div></section><section className="nested-builder single-video-builder"><div className="nested-header"><span className="eyebrow">VIDEO</span><h5>{module.video.uploadLabel !== "No video selected" ? module.video.uploadLabel : module.video.link || "No video selected"}</h5></div><button type="button" className="secondary-btn placeholder-btn" onClick={() => updateModule(module.id, (currentModule) => ({ ...currentModule, video: { ...currentModule.video, uploadLabel: `${slug(currentModule.title)}.mp4` } }))}><Icon name="plus" />Video upload placeholder button</button><label>Optional video embed/link field<input value={module.video.link} onChange={(event) => updateModule(module.id, (currentModule) => ({ ...currentModule, video: { ...currentModule.video, link: event.target.value } }))} placeholder="https://example.com/video" /></label><div className="row-actions"><button type="button" onClick={() => updateModule(module.id, (currentModule) => ({ ...currentModule, video: { ...currentModule.video, uploadLabel: `${slug(currentModule.title)}-updated.mp4` } }))}>Replace video</button><button type="button" className="danger-text" onClick={() => updateModule(module.id, (currentModule) => ({ ...currentModule, video: { ...currentModule.video, ...createModuleDraft().video } }))}>Remove video</button></div><small className="field-note">{module.video.link ? `Video link: ${module.video.link}` : "No video link added."}</small></section></article>)}</div><div className="form-actions"><button className="primary-btn" type="submit"><Icon name={editingId ? "check" : "plus"} />{editingId ? "Save changes" : "Post Course"}</button>{editingId && <button type="button" className="secondary-btn" onClick={reset}>Cancel</button>}</div></form><div className="right-rail"><section className="section-card preview-card"><div className="section-heading"><div><span className="eyebrow">COURSE PREVIEW</span><h2>Preview before posting</h2><p>Course → Module → PDF → Video</p></div></div><div className="preview-shell"><h3>{previewCourse.title || "Course title"}</h3><p>{previewCourse.description || "Course description will appear here."}</p><span className="subtle-badge">Assigned to the demo student after posting</span><div className="preview-tree">{previewCourse.modules.length ? previewCourse.modules.map((module) => <article className="preview-module" key={module.id}><h4>{module.title}</h4><p>{module.description}</p><div className="preview-items"><div className="preview-item"><span className="subtle-badge">PDF</span><strong>{module.pdfLabel}</strong></div><div className="preview-item"><span className="subtle-badge">Video</span><strong>{module.video.uploadLabel !== "No video selected" ? module.video.uploadLabel : module.video.link || "No video selected"}</strong></div></div></article>) : <p className="empty-copy">Add at least one module to preview the course structure.</p>}</div></div></section><section className="section-card posted-list"><div className="section-heading"><div><span className="eyebrow">COURSE LIBRARY</span><h2>Posted courses</h2></div><span className="count-badge">{courses.length} courses</span></div><div className="course-admin-list">{courses.map((course) => <article key={course.id}><div className="course-symbol"><Icon name="courses" /></div><div className="course-info"><h3>{course.title}</h3><p>{course.description}</p><span>{course.modules.length} modules</span><span>{course.modules.filter((module) => module.pdfLabel !== "No PDF selected").length} PDFs</span><span>{course.modules.filter((module) => module.video).length} videos</span></div><div className="row-actions"><button onClick={() => editCourse(course)}>Edit</button><button className="danger-text" onClick={() => setCourses((current) => current.filter((item) => item.id !== course.id))}>Delete</button></div></article>)}</div></section></div></div>;
}

function CertificatesGeneratorPage({ users, courses, certificates, setCertificates }) {
  const students = users.filter((user) => user.role === "Student");
  const [studentId, setStudentId] = useState(students[0]?.id || "");
  const [courseId, setCourseId] = useState(courses[0]?.id || "");

  const generate = (event) => {
    event.preventDefault();
    const student = students.find((user) => user.id === Number(studentId));
    const course = courses.find((entry) => entry.id === Number(courseId));
    if (!student || !course) return;
    // TODO(database): Persist certificate generation and retrieval in the database.
    setCertificates((current) => [{ id: createId(), studentId: student.id, student: student.name, courseId: course.id, course: course.title, number: `NP-2026-${String(Math.floor(1000 + Math.random() * 9000))}`, issueDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), status: "Issued" }, ...current]);
  };

  return <div className="cert-layout"><form className="section-card generator-card" onSubmit={generate}><span className="eyebrow">CERTIFICATE GENERATOR</span><h2>Generate a certificate</h2><p>Select a student and completed course.</p><label>Student<select value={studentId} onChange={(event) => setStudentId(event.target.value)}>{students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label><label>Course<select value={courseId} onChange={(event) => setCourseId(event.target.value)}>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label><button className="primary-btn" type="submit"><Icon name="certificate" />Generate certificate</button></form><section className="section-card"><div className="section-heading"><div><span className="eyebrow">GENERATED</span><h2>Certificate list</h2></div><span className="count-badge">{certificates.length} total</span></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Course</th><th>Certificate number</th><th>Issue date</th><th>Status</th></tr></thead><tbody>{certificates.map((certificate) => <tr key={certificate.id}><td><strong>{certificate.student}</strong></td><td>{certificate.course}</td><td><code>{certificate.number}</code></td><td>{certificate.issueDate}</td><td><Status status={certificate.status} /></td></tr>)}</tbody></table></div></section></div>;
}
