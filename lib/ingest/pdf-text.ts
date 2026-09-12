import pdf from "pdf-parse";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parsed = await pdf(buffer);
  return parsed.text ?? "";
}
