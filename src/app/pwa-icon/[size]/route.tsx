import { ImageResponse } from "next/og";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "maskable" }, { size: "180" }];
}

export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size: raw } = await ctx.params;
  const maskable = raw === "maskable";
  const size = maskable ? 512 : Math.min(512, Math.max(48, Number(raw) || 192));
  const inset = maskable ? size * 0.2 : size * 0.12;
  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2f3b9c",
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <div
          style={{
            width: size - inset * 2,
            height: size - inset * 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            borderRadius: size * 0.08,
            color: "#2f3b9c",
          }}
        >
          <div style={{ fontSize: size * 0.3, fontWeight: 800, lineHeight: 1 }}>JD</div>
          <div style={{ width: "50%", height: size * 0.035, background: "#2f3b9c", marginTop: size * 0.05, borderRadius: 99 }} />
          <div style={{ width: "36%", height: size * 0.035, background: "#9aa3e0", marginTop: size * 0.03, borderRadius: 99 }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
