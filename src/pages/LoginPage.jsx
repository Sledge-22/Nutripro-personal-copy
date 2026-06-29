import React from "react";
import { Brand, Icon } from "../components/ui.jsx";

export function LoginPage({ onChoose }) {
  return <main className="login-page">
    <section className="login-panel">
      <Brand />
      <div className="login-copy"><span className="eyebrow">WELCOME TO NUTRIPRO</span><h1>Where nutrition<br />knowledge grows.</h1><p>Choose an area to explore the Nutripro demo.</p></div>
      <div className="role-options">
        <button onClick={() => onChoose("Admin")}><span className="role-icon admin"><Icon name="users" size={24} /></span><span><strong>Continue as Admin</strong><small>Manage users, courses, and certificates</small></span><Icon name="arrow" /></button>
        <button onClick={() => onChoose("Student")}><span className="role-icon student"><Icon name="courses" size={24} /></span><span><strong>Continue as Student</strong><small>View courses, progress, and community</small></span><Icon name="arrow" /></button>
      </div>
      <p className="demo-note">Demo access - no password required</p>
    </section>
    <aside className="login-visual"><div className="visual-orbit one" /><div className="visual-orbit two" /><div className="visual-card"><div className="leaf">N</div><p>Learn at your own pace</p><strong>Practical nutrition,<br />made simple.</strong><div className="mini-progress"><span /></div></div></aside>
  </main>;
}
