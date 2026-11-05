import type { Map as MlMap } from "maplibre-gl";
import { CATEGORY_META } from "./categories";
import { mapCaption, wrapText, type MapCaptionInput, type MapCaptionLanguage } from "./map-citation";
import { jpegToPdf } from "./pdf";
import { CATEGORIES, type Category } from "./types";

/**
 * Copies the map's current frame. The WebGL buffer is only valid right after a
 * render, so the copy happens inside the render event instead of paying for
 * preserveDrawingBuffer on every frame.
 */
function captureMap(map: MlMap): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const grab = () => {
      map.once("render", () => {
        const source = map.getCanvas();
        const copy = document.createElement("canvas");
        copy.width = source.width;
        copy.height = source.height;
        const ctx = copy.getContext("2d");
        if (!ctx) {
          reject(new Error("no 2d context"));
          return;
        }
        ctx.drawImage(source, 0, 0);
        resolve(copy);
      });
      map.triggerRepaint();
    };
    if (map.loaded()) grab();
    else map.once("idle", grab);
  });
}

type Labels = Record<Category, string>;

/** Stacks the map frames above a white footer with legend, boundary note and citation. */
export async function composeMapImage(maps: MlMap[], caption: MapCaptionInput, lang: MapCaptionLanguage, labels: Labels): Promise<HTMLCanvasElement> {
  const frames = await Promise.all(maps.map(captureMap));
  const gap = frames.length > 1 ? 4 : 0;
  const width = Math.max(1000, frames.reduce((w, f) => w + f.width, 0) + gap * (frames.length - 1));
  const mapHeight = Math.max(...frames.map((f) => f.height));
  const scale = width / 1000;
  const margin = 24 * scale;
  const bodyFont = `${15 * scale}px ${getComputedStyle(document.body).fontFamily}`;
  const titleFont = `600 ${22 * scale}px ${getComputedStyle(document.body).fontFamily}`;
  const lineHeight = 21 * scale;
  const { title, lines } = mapCaption(caption, lang);

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("no 2d context");
  measure.font = bodyFont;
  const wrapped = lines.flatMap((l) => wrapText(l, width - margin * 2, (s) => measure.measureText(s).width));
  const legendHeight = 28 * scale;
  const footer = margin + 28 * scale + legendHeight + wrapped.length * lineHeight + margin;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(mapHeight + footer);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let x = (width - frames.reduce((w, f) => w + f.width, 0) - gap * (frames.length - 1)) / 2;
  for (const frame of frames) {
    ctx.drawImage(frame, x, 0);
    x += frame.width + gap;
  }

  let y = mapHeight + margin;
  ctx.fillStyle = "#2c2416";
  ctx.textBaseline = "top";
  ctx.font = titleFont;
  ctx.fillText(title, margin, y);
  y += 32 * scale;

  ctx.font = bodyFont;
  let legendX = margin;
  for (const category of CATEGORIES) {
    if (category === "diger") continue;
    ctx.fillStyle = CATEGORY_META[category].color;
    ctx.beginPath();
    ctx.arc(legendX + 6 * scale, y + 9 * scale, 6 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2c2416";
    ctx.fillText(labels[category], legendX + 16 * scale, y);
    legendX += 16 * scale + ctx.measureText(labels[category]).width + 18 * scale;
  }
  y += legendHeight;

  ctx.fillStyle = "#40361f";
  for (const line of wrapped) {
    ctx.fillText(line, margin, y);
    y += lineHeight;
  }
  return canvas;
}

export const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("export failed"))), type, quality);
  });

export async function canvasToPdf(canvas: HTMLCanvasElement): Promise<Blob> {
  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.92);
  const pdf = jpegToPdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height);
  return new Blob([pdf.slice().buffer as ArrayBuffer], { type: "application/pdf" });
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
