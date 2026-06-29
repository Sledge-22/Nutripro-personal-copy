import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const esbuildBin = process.platform === "win32"
  ? path.join(root, "node_modules", ".pnpm", "@esbuild+win32-x64@0.25.5", "node_modules", "@esbuild", "win32-x64", "esbuild.exe")
  : path.join(root, "node_modules", ".bin", "esbuild");

execFileSync(
  esbuildBin,
  [
    path.join(root, "src", "main.jsx"),
    "--bundle",
    "--outfile=" + path.join(dist, "app.js"),
    "--format=esm",
    "--jsx=automatic",
  ],
  { stdio: "inherit" },
);

for (const file of ["index.html", "styles.css"]) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}

console.log(`Nutripro React build created at ${dist}`);
