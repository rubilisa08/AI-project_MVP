/** Splits raw text into paragraph-sized chunks (~maxLen chars) for citation-friendly processing. */
export function splitIntoChunks(text: string, maxLen = 700): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer.trim()) chunks.push(buffer.trim());
    buffer = "";
  };

  for (const para of paragraphs) {
    if (buffer && (buffer.length + para.length + 1) > maxLen) {
      flush();
    }
    buffer = buffer ? `${buffer}\n${para}` : para;
    while (buffer.length > maxLen) {
      chunks.push(buffer.slice(0, maxLen).trim());
      buffer = buffer.slice(maxLen);
    }
  }
  flush();
  return chunks;
}
