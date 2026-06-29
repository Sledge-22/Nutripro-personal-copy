import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const required = ["index.html", "styles.css", "preview-server.js", path.join("src", "main.jsx"), path.join("src", "App.jsx"), path.join("src", "app", "App.jsx"), path.join("src", "data", "mockData.js"), path.join("src", "routes", "appRoutes.js")];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Missing required files: ${missing.join(", ")}`);
  process.exit(1);
}

const filesToScan = [
  path.join(root, "src", "main.jsx"),
  path.join(root, "src", "App.jsx"),
  path.join(root, "src", "app", "App.jsx"),
  path.join(root, "src", "data", "mockData.js"),
  path.join(root, "src", "pages", "AdminWorkspacePage.jsx"),
  path.join(root, "src", "pages", "StudentWorkspacePage.jsx"),
];
const source = filesToScan.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const forbidden = ["Instructor", "Support Ticket", "Purchase", "Review Queue", "Payment"];
const found = forbidden.filter((term) => source.includes(term));
if (found.length) {
  console.error(`Out-of-scope features found: ${found.join(", ")}`);
  process.exit(1);
}

console.log("Nutripro scope validation passed.");
