import { ImageResponse } from "next/og";

export const alt = "Mozy — Buy there. Pay here.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "#F7F7F4",
          color: "#171816",
          display: "flex",
          flexDirection: "column",
          fontFamily: "sans-serif",
          height: "100%",
          justifyContent: "space-between",
          padding: "58px 64px",
          width: "100%",
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: 20 }}>
          <div style={{ alignItems: "center", display: "flex", position: "relative", width: 64 }}>
            <div style={{ background: "#171816", height: 2, width: 64 }} />
            <div style={{ background: "#D63B2F", height: 28, position: "absolute", right: 0, width: 2 }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>Mozy</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#858983", fontSize: 18, letterSpacing: 2 }}>
            ETHEREUM SEPOLIA → CREDITCOIN CC3
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 88, fontWeight: 600, letterSpacing: -5, lineHeight: 0.96, marginTop: 28 }}>
            <span>Buy there.</span>
            <span>Pay here.</span>
          </div>
        </div>
        <div style={{ alignItems: "center", display: "flex" }}>
          <div style={{ background: "#A9ADA5", height: 2, flex: 1 }} />
          <div style={{ background: "#D63B2F", height: 24, width: 2 }} />
        </div>
      </div>
    ),
    size,
  );
}
