const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const groundDir = path.join(__dirname, '..', 'assets', 'sprites', 'ground');

// Files that need background removal
const filesToProcess = [
  'road_corner_ne_se.jpg',
  'road_corner_nw_ne.jpg',
  'road_corner_nw_sw.jpg',
  'road_corner_sw_se.jpg',
  'road_t_missing_ne.jpg',
  'road_t_missing_nw.jpg',
  'road_t_missing_se.jpg',
  'road_t_missing_sw.jpg',
];

async function removeBackground(inputFile) {
  const inputPath = path.join(groundDir, inputFile);
  const outputFile = inputFile.replace('.jpg', '.png');
  const outputPath = path.join(groundDir, outputFile);

  console.log(`Processing ${inputFile}...`);

  try {
    // Read the image
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // Get raw pixel data
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Sample the corner pixel to get background color
    // (top-left corner should be background)
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];

    console.log(`  Background color detected: RGB(${bgR}, ${bgG}, ${bgB})`);

    // Create alpha channel - make background transparent
    const pixels = Buffer.alloc(info.width * info.height * 4);
    const tolerance = 30; // Color tolerance for background detection

    for (let i = 0; i < info.width * info.height; i++) {
      const srcIdx = i * 3;
      const dstIdx = i * 4;

      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];

      pixels[dstIdx] = r;
      pixels[dstIdx + 1] = g;
      pixels[dstIdx + 2] = b;

      // Check if pixel is similar to background color
      const isBackground =
        Math.abs(r - bgR) <= tolerance &&
        Math.abs(g - bgG) <= tolerance &&
        Math.abs(b - bgB) <= tolerance;

      // Set alpha: 0 for background, 255 for foreground
      pixels[dstIdx + 3] = isBackground ? 0 : 255;
    }

    // Save as PNG with transparency
    await sharp(pixels, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4,
      },
    })
      .png()
      .toFile(outputPath);

    console.log(`  Saved ${outputFile}`);

    // Delete the old JPG file
    fs.unlinkSync(inputPath);
    console.log(`  Deleted ${inputFile}`);

    return outputFile;
  } catch (error) {
    console.error(`  Error processing ${inputFile}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('Removing backgrounds from road tile images...\n');

  for (const file of filesToProcess) {
    await removeBackground(file);
    console.log('');
  }

  console.log('Done! Update CityScreen.tsx to use .png extensions.');
}

main();
