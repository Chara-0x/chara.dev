// import sharp from "sharp";
import { UnknownIconDark, UnknownIconLight } from "./badges.ts";

export const encodeBase64 = async (
  url: string,
  _size: number,
  theme: string = "dark"
): Promise<string> => {
  try {
    const res = await fetch(url, { cache: "force-cache" });

    if (!res.ok) {
      // Fallback: return the inline base64 from your unknown icons
      return theme === "dark" ? UnknownIconLight : UnknownIconDark;
    }

    const blob = await res.blob();

    // Prefer FileReader in browsers — returns data URL, we'll strip the prefix
    if (typeof window !== "undefined" && typeof FileReader !== "undefined") {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      // dataUrl looks like: "data:image/webp;base64,AAAA..."
      return dataUrl.split(",")[1] || "";
    }

    // Universal fallback (edge/workers): chunked btoa to avoid stack overflow
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000; // 32k chars per chunk
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    // Use btoa when available; otherwise, if we're in Node, fall back to Buffer
    if (typeof btoa === "function") {
      return btoa(binary);
    }
    // Node-only path (Buffer exists server-side)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Buffer } = await import("node:buffer");
    return Buffer.from(binary, "binary").toString("base64");
  } catch (e) {
    console.log(e);
    // On any failure, return the unknown icon so callers still get an image
    return theme === "dark" ? UnknownIconLight : UnknownIconDark;
  }
};
