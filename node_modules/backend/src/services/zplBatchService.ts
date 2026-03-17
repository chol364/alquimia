import AdmZip from "adm-zip";

export type UploadedZpl = {
  name: string;
  zpl: string;
};

function normalizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  return base.replace(/[^\w.\-() ]+/g, "_");
}

function isZplLike(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".zpl") || lower.endsWith(".txt");
}

export function extractZplsFromZip(zipBytes: Uint8Array): UploadedZpl[] {
  const zip = new AdmZip(Buffer.from(zipBytes));
  const entries = zip.getEntries();

  const out: UploadedZpl[] = [];
  for (const e of entries) {
    if (e.isDirectory) continue;
    const name = normalizeFilename(e.entryName);
    if (!isZplLike(name)) continue;
    const zpl = e.getData().toString("utf8");
    out.push({ name, zpl });
  }
  return out;
}

export function extractZplsFromTextFile(name: string, text: string): UploadedZpl[] {
  return [{ name: normalizeFilename(name), zpl: text }];
}

