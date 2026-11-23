"use strict";
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const gas = path.join(root, "gas");
const pub = path.join(root, "public");
fs.mkdirSync(pub, { recursive: true });
for (const file of ["index.html", "verify.html"]) {
  const source = path.join(gas, file);
  if (!fs.existsSync(source)) throw new Error(`Missing frontend source: ${source}`);
  fs.copyFileSync(source, path.join(pub, file));
}
console.log("Frontend synced from gas/ to public/.");
