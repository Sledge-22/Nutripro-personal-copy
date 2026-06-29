import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.join(workspaceRoot, "dist");
const root = fs.existsSync(path.join(distRoot, "index.html")) ? distRoot : workspaceRoot;
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = path.normalize(path.join(root, urlPath));

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        fs.readFile(path.join(root, "index.html"), (fallbackError, fallbackData) => {
          if (fallbackError) {
            res.writeHead(404);
            res.end("Not found");
            return;
          }

          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
          });
          res.end(fallbackData);
        });
        return;
      }

      res.writeHead(200, {
        "Content-Type": types[path.extname(filePath)] || "text/plain; charset=utf-8",
      });
      res.end(data);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`NutriPro preview running at http://127.0.0.1:${port}/`);
  });
