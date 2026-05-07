// Client-side only — uses the FileReader API.

export interface PackResult {
  /** Structured text block from text/code files. Empty string if none. */
  textBlock: string;
  /** Base64 image attachments, capped at MAX_IMAGES. */
  attachments: { data: string; mimeType: string; name: string }[];
  warnings: string[];
}

const TEXT_EXTS = new Set([
  ".txt", ".md", ".csv", ".json", ".js", ".ts", ".jsx", ".tsx",
  ".py", ".rs", ".go", ".java", ".rb", ".php", ".c", ".cpp", ".h",
  ".sh", ".bash", ".zsh", ".yaml", ".yml", ".toml", ".xml", ".sql",
  ".css", ".html", ".htm", ".env", ".ini", ".cfg", ".conf",
]);

const MAX_IMAGES = 5;
const WARN_BYTES = 4.5 * 1024 * 1024;

export function isTextFile(f: File): boolean {
  if (f.type.startsWith("text/") || f.type === "application/json") return true;
  const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
  return TEXT_EXTS.has(ext);
}

const readText = (f: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res((e.target?.result as string) ?? "");
    r.onerror = rej;
    r.readAsText(f);
  });

const readBase64 = (f: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => {
      const url = (e.target?.result as string) ?? "";
      res(url.split(",")[1] ?? "");
    };
    r.onerror = rej;
    r.readAsDataURL(f);
  });

/**
 * Categorises and reads a list of files:
 * - Text/code files → packed into a structured textBlock with file headers.
 * - Images → base64-encoded (max MAX_IMAGES; excess produces a warning).
 * - Other binary types (PDF, etc.) → silently skipped.
 *
 * Returns a warning if payload exceeds WARN_BYTES (~4.5 MB).
 */
export async function packFiles(files: File[]): Promise<PackResult> {
  const warnings: string[] = [];
  const textFiles = files.filter(isTextFile);
  const imageFiles = files.filter((f) => f.type.startsWith("image/"));

  let imgs = imageFiles;
  if (imageFiles.length > MAX_IMAGES) {
    imgs = imageFiles.slice(0, MAX_IMAGES);
    warnings.push(
      `Only the first ${MAX_IMAGES} images included (${imageFiles.length} selected).`
    );
  }

  const textParts = await Promise.all(
    textFiles.map(async (f) => `\n--- File: ${f.name} ---\n${await readText(f)}`)
  );
  const textBlock = textParts.join("\n");

  const attachments = await Promise.all(
    imgs.map(async (f) => ({
      data: await readBase64(f),
      mimeType: f.type,
      name: f.name,
    }))
  );

  // Rough payload size estimate: base64 encodes at ~133%, text uses ~2 bytes/char (UTF-16)
  const roughBytes =
    attachments.reduce((s, a) => s + a.data.length * 0.75, 0) + textBlock.length * 2;
  if (roughBytes > WARN_BYTES) {
    warnings.push(
      `Payload is ~${(roughBytes / 1e6).toFixed(1)} MB — some providers cap requests at 4–5 MB.`
    );
  }

  return { textBlock, attachments, warnings };
}
