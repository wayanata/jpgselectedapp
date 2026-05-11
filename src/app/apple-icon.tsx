import { ImageResponse } from "next/og";

/** Apple touch icon (iOS / “Add to Home Screen”). Matches `icon.svg` motif. */
export const runtime = "edge";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #292524 0%, #1c1917 100%)",
          borderRadius: 45,
        }}
      >
        <div
          style={{
            width: 87,
            height: 87,
            borderRadius: 16,
            border: "10px solid rgba(251, 191, 36, 0.95)",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              background: "#f59e0b",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
