import AdmZip from "adm-zip";
function normalizeFilename(name) {
    const base = name.split(/[/\\]/).pop() ?? "file";
    return base.replace(/[^\w.\-() ]+/g, "_");
}
function isZplLike(name) {
    const lower = name.toLowerCase();
    return lower.endsWith(".zpl") || lower.endsWith(".txt");
}
export function extractZplsFromZip(zipBytes) {
    const zip = new AdmZip(Buffer.from(zipBytes));
    const entries = zip.getEntries();
    const out = [];
    for (const e of entries) {
        if (e.isDirectory)
            continue;
        const name = normalizeFilename(e.entryName);
        if (!isZplLike(name))
            continue;
        const zpl = e.getData().toString("utf8");
        out.push({ name, zpl });
    }
    return out;
}
export function extractZplsFromTextFile(name, text) {
    return [{ name: normalizeFilename(name), zpl: text }];
}
