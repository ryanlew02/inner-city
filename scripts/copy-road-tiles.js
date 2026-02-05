/**
 * Copy road tiles to simple filenames (no parentheses) so Metro bundler can resolve them.
 * Run once: node scripts/copy-road-tiles.js
 */
const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "../assets/Sprites/RoadTiles");
const destDir = path.join(__dirname, "../assets/Sprites/RoadTilesSimple");

const mapping = [
  ["road_asphalt_1.png", "road_1.png"],
  ["road_asphalt_2.png", "road_2.png"],
  ["road_asphalt_3.png", "road_3.png"],
  ["road_asphalt_5.png", "road_5.png"],
  ["road_asphalt_6.png", "road_6.png"],
  ["road_asphalt_7.png", "road_7.png"],
  ["road_asphalt_8.png", "road_8.png"],
];

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

for (const [srcName, destName] of mapping) {
  const src = path.join(srcDir, srcName);
  const dest = path.join(destDir, destName);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log("Copied", srcName, "->", destName);
  } else {
    console.warn("Skip (not found):", src);
  }
}

console.log("Done. Road tiles are in assets/Sprites/RoadTilesSimple/");
