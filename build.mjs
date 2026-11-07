// Arma la carpeta dist/: copia la app, trae las tipografías desde npm y genera los íconos PNG.
import { mkdir, copyFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = "dist";
const ARCHIVOS = ["index.html", "styles.css", "app.js", "sw.js", "manifest.webmanifest", "icons/icon.svg"];
const FUENTES = [
  ["@fontsource/barlow", "barlow-latin-400-normal.woff2"],
  ["@fontsource/barlow", "barlow-latin-500-normal.woff2"],
  ["@fontsource/barlow", "barlow-latin-600-normal.woff2"],
  ["@fontsource/barlow-condensed", "barlow-condensed-latin-600-normal.woff2"],
  ["@fontsource/barlow-condensed", "barlow-condensed-latin-700-normal.woff2"]
];

await rm(OUT, { recursive: true, force: true });
await mkdir(path.join(OUT, "icons"), { recursive: true });
await mkdir(path.join(OUT, "fonts"), { recursive: true });

for (const f of ARCHIVOS) await copyFile(f, path.join(OUT, f));

for (const [pkg, archivo] of FUENTES) {
  await copyFile(path.join("node_modules", pkg, "files", archivo), path.join(OUT, "fonts", archivo));
}
await copyFile(path.join("node_modules", "@fontsource/barlow", "LICENSE"), path.join(OUT, "fonts", "OFL.txt"));

// Íconos: redondeado para "any"; a sangre completa para iOS y Android (ellos recortan la forma)
const svg = await readFile("icons/icon.svg", "utf8");
const svgCompleto = svg.replace(' rx="112"', "");
const ICONOS = [
  ["icon-192.png", 192, svg],
  ["icon-512.png", 512, svg],
  ["icon-maskable-512.png", 512, svgCompleto],
  ["apple-touch-icon.png", 180, svgCompleto]
];
for (const [nombre, lado, fuente] of ICONOS) {
  await sharp(Buffer.from(fuente), { density: 144 })
    .resize(lado, lado)
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, "icons", nombre));
}

console.log(`Listo: ${OUT}/ con ${ARCHIVOS.length} archivos, ${FUENTES.length} tipografías y ${ICONOS.length} íconos`);
