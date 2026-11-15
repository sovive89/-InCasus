export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const fileTypes = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
} as const;
export const acceptedFiles = Object.keys(fileTypes)
  .map((ext) => `.${ext}`)
  .join(",");
export function fileMime(name: string): string | undefined {
  return fileTypes[name.toLowerCase().split(".").pop() as keyof typeof fileTypes];
}
export function validFileName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 180 &&
    !Array.from(name).some(
      (char) =>
        char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === "/" || char === "\\",
    ) &&
    !!fileMime(name)
  );
}
export function validateFileMetadata(file: { name: string; size: number }): string | null {
  if (!validFileName(file.name))
    return "Use PDF, imagem JPG/PNG/WEBP, TXT, DOCX ou áudio MP3/WAV/M4A, com nome de até 180 caracteres.";
  if (file.size < 1 || file.size > MAX_FILE_BYTES)
    return "O arquivo deve ter entre 1 byte e 10 MB.";
  return null;
}
export function fileFormatMatches(bytes: Uint8Array, mime: string): boolean {
  const at = (text: string, offset = 0) =>
    [...text].every((c, i) => bytes[offset + i] === c.charCodeAt(0));
  if (mime === "application/pdf") return at("%PDF-");
  if (mime === "image/png")
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  if (mime === "image/jpeg")
    return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/webp") return at("RIFF") && at("WEBP", 8);
  if (mime === "audio/wav") return at("RIFF") && at("WAVE", 8);
  if (mime === "audio/mpeg")
    return at("ID3") || (bytes[0] === 255 && ((bytes[1] ?? 0) & 0xe0) === 0xe0);
  if (mime === "audio/mp4") return at("ftyp", 4);
  if (mime === "text/plain") {
    try {
      return !new TextDecoder("utf-8", { fatal: true }).decode(bytes).includes("\0");
    } catch {
      return false;
    }
  }
  if (mime === fileTypes.docx) {
    const content = new TextDecoder("latin1").decode(bytes);
    return (
      at("PK\x03\x04") &&
      content.includes("[Content_Types].xml") &&
      content.includes("word/document.xml")
    );
  }
  return false;
}
export async function browserSha256(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
