import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const ALLOWED_EXT = new Set([".pdf", ".doc", ".docx", ".odt", ".txt"]);
const MAX_BYTES = 5 * 1024 * 1024;

export function getCvUploadRoot(): string {
  const env = process.env.HOSPITALITY_CV_UPLOAD_DIR?.trim();
  if (env) return path.resolve(env);
  return path.resolve(process.cwd(), "data", "hospitality-cv");
}

export async function ensureCvUploadRoot(): Promise<string> {
  const root = getCvUploadRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}

export async function storeCvBuffer(
  filename: string,
  buf: Buffer
): Promise<{ storageKey: string }> {
  if (buf.length > MAX_BYTES) {
    throw new Error("CV file too large (max 5 MB)");
  }
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error("CV must be PDF, DOC, DOCX, ODT, or TXT");
  }
  const root = await ensureCvUploadRoot();
  const storageKey = `${randomUUID()}${ext}`;
  await fs.writeFile(path.join(root, storageKey), buf, { flag: "wx" });
  return { storageKey };
}

export async function readCvBuffer(storageKey: string): Promise<Buffer> {
  const safe = path.basename(storageKey);
  const full = path.join(getCvUploadRoot(), safe);
  return fs.readFile(full);
}
