import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Sharkbite";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  const botchFontData = await readFile(join(process.cwd(), "src/app/fonts/Botch.otf"));

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#ebe8de",
          color: "#242424",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          padding: 54,
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "#fbfaf6",
            border: "6px solid #242424",
            borderRadius: 38,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            justifyContent: "center",
            padding: "56px 72px",
            width: "100%",
          }}
        >
          <div
            style={{
              color: "#242424",
              display: "flex",
              fontFamily: "Botch",
              fontSize: 148,
              lineHeight: 0.9,
            }}
          >
            Sharkbite
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Botch",
              fontSize: 60,
              lineHeight: 1,
              marginTop: 34,
            }}
          >
            internet delay pedal
          </div>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: 24,
              marginTop: 42,
            }}
          >
            {[0, 1, 2].map((line) => (
              <div
                key={line}
                style={{
                  background: "#242424",
                  borderRadius: 999,
                  display: "flex",
                  height: 10,
                  opacity: line === 1 ? 1 : 0.72,
                  width: 116,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          data: botchFontData,
          name: "Botch",
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}
