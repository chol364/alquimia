import zplRenderer from "zpl-renderer-js";
import { PDFDocument } from "pdf-lib";
function inchesToMm(inches) {
    return inches * 25.4;
}
async function zplToPngBytes(input) {
    const mod = zplRenderer;
    const readyPromise = mod.ready ?? mod;
    const { api } = await readyPromise;
    const widthMm = inchesToMm(input.widthIn);
    const heightMm = inchesToMm(input.heightIn);
    const base64 = await api.zplToBase64Async(input.zpl, widthMm, heightMm, input.dpmm);
    return Buffer.from(base64, "base64");
}
async function zplToPngBytesMultiple(input) {
    const mod = zplRenderer;
    const readyPromise = mod.ready ?? mod;
    const { api } = await readyPromise;
    const widthMm = inchesToMm(input.widthIn);
    const heightMm = inchesToMm(input.heightIn);
    const base64Array = await api.zplToBase64MultipleAsync(input.zpl, widthMm, heightMm, input.dpmm);
    return base64Array.map((b64) => Buffer.from(b64, "base64"));
}
async function pngToPdfBytes(pngBytes) {
    const pdfDoc = await PDFDocument.create();
    for (const png of pngBytes) {
        const pngImage = await pdfDoc.embedPng(png);
        const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
        page.drawImage(pngImage, {
            x: 0,
            y: 0,
            width: pngImage.width,
            height: pngImage.height,
        });
    }
    const pdfBytes = await pdfDoc.save();
    return new Uint8Array(pdfBytes);
}
export async function renderLabel(input) {
    if (input.format === "png") {
        // Para preview, usamos apenas o primeiro label.
        const png = await zplToPngBytes(input);
        return png;
    }
    // Para PDF (lote), renderizamos TODAS as etiquetas do ZPL
    // em páginas separadas dentro de um único PDF.
    const allPngs = await zplToPngBytesMultiple(input);
    if (!allPngs.length) {
        throw new Error("Nenhuma etiqueta encontrada no ZPL");
    }
    return pngToPdfBytes(allPngs);
}
