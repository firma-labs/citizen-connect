// Copies OpenCV.js from node_modules into public/vendor so the browser loads it
// from this site (and the service worker caches it for offline scanning)
// instead of bundling a ~11 MB file into the app's JavaScript.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("@techstark/opencv-js/package.json"));
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const out = join(process.cwd(), "public", "vendor", `opencv-${version.split("-")[0]}.js`);
if (!existsSync(out)) {
  mkdirSync(dirname(out), { recursive: true });
  copyFileSync(join(pkgDir, "dist", "opencv.js"), out);
  console.log(`copied OpenCV.js → ${out}`);
}
