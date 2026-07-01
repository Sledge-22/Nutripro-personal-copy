import React from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { App } from "./App.jsx";
import { LanguageProvider } from "./i18n/LanguageContext.jsx";

createRoot(document.getElementById("root")).render(<LanguageProvider><App /></LanguageProvider>);
