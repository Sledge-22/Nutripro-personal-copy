import React, { useState } from "react";
import { CertificateModal, Icon, Progress, Stat, Status, Welcome } from "../components/ui.jsx";
import { ROUTES } from "../routes/appRoutes.js";

function goTo(pathname) {
  window.history.pushState({}, "", pathname);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function getCourseModules(course) {
  return Array.isArray(course?.modules) ? course.modules : [];
}

export function StudentWorkspacePage({
  pathname,
  studentId,
  courses,
  certificates,
  posts,
  progressState,
  onCreatePost,
  onUpdateProgress,
}) {
  const ownedCourses = Array.isArray(courses) ? courses : [];
  const studentCertificates = certificates.filter((certificate) => certificate.studentId === studentId);
  const [previewCertificate, setPreviewCertificate] = useState(null);

  const progressFor = (course) => {
    const modules = getCourseModules(course);
    return modules.length
      ? Math.round((modules.filter((module) => progressState[`module-${module.id}`]).length / modules.length) * 100)
      : 0;
  };

  if (pathname.startsWith("/student/courses/")) {
    const courseId = Number(pathname.split("/").pop());
    const course = ownedCourses.find((entry) => entry.id === courseId);

    return (
      <>
        {course ? (
          <StudentModuleDetail
            course={course}
            completed={progressState}
            onUpdateProgress={onUpdateProgress}
            progress={progressFor(course)}
          />
        ) : (
          <section className="section-card">
            <span className="eyebrow">COURSE DETAIL</span>
            <h2>Course not available</h2>
            <p>This course is not available in your student workspace yet.</p>
          </section>
        )}
      </>
    );
  }

  if (pathname === "/student/certificates") {
    return (
      <>
        {previewCertificate && (
          <CertificateModal certificate={previewCertificate} onClose={() => setPreviewCertificate(null)} />
        )}
        <StudentCertificatesPage certificates={studentCertificates} onPreview={setPreviewCertificate} />
      </>
    );
  }

  if (pathname === "/student/community") {
    return <CommunityPage posts={posts} onCreatePost={onCreatePost} />;
  }

  if (pathname === "/student/courses") {
    return <OwnedCoursesPage courses={ownedCourses} progressFor={progressFor} />;
  }

  return <StudentDashboardPage courses={ownedCourses} certificates={studentCertificates} progressFor={progressFor} />;
}

function StudentDashboardPage({ courses, certificates, progressFor }) {
  const average = courses.length
    ? Math.round(courses.reduce((sum, course) => sum + progressFor(course), 0) / courses.length)
    : 0;

  return (
    <>
      <Welcome title="Welcome back, Maya." text="Keep learning and watch your progress grow." />
      <div className="stats-grid student-stats">
        <Stat icon="courses" label="Owned courses" value={courses.length} note="In your learning area" />
        <Stat icon="dashboard" label="Average progress" value={`${average}%`} note="Across owned courses" />
        <Stat icon="certificate" label="Certificates" value={certificates.length} note="Issued to you" />
      </div>
      <section className="section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CONTINUE LEARNING</span>
            <h2>Your courses</h2>
          </div>
        </div>
        <div className="mini-course-grid">
          {courses.map((course, index) => (
            <article key={course.id}>
              <div className="course-index">{String(index + 1).padStart(2, "0")}</div>
              <h3>{course.title}</h3>
              <Progress value={progressFor(course)} />
              <span>{progressFor(course)}% complete</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function OwnedCoursesPage({ courses, progressFor }) {
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">MY LEARNING</span>
          <h2>Courses you own</h2>
          <p>Only courses assigned to your student account appear here.</p>
        </div>
      </div>
      <div className="owned-grid">
        {courses.map((course, index) => {
          const progress = progressFor(course);
          const modules = getCourseModules(course);

          return (
            <article className="owned-card" key={course.id}>
              <div className={`course-cover cover-${index + 1}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <Icon name="courses" size={34} />
              </div>
              <div className="owned-body">
                <span className="eyebrow">{modules.length} MODULES</span>
                <h3>{course.title}</h3>
                <p>{course.description}</p>
                <div className="progress-label">
                  <span>Course progress</span>
                  <strong>{progress}%</strong>
                </div>
                <Progress value={progress} />
                <button className="primary-btn" onClick={() => goTo(ROUTES.student.courseDetail(course.id))}>
                  Continue course <Icon name="arrow" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function StudentModuleDetail({ course, completed, onUpdateProgress, progress }) {
  const modules = getCourseModules(course);
  const [activeModuleId, setActiveModuleId] = useState(modules[0]?.id || null);
  const [viewError, setViewError] = useState("");

  const activeModule = modules.find((module) => module.id === activeModuleId) || modules[0] || null;
  const pdfSeen = activeModule ? completed[`pdf-${activeModule.id}`] : false;
  const videoSeen = activeModule ? completed[`video-${activeModule.id}`] : false;
  const moduleDone = activeModule ? completed[`module-${activeModule.id}`] : false;
  const canComplete = pdfSeen && videoSeen;

  const markSeen = (key) => {
    void onUpdateProgress({ [key]: true });
  };

  const toggleModule = () => {
    if (!activeModule || !canComplete) return;
    void onUpdateProgress({ [`module-${activeModule.id}`]: !completed[`module-${activeModule.id}`] });
  };

  if (!modules.length) {
    return (
      <>
        <button className="back-button" onClick={() => goTo(ROUTES.student.courses)}>
          ‹ Back to courses
        </button>

        <div className="detail-hero">
          <div>
            <span className="eyebrow">OWNED COURSE</span>
            <h2>{course.title}</h2>
            <p>{course.description}</p>
          </div>
          <div className="hero-progress">
            <strong>{progress}%</strong>
            <span>Course progress</span>
            <Progress value={progress} />
          </div>
        </div>

        <section className="section-card">
          <span className="eyebrow">COURSE MODULES</span>
          <h2>No modules available for this course yet</h2>
          <p>The course has been created, but no modules are available to view yet.</p>
        </section>
      </>
    );
  }

  const pdfSource = activeModule?.pdf_url || activeModule?.pdfUrl || "";
  const videoSource = activeModule?.video_url || activeModule?.videoUrl || "";
  const pdfLabel = activeModule?.pdfLabel || activeModule?.pdfName || "No PDF selected";
  const videoLabel =
    activeModule?.videoName || activeModule?.video?.uploadLabel || activeModule?.video?.link || "No video selected";

  return (
    <>
      <button className="back-button" onClick={() => goTo(ROUTES.student.courses)}>
        ‹ Back to courses
      </button>

      <div className="detail-hero">
        <div>
          <span className="eyebrow">OWNED COURSE</span>
          <h2>{course.title}</h2>
          <p>{course.description}</p>
        </div>
        <div className="hero-progress">
          <strong>{progress}%</strong>
          <span>Course progress</span>
          <Progress value={progress} />
        </div>
      </div>

      <div className="course-detail-layout">
        <aside className="module-list">
          <div className="module-title">
            <span className="eyebrow">COURSE MODULES</span>
            <h3>{modules.length} modules</h3>
          </div>

          {modules.map((module, index) => (
            <div className="module" key={module.id}>
              <button
                className={activeModule?.id === module.id ? "active" : ""}
                onClick={() => {
                  setActiveModuleId(module.id);
                  setViewError("");
                }}
              >
                <span className={`lesson-icon ${completed[`module-${module.id}`] ? "done" : ""}`}>
                  {completed[`module-${module.id}`] ? <Icon name="check" size={14} /> : <span>{index + 1}</span>}
                </span>
                <span>
                  <strong>{module.title}</strong>
                  <small>{module.description}</small>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            </div>
          ))}
        </aside>

        <section className="lesson-content">
          <div className="video-stage">
            <div className="play-large">
              <Icon name="courses" size={28} />
            </div>
            <span>Module assets</span>
          </div>

          <span className="eyebrow">CURRENT MODULE</span>
          <h2>{activeModule?.title || "Select a module"}</h2>
          <p>{activeModule?.description || "This module description will appear here for students."}</p>

          {viewError && <small className="field-note danger-text">{viewError}</small>}

          <div className="module-assets">
            <div className="lesson-meta">
              <span className="subtle-badge">PDF</span>
              <span>{pdfLabel}</span>
            </div>

            {pdfSource ? (
              <div className="row-actions">
                <a href={pdfSource} target="_blank" rel="noreferrer" onClick={() => markSeen(`pdf-${activeModule.id}`)}>
                  Open PDF
                </a>
              </div>
            ) : activeModule?.pdfLabel && activeModule.pdfLabel !== "No PDF selected" ? (
              <small className="field-note danger-text">File name exists, but file URL is missing.</small>
            ) : activeModule?.pdfName ? (
              <small className="field-note danger-text">File name exists, but file URL is missing.</small>
            ) : (
              <small className="field-note">No PDF uploaded yet.</small>
            )}

            <div className="lesson-meta">
              <span className="subtle-badge">Video</span>
              <span>{videoLabel}</span>
            </div>

            {videoSource ? (
              <div className="video-player-shell">
                <video
                  controls
                  width="100%"
                  src={videoSource}
                  onPlay={() => markSeen(`video-${activeModule.id}`)}
                  onError={() => {
                    console.error("Video playback failed for module:", activeModule?.id, videoSource);
                    setViewError("The uploaded video could not be viewed.");
                  }}
                />
              </div>
            ) : activeModule?.video?.uploadLabel && activeModule.video.uploadLabel !== "No video selected" ? (
              <small className="field-note danger-text">File name exists, but file URL is missing.</small>
            ) : activeModule?.videoName ? (
              <small className="field-note danger-text">File name exists, but file URL is missing.</small>
            ) : (
              <small className="field-note">No video uploaded yet.</small>
            )}
          </div>

          <div className="progress-steps">
            <span className={pdfSeen ? "subtle-badge" : "count-badge"}>{pdfSeen ? "PDF viewed" : "PDF pending"}</span>
            <span className={videoSeen ? "subtle-badge" : "count-badge"}>
              {videoSeen ? "Video viewed" : "Video pending"}
            </span>
          </div>

          <button
            className={moduleDone ? "complete-btn done" : "complete-btn"}
            onClick={toggleModule}
            disabled={!activeModule || !canComplete}
          >
            <Icon name="check" />
            {moduleDone ? "Module marked complete" : "Mark module complete"}
          </button>
        </section>
      </div>
    </>
  );
}

function StudentCertificatesPage({ certificates, onPreview }) {
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">MY ACHIEVEMENTS</span>
          <h2>Your certificates</h2>
          <p>Certificates generated for your completed courses.</p>
        </div>
      </div>
      <div className="certificate-grid">
        {certificates.map((certificate) => (
          <article key={certificate.id}>
            <div className="cert-ribbon">
              <Icon name="certificate" size={30} />
            </div>
            <span className="eyebrow">CERTIFICATE OF COMPLETION</span>
            <h3>{certificate.course}</h3>
            <dl>
              <div>
                <dt>Certificate number</dt>
                <dd>{certificate.number}</dd>
              </div>
              <div>
                <dt>Issue date</dt>
                <dd>{certificate.issueDate}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <Status status={certificate.status} />
                </dd>
              </div>
            </dl>
            <button className="secondary-btn" onClick={() => onPreview(certificate)}>
              Preview certificate
            </button>
          </article>
        ))}
      </div>
    </>
  );
}

function CommunityPage({ posts, onCreatePost }) {
  const [form, setForm] = useState({ title: "", body: "" });

  const submit = (event) => {
    event.preventDefault();
    void onCreatePost({ author: "Maya Laurent", initials: "ML", title: form.title, body: form.body });
    setForm({ title: "", body: "" });
  };

  return (
    <div className="community-layout">
      <section>
        <div className="page-intro">
          <div>
            <span className="eyebrow">STUDENT COMMUNITY</span>
            <h2>Recent discussions</h2>
            <p>Share ideas with other Nutripro students.</p>
          </div>
        </div>
        <div className="post-list">
          {posts.map((post) => (
            <article key={post.id}>
              <div className="post-avatar">{post.initials}</div>
              <div>
                <div className="post-meta">
                  <strong>{post.author}</strong>
                  <span>{post.time}</span>
                </div>
                <h3>{post.title}</h3>
                <p>{post.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <form className="section-card post-form" onSubmit={submit}>
        <span className="eyebrow">NEW DISCUSSION</span>
        <h2>Create a post</h2>

        <label>
          Post title
          <input
            required
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="What would you like to discuss?"
          />
        </label>

        <label>
          Your post
          <textarea
            required
            rows="6"
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
            placeholder="Share a thought or question..."
          />
        </label>

        <button className="primary-btn" type="submit">
          <Icon name="plus" />
          Publish post
        </button>
      </form>
    </div>
  );
}
