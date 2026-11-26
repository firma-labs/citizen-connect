// Copies the scanner's browser files from node_modules into public/vendor so
// the browser loads them from this site (and the service worker caches them
// for offline scanning) instead of bundling them into the app's JavaScript or
// fetching them from a CDN:
//
//   OpenCV.js (~11 MB)       page clean-up and edge refinement
//   scanic ML loader (~50 KB) + scanic-ml (~3.5 MB)
//                            the page-corner model and its small runtime
//
// Folder and file names carry the version, so the cache-first service worker
// picks up a new version as a new file.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const vendor = join(process.cwd(), "public", "vendor");
const pkg = (name) => {
  // Straight from node_modules: scanic doesn't export ./package.json, and scanic-ml has no entry file.
  const dir = join(process.cwd(), "node_modules", name);
  return { dir, version: JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version };
};

// OpenCV.js
{
  const { dir, version } = pkg("@techstark/opencv-js");
  const out = join(vendor, `opencv-${version.split("-")[0]}.js`);
  if (!existsSync(out)) {
    mkdirSync(dirname(out), { recursive: true });
    copyFileSync(join(dir, "dist", "opencv.js"), out);
    console.log(`copied OpenCV.js → ${out}`);
  }
}

// scanic's neural detector loader and its bundled ONNX runtime JS, served from
// /vendor/scanic-<version>/. scanic loads them with a bundler-ignored import
// that only works when its dist files are served as they are.
{
  const { dir, version } = pkg("scanic");
  const outDir = join(vendor, `scanic-${version}`);
  mkdirSync(outDir, { recursive: true });
  for (const f of ["scanic-mlDetector.js", "scanic-ort.wasm.min.js"]) {
    const out = join(outDir, f);
    if (!existsSync(out)) {
      copyFileSync(join(dir, "dist", f), out);
      console.log(`copied scanic ${f} → ${out}`);
    }
  }
}

// scanic-ml: the model and its WebAssembly runtime, served from /vendor/scanic-ml-<version>/
{
  const { dir, version } = pkg("scanic-ml");
  const outDir = join(vendor, `scanic-ml-${version}`);
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(join(dir, "dist"))) {
    const out = join(outDir, f);
    if (!existsSync(out)) {
      copyFileSync(join(dir, "dist", f), out);
      console.log(`copied scanic-ml ${f} → ${out}`);
    }
  }
}
