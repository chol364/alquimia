import { PDFDocument } from "pdf-lib";
import pLimit from "p-limit";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Trava global para o renderizador WASM.
// O renderizador Go-WASM é single-threaded e pode ter problemas com concorrência alta.
const globalLimit = pLimit(1);

let cachedRenderer: any = null;

async function getRenderer(): Promise<any> {
  if (cachedRenderer) return cachedRenderer;

  // Usando createRequire para carregar o módulo CommonJS de forma robusta
  // e evitar o erro "Cannot read properties of undefined (reading 'exports')"
  const mod = require("zpl-renderer-js");
  cachedRenderer = mod.default ?? mod;
  return cachedRenderer;
}

export type LabelaryRenderFormat = "png" | "pdf";

export type RenderLabelInput = {
  format: LabelaryRenderFormat;
  zpl: string;
  dpmm: number;
  widthIn: number;
  heightIn: number;
  index: number;
  rotation: 0 | 90 | 180 | 270;
  darkness?: number;
};

function inchesToMm(inches: number): number {
  return inches * 25.4;
}

async function zplToPngBytes(input: RenderLabelInput): Promise<Uint8Array> {
  const mod = await getRenderer();
  const readyPromise: Promise<{ api: any }> = mod.ready ?? mod;
  const { api } = await readyPromise;

  // A UI já envia os valores em milímetros (100x150), 
  // então NÃO devemos multiplicar por 25.4 novamente.
  const widthMm = input.widthIn;
  const heightMm = input.heightIn;

  const base64 = await api.zplToBase64Async(input.zpl, widthMm, heightMm, input.dpmm);
  return Buffer.from(base64, "base64");
}

async function zplToPngBytesMultiple(input: RenderLabelInput): Promise<Uint8Array[]> {
  const mod = await getRenderer();
  const readyPromise: Promise<{ api: any }> = mod.ready ?? mod;
  const { api } = await readyPromise;

  // A UI já envia os valores em milímetros (100x150), 
  // então NÃO devemos multiplicar por 25.4 novamente.
  const widthMm = input.widthIn;
  const heightMm = input.heightIn;

  const base64Array: string[] = await api.zplToBase64MultipleAsync(
    input.zpl,
    widthMm,
    heightMm,
    input.dpmm,
  );

  return base64Array.map((b64) => Buffer.from(b64, "base64"));
}

async function pngToPdfBytes(pngBytes: Uint8Array[]): Promise<Uint8Array> {
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

export async function renderLabel(input: RenderLabelInput): Promise<Uint8Array> {
  const maxRetries = 3;
  const retryDelay = 1500; // ms

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await globalLimit(async () => {
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
      });
    } catch (err: any) {
      const isGoExited = err.message?.includes("Go program has already exited");
      
      if (isGoExited && attempt < maxRetries) {
        console.warn(`[renderLabel] Renderizador falhou (tentativa ${attempt}/${maxRetries}). Aguardando ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      if (isGoExited) {
        throw new Error(
          "O motor de renderização falhou após várias tentativas. Por favor, tente novamente em alguns segundos (o servidor pode estar reiniciando o módulo WASM)."
        );
      }
      throw err;
    }
  }

  throw new Error("Erro desconhecido ao renderizar.");
}
