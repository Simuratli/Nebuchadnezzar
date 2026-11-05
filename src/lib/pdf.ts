/**
 * Wraps one JPEG in a single-page PDF sized to the image. The JPEG is embedded
 * as-is (DCTDecode), so no PDF library is needed. Text in the image, including
 * Turkish letters, stays exact but is not selectable.
 */
export function jpegToPdf(jpeg: Uint8Array, widthPx: number, heightPx: number): Uint8Array {
  // A4 landscape width in points keeps the page a sensible physical size.
  const pageWidth = 842;
  const pageHeight = (pageWidth * heightPx) / widthPx;
  const size = `${pageWidth} ${pageHeight.toFixed(2)}`;
  const content = `q ${pageWidth} 0 0 ${pageHeight.toFixed(2)} 0 0 cm /Im0 Do Q`;

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (body: string | (string | Uint8Array)[]) => {
    offsets.push(length);
    push(`${offsets.length} 0 obj\n`);
    for (const part of Array.isArray(body) ? body : [body]) push(part);
    push("\nendobj\n");
  };

  push("%PDF-1.4\n");
  object("<< /Type /Catalog /Pages 2 0 R >>");
  object("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${size}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>`);
  object(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);
  object([
    `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    "\nendstream",
  ]);

  const xrefAt = length;
  const rows = offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  push(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n${rows}`);
  push(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
