// Generate EZ Climber PWA icons using Node.js canvas-free approach (pure PNG)
// Minimal PNG encoder - creates simple pixel art icons

function createPNG(width, height, drawFn) {
  const pixels = new Uint8Array(width * height * 4);
  
  function setPixel(x, y, r, g, b) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = (y * width + x) * 4;
    pixels[i] = r;
    pixels[i+1] = g;
    pixels[i+2] = b;
    pixels[i+3] = 255;
  }
  
  function fillRect(x, y, w, h, r, g, b) {
    x = Math.floor(x); y = Math.floor(y);
    w = Math.floor(w); h = Math.floor(h);
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        setPixel(px, py, r, g, b);
      }
    }
  }
  
  drawFn(fillRect, width, height);
  
  // Build raw image data with filter bytes
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // no filter
    for (let x = 0; x < width * 4; x++) {
      raw[y * (width * 4 + 1) + 1 + x] = pixels[y * width * 4 + x];
    }
  }
  
  // Deflate using zlib (Node.js)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(raw));
  
  // Build PNG
  const chunks = [];
  
  // Signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  
  function writeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type);
    const crcData = Buffer.concat([typeB, data]);
    
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < crcData.length; i++) {
      crc ^= crcData[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    crc ^= 0xFFFFFFFF;
    const crcB = Buffer.alloc(4);
    crcB.writeUInt32BE(crc >>> 0, 0);
    
    chunks.push(len, typeB, data, crcB);
  }
  
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type (RGB)
  // Remove alpha to simplify - actually let's use RGBA
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  writeChunk('IHDR', ihdr);
  
  // IDAT
  writeChunk('IDAT', compressed);
  
  // IEND
  writeChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat(chunks);
}

function drawIcon(fillRect, size) {
  const dark = [15, 56, 15];
  const light = [155, 188, 15];
  const mid = [48, 98, 48];
  
  // Background
  fillRect(0, 0, size, size, ...dark);
  
  // Border
  const b = Math.max(2, Math.floor(size * 0.04));
  fillRect(b, b, size - b*2, size - b*2, ...mid);
  fillRect(b*2, b*2, size - b*4, size - b*4, ...dark);
  
  const px = size / 32;
  
  // Ladder
  const lx = Math.floor(size * 0.4);
  const lw = Math.floor(size * 0.2);
  const lt = Math.floor(size * 0.15);
  const lb = Math.floor(size * 0.85);
  const railW = Math.max(1, Math.floor(px * 1.5));
  
  fillRect(lx, lt, railW, lb - lt, ...light);
  fillRect(lx + lw - railW, lt, railW, lb - lt, ...light);
  
  const rungCount = 8;
  for (let i = 0; i <= rungCount; i++) {
    const ry = Math.floor(lt + (lb - lt) * i / rungCount);
    fillRect(lx, ry, lw, Math.max(1, Math.floor(px * 0.8)), ...light);
  }
  
  // Player
  const ps = Math.floor(size * 0.12);
  const ppx = Math.floor(size * 0.5 - ps * 0.5);
  const ppy = Math.floor(size * 0.32);
  
  fillRect(ppx + Math.floor(ps*0.2), ppy, Math.floor(ps*0.6), Math.floor(ps*0.35), ...light);
  fillRect(ppx, ppy + Math.floor(ps*0.4), ps, Math.floor(ps*0.3), ...light);
  fillRect(ppx + Math.floor(ps*0.15), ppy + Math.floor(ps*0.75), Math.floor(ps*0.25), Math.floor(ps*0.25), ...light);
  fillRect(ppx + Math.floor(ps*0.6), ppy + Math.floor(ps*0.75), Math.floor(ps*0.25), Math.floor(ps*0.25), ...light);
  
  // Cannon left
  const cs = Math.floor(size * 0.08);
  fillRect(Math.floor(size*0.08), Math.floor(size*0.55), Math.floor(cs*1.5), cs, ...light);
  fillRect(Math.floor(size*0.08 + cs*1.5), Math.floor(size*0.55 + cs*0.25), cs, Math.floor(cs*0.5), ...light);
  
  // Cannon right
  fillRect(Math.floor(size*0.78), Math.floor(size*0.65), Math.floor(cs*1.5), cs, ...light);
  fillRect(Math.floor(size*0.78 - cs), Math.floor(size*0.65 + cs*0.25), cs, Math.floor(cs*0.5), ...light);
}

const fs = require('fs');
const path = require('path');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const outDir = path.join(__dirname, 'icons');

sizes.forEach(size => {
  const png = createPNG(size, size, (fillRect, w, h) => drawIcon(fillRect, size));
  const filename = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`Generated ${filename} (${png.length} bytes)`);
});

console.log('All icons generated!');
