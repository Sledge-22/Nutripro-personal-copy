import React from "react";
import { Brand } from "../components/ui.jsx";
import { LanguageDropdown } from "../components/LanguageDropdown.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";

export function PrivacyPage({ onBack }) {
  const { language } = useLanguage();

  const isSpanish = language === "es";
  const title = isSpanish ? "Política de privacidad y uso de datos" : "Privacy Policy and Data Use";
  const draftNote = isSpanish
    ? "Este aviso de privacidad es un borrador de trabajo y debe revisarse antes del lanzamiento público."
    : "This privacy notice is a working draft and should be reviewed before public launch.";
  const backLabel = isSpanish ? "Volver" : "Back";
  const contactLabel = isSpanish ? "Para preguntas de privacidad o solicitudes de datos, contacta: [ADD CONTACT EMAIL]" : "For privacy questions or data requests, contact: [ADD CONTACT EMAIL]";
  const updatedLabel = isSpanish ? "Última actualización: 2026-07-17" : "Last updated: July 17, 2026";

  const sections = isSpanish
    ? [
        {
          heading: "Política de privacidad y uso de datos",
          paragraphs: [
            "Nutripro es una plataforma de aprendizaje para educación en nutrición deportiva. Recopilamos y usamos información personal limitada para crear cuentas, proporcionar acceso a cursos, registrar el progreso de aprendizaje, apoyar funciones de comunidad y comunicar información importante sobre la cuenta.",
          ],
        },
        {
          heading: "Información que podemos recopilar",
          bullets: [
            "Nombre",
            "Correo electrónico",
            "Nombre de usuario",
            "Rol, como estudiante, instructor, soporte o administrador",
            "Información de perfil como biografía, país, foto de perfil y nombre visible",
            "Inscripciones y progreso en cursos",
            "Entregas de tareas y archivos subidos",
            "Publicaciones, comentarios y archivos subidos en la comunidad",
            "Estado de cuenta e información relacionada con el inicio de sesión",
            "Registros de consentimiento e historial de aceptación de privacidad",
          ],
        },
        {
          heading: "Cómo usamos esta información",
          bullets: [
            "Para crear y administrar cuentas de usuario",
            "Para proporcionar acceso a cursos asignados",
            "Para registrar progreso y finalización",
            "Para emitir certificados",
            "Para permitir la participación en el área de comunidad",
            "Para que los administradores gestionen usuarios, cursos, tareas y moderación",
            "Para enviar invitaciones, restablecimientos de contraseña y notificaciones importantes de la cuenta",
            "Para proteger la plataforma contra uso indebido y mantener la seguridad",
          ],
        },
        {
          heading: "Quién puede ver la información",
          bullets: [
            "Los estudiantes pueden ver su propia cuenta, progreso de cursos, tareas, certificados y actividad en la comunidad.",
            "Los administradores pueden gestionar cuentas de usuario, cursos, progreso, entregas, certificados y moderación de comunidad.",
            "Los visitantes públicos no deberían poder ver detalles privados de perfil, progreso de cursos, tareas ni archivos subidos.",
            "Las publicaciones de comunidad pueden mostrar información limitada del perfil, como nombre visible, rol, insignia de país y foto de perfil si el usuario participa en funciones de comunidad.",
          ],
        },
        {
          heading: "Compartir datos",
          paragraphs: [
            "No vendemos información personal de los usuarios. Algunos servicios externos pueden procesar información limitada solo para operar la plataforma, como autenticación, base de datos, almacenamiento de archivos, despliegue y envío de correos.",
          ],
        },
        {
          heading: "Opciones y derechos del usuario",
          paragraphs: [
            "Los usuarios pueden solicitar acceso, corrección o eliminación de su información personal, sujeto a requisitos de cuenta, cursos, seguridad y legales. Los usuarios también pueden solicitar información sobre cómo se usan sus datos.",
          ],
        },
        {
          heading: "Manejo de archivos y correos",
          paragraphs: [
            "Los archivos subidos para cursos, tareas y comunidad se almacenan para permitir el funcionamiento de la plataforma. Las invitaciones por correo y los correos de restablecimiento de acceso se usan únicamente para acceso a la cuenta y notificaciones relacionadas.",
          ],
        },
        {
          heading: "Retención de datos",
          paragraphs: [
            "La retención de datos todavía debe definirse con el equipo de negocio y legal. Mientras tanto, Nutripro conserva la información necesaria para operar el servicio, mantener seguridad básica y respaldar el historial académico y administrativo.",
          ],
        },
      ]
    : [
        {
          heading: "Privacy Policy and Data Use",
          paragraphs: [
            "Nutripro is a learning platform for sports nutrition education. We collect and use limited personal information to create accounts, provide course access, track learning progress, support community features, and communicate important account information.",
          ],
        },
        {
          heading: "Information we may collect",
          bullets: [
            "Name",
            "Email address",
            "Username",
            "Role, such as student, instructor, support, or administrator",
            "Profile information such as bio, country, profile picture, and display name",
            "Course enrollments and progress",
            "Assignment submissions and uploaded files",
            "Community posts, comments, and uploaded community files",
            "Account status and login-related information",
            "Consent records and privacy acknowledgement history",
          ],
        },
        {
          heading: "How we use this information",
          bullets: [
            "To create and manage user accounts",
            "To provide access to assigned courses",
            "To track progress and completion",
            "To issue certificates",
            "To allow users to participate in the community area",
            "To let administrators manage users, courses, assignments, and moderation",
            "To send invitations, password reset messages, and important account notifications",
            "To protect the platform from misuse and maintain security",
          ],
        },
        {
          heading: "Who can see information",
          bullets: [
            "Students can see their own account, course progress, assignments, certificates, and community activity.",
            "Administrators can manage user accounts, courses, progress, submissions, certificates, and community moderation.",
            "Public visitors should not be able to view private profile details, course progress, assignments, or uploaded files.",
            "Community posts may show limited profile information such as display name, role, country badge, and profile image if the user participates in community features.",
          ],
        },
        {
          heading: "Data sharing",
          paragraphs: [
            "We do not sell user personal information. Some third-party services may process limited information only to operate the platform, such as authentication, database hosting, file storage, deployment, and email delivery.",
          ],
        },
        {
          heading: "User choices and rights",
          paragraphs: [
            "Users may request access, correction, or deletion of their personal information, subject to account, course, security, and legal requirements. Users may also request information about how their data is used.",
          ],
        },
        {
          heading: "Files and emails",
          paragraphs: [
            "Uploaded course files, assignment files, and community files are stored to operate the platform. Invitation emails and password reset emails are used only for account access and related account communication.",
          ],
        },
        {
          heading: "Data retention",
          paragraphs: [
            "Data retention details still need final business and legal review. For now, Nutripro keeps the information needed to operate the service, maintain baseline security, and support academic and administrative records.",
          ],
        },
      ];

  return (
    <main className="login-page auth-page">
      <section className="login-panel auth-panel privacy-panel">
        <div className="login-topbar">
          <Brand />
          <LanguageDropdown />
        </div>

        <div className="login-copy">
          <span className="eyebrow">{isSpanish ? "PRIVACIDAD" : "PRIVACY"}</span>
          <h1>{title}</h1>
          <p>{draftNote}</p>
        </div>

        <div className="section-card privacy-note-card">
          <strong>{draftNote}</strong>
        </div>

        <div className="privacy-sections">
          {sections.map((section) => (
            <section key={section.heading} className="section-card privacy-section-card">
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets?.length ? (
                <ul className="privacy-list">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          <section className="section-card privacy-section-card">
            <h2>{isSpanish ? "Contacto" : "Contact"}</h2>
            <p>{contactLabel}</p>
            <p>{updatedLabel}</p>
          </section>
        </div>

        <div className="form-actions">
          <button type="button" className="secondary-btn" onClick={() => onBack?.()}>
            {backLabel}
          </button>
        </div>
      </section>
    </main>
  );
}
