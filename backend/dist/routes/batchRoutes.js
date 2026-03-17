import { z } from "zod";
import pLimit from "p-limit";
import AdmZip from "adm-zip";
import { renderLabel } from "../services/labelaryClient.js";
import { extractZplsFromTextFile, extractZplsFromZip } from "../services/zplBatchService.js";
export const batchRoutes = async (app) => {
    const paramsSchema = z.object({
        dpmm: z.coerce.number().int().min(6).max(24).default(8),
        widthIn: z.coerce.number().positive().default(4),
        heightIn: z.coerce.number().positive().default(6),
        rotation: z
            .coerce
            .number()
            .transform((n) => (n === 0 || n === 90 || n === 180 || n === 270 ? n : 0))
            .default(0),
        darkness: z.coerce.number().min(0).max(30).optional(),
        concurrency: z.coerce.number().int().min(1).max(6).default(3),
    });
    app.post("/api/batch/pdf", async (req, reply) => {
        const parts = req.parts();
        const fields = {};
        const files = [];
        for await (const part of parts) {
            if (part.type === "file") {
                const chunks = [];
                for await (const chunk of part.file)
                    chunks.push(chunk);
                files.push({
                    filename: part.filename ?? "file",
                    mimeType: part.mimetype,
                    bytes: new Uint8Array(Buffer.concat(chunks)),
                });
            }
            else {
                fields[part.fieldname] = String(part.value ?? "");
            }
        }
        if (!files.length) {
            reply.code(400);
            return { error: "Nenhum arquivo enviado. Envie .zpl/.txt ou .zip" };
        }
        const maxFiles = Number(process.env.MAX_FILES ?? 2000);
        const maxZplBytes = Number(process.env.MAX_ZPL_BYTES ?? 20_000_000);
        const params = paramsSchema.parse(fields);
        const zpls = [];
        for (const f of files) {
            const lower = f.filename.toLowerCase();
            if (lower.endsWith(".zip")) {
                zpls.push(...extractZplsFromZip(f.bytes));
            }
            else {
                if (f.bytes.byteLength > maxZplBytes) {
                    // Ainda respeitamos um limite de segurança, mas bem alto por padrão.
                    reply.code(413);
                    return { error: `Arquivo muito grande: ${f.filename}` };
                }
                zpls.push(...extractZplsFromTextFile(f.filename, Buffer.from(f.bytes).toString("utf8")));
            }
        }
        const filtered = zpls.filter((zpl) => zpl.zpl.trim().length > 0);
        if (!filtered.length) {
            reply.code(400);
            return { error: "Nenhum ZPL válido encontrado." };
        }
        if (filtered.length > maxFiles) {
            reply.code(400);
            return { error: `Muitos arquivos (${filtered.length}). Limite: ${maxFiles}` };
        }
        const limit = pLimit(params.concurrency);
        const results = await Promise.all(filtered.map((it, idx) => limit(async () => {
            const pdf = await renderLabel({
                format: "pdf",
                zpl: it.zpl,
                dpmm: params.dpmm,
                widthIn: params.widthIn,
                heightIn: params.heightIn,
                index: 0,
                rotation: params.rotation,
                darkness: params.darkness,
            });
            const safeBase = it.name.replace(/\.(zpl|txt)$/i, "");
            const outName = `${String(idx + 1).padStart(3, "0")}-${safeBase}.pdf`;
            return { outName, pdf };
        })));
        const zip = new AdmZip();
        for (const r of results)
            zip.addFile(r.outName, Buffer.from(r.pdf));
        const zipBuf = zip.toBuffer();
        reply.header("Content-Type", "application/zip");
        reply.header("Content-Disposition", "attachment; filename=\"labels.zip\"");
        return reply.send(zipBuf);
    });
};
