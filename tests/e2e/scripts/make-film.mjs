// Generates a 12-second silent WebM test film (three "chapters" with a moving marker and big timecode) using
// a real browser's MediaRecorder, so the docs need no third-party media. Run: node tests/e2e/scripts/make-film.mjs
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch();
const page = await browser.newPage();
const b64 = await page.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 640; c.height = 360;
  const ctx = c.getContext("2d");
  const stream = c.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 1_200_000 });
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((r) => (rec.onstop = r));
  rec.start(100);
  const t0 = performance.now();
  const DUR = 12000;
  await new Promise((resolve) => {
    const frame = () => {
      const t = (performance.now() - t0) / 1000;
      const ch = t < 4 ? 0 : t < 8 ? 1 : 2;
      ctx.fillStyle = ["#1d2a6b", "#1f7a4f", "#ff4d1c"][ch];
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(0, 300, (t / 12) * 640, 60);
      ctx.fillStyle = "#faf9f6";
      ctx.beginPath(); ctx.arc(40 + (t / 12) * 560, 120 + Math.sin(t * 2) * 50, 28, 0, Math.PI * 2); ctx.fill();
      ctx.font = "bold 72px monospace"; ctx.fillText(t.toFixed(1) + "s", 220, 250);
      ctx.font = "28px sans-serif"; ctx.fillText(["Unboxing", "Assembly", "Finish"][ch], 40, 50);
      if (t < 12) requestAnimationFrame(frame); else resolve();
    };
    frame();
  });
  rec.stop();
  await done;
  const blob = new Blob(chunks, { type: "video/webm" });
  const buf = await blob.arrayBuffer();
  let s = ""; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
});
writeFileSync(new URL("../../../apps/docs/public/media/film.webm", import.meta.url), Buffer.from(b64, "base64"));
await browser.close();
console.log("wrote film.webm", Buffer.from(b64, "base64").length, "bytes");
// MediaRecorder output has no duration header (Infinity in <video>), so remux with Playwright's bundled ffmpeg:
//   FF=$(ls ~/Library/Caches/ms-playwright/ffmpeg-*/ffmpeg-mac | head -1)
//   $FF -y -i film.webm -c:v libvpx-vp9 -b:v 900k -g 15 -pix_fmt yuv420p -an -r 30 -t 12 film-fixed.webm && mv film-fixed.webm film.webm
// (-g 15: a keyframe every half second keeps scroll seeks responsive; this is the fixture's encoding, not a general recommendation)
