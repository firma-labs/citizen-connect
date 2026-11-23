import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// App icons: the pastel gradient mark from the app bar with the Marathi
// lettermark ज (Janata Darbar), in Poppins Bold — the app's own typeface.
//
// - "180"      apple-touch-icon, used when the app is added to the iPhone home
//              screen (Safari or Chrome). Full square, no transparency: iOS
//              rounds the corners itself and turns transparent pixels black.
// - "maskable" Android adaptive icon: full square, mark kept inside the 80% safe zone.
// - "192", "512", "32" ("any"): rounded square, shown as drawn (Chrome, desktop, favicon).

export function generateStaticParams() {
  return [{ size: "32" }, { size: "180" }, { size: "192" }, { size: "512" }, { size: "maskable" }];
}

const PASTEL = [
  "radial-gradient(circle at 18% 16%, #ffd7c2 0%, rgba(255,215,194,0) 55%)",
  "radial-gradient(circle at 86% 20%, #d6ccfd 0%, rgba(214,204,253,0) 58%)",
  "radial-gradient(circle at 16% 88%, #b4d6fb 0%, rgba(180,214,251,0) 58%)",
  "radial-gradient(circle at 88% 86%, #a9e2c6 0%, rgba(169,226,198,0) 55%)",
  "radial-gradient(circle at 50% 50%, #f6c1e0 0%, rgba(246,193,224,0) 70%)",
].join(", ");

let font: Promise<Buffer> | null = null;
const poppinsBold = () =>
  (font ??= readFile(join(process.cwd(), "node_modules/@fontsource/poppins/files/poppins-devanagari-700-normal.woff")));

export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size: raw } = await ctx.params;
  const maskable = raw === "maskable";
  const apple = raw === "180";
  const size = maskable ? 512 : Math.min(512, Math.max(16, Number(raw) || 192));
  const fullBleed = maskable || apple;
  // Maskable icons may be cropped to a circle of 80% diameter, so the glyph is smaller.
  const glyph = size * (maskable ? 0.44 : 0.56);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f4f1ff",
          backgroundImage: PASTEL,
          borderRadius: fullBleed ? 0 : size * 0.225,
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "Poppins",
            fontWeight: 700,
            fontSize: glyph,
            lineHeight: 1,
            color: "#1c1f33",
            // Poppins' Devanagari sits low in its line box; nudge it to optical centre.
            marginTop: -glyph * 0.04,
          }}
        >
          ज
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: [{ name: "Poppins", data: await poppinsBold(), weight: 700, style: "normal" }],
    },
  );
}
