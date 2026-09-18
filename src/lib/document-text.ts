const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 120_000;

export async function extractDocumentText(file: File) {
  if (file.size > MAX_FILE_SIZE) throw new Error("O arquivo deve ter no máximo 10 MB.");

  const extension = file.name.split(".").pop()?.toLowerCase();
  let text = "";

  if (extension === "txt" || file.type === "text/plain") {
    text = await file.text();
  } else if (extension === "docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else if (extension === "pdf" || file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }
    text = pages.join("\n\n");
  } else {
    throw new Error("Formato não aceito. Envie um arquivo PDF, DOCX ou TXT.");
  }

  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length < 40) {
    throw new Error("Não foi possível extrair texto suficiente. O PDF pode ser apenas uma imagem.");
  }
  return normalized.slice(0, MAX_TEXT_LENGTH);
}