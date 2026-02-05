/**
 * Rename all files under assets/ that contain (N) in the filename to _N.
 * e.g. green_car(2).png -> green_car_2.png
 * Run from project root: node scripts/rename-parentheses-files.js
 */
const fs = require("fs");
const path = require("path");

const assetsDir = path.join(__dirname, "../assets");

function renameInDir(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      count += renameInDir(full);
      continue;
    }
    // Match filename(base)(number).ext -> base_number.ext
    const match = ent.name.match(/^(.+)\((\d+)\)(\.[^.]+)$/);
    if (match) {
      const [, base, num, ext] = match;
      const newName = base + "_" + num + ext;
      const newPath = path.join(dir, newName);
      if (newName !== ent.name && !fs.existsSync(newPath)) {
        fs.renameSync(full, newPath);
        console.log("Renamed:", path.relative(assetsDir, full), "->", newName);
        count++;
      }
    }
  }
  return count;
}

const total = renameInDir(assetsDir);
console.log("Total renamed:", total);
