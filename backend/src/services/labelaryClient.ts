import { PDFDocument } from "pdf-lib";
import pLimit from "p-limit";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// O renderer WASM do Go nao tolera concorrencia real.
const globalLimit = pLimit(1);

let cachedRenderer: any = null;

function resetRenderer(): void {
  cachedRenderer = null;
}

async function getRenderer(): Promise<any> {
  if (cachedRenderer) return cachedRenderer;

  const mod = require("zpl-renderer-js");
  cachedRenderer = mod.default ?? mod;
  return cachedRenderer;
}

export type LabelaryRenderFormat = "png" | "pdf";

export type RenderLabelInput = {
  format: LabelaryRenderFormat;
  zpl: string;
  dpmm: number;
  widthMm: number;
  heightMm: number;
  index: number;
  rotation: 0 | 90 | 180 | 270;
  darkness?: number;
};

function validateDimensions(input: RenderLabelInput): void {
  const maxWidthMm = 320;
  const maxHeightMm = 320;

  if (input.widthMm <= 0 || input.heightMm <= 0) {
    throw new Error("As dimensoes da etiqueta devem ser maiores que zero.");
  }

  if (input.widthMm > maxWidthMm || input.heightMm > maxHeightMm) {
    throw new Error(
      `Dimensoes muito grandes: ${input.widthMm}x${input.heightMm}mm. Maximo permitido: ${maxWidthMm}x${maxHeightMm}mm.`,
    );
  }
}

async function zplToPngBytes(input: RenderLabelInput): Promise<Uint8Array> {
  validateDimensions(input);

  const mod = await getRenderer();
  const readyPromise: Promise<{ api: any }> = mod.ready ?? mod;
  const { api } = await readyPromise;

  const base64 = await api.zplToBase64Async(input.zpl, input.widthMm, input.heightMm, input.dpmm);
  return Buffer.from(base64, "base64");
}

async function zplToPngBytesMultiple(input: RenderLabelInput): Promise<Uint8Array[]> {
  validateDimensions(input);

  const mod = await getRenderer();
  const readyPromise: Promise<{ api: any }> = mod.ready ?? mod;
  const { api } = await readyPromise;

  const base64Array: string[] = await api.zplToBase64MultipleAsync(
    input.zpl,
    input.widthMm,
    input.heightMm,
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
  const retryDelay = 1500;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await globalLimit(async () => {
        if (input.format === "png") {
          return await zplToPngBytes(input);
        }

        const allPngs = await zplToPngBytesMultiple(input);
        if (!allPngs.length) {
          throw new Error("Nenhuma etiqueta encontrada no ZPL.");
        }

        return await pngToPdfBytes(allPngs);
      });
    } catch (err: any) {
      const message = String(err?.message ?? "");
      const isRecoverableRendererCrash =
        message.includes("Go program has already exited") ||
        message.includes("reading 'exports'") ||
        message.includes("out of memory");

      if (isRecoverableRendererCrash) {
        resetRenderer();
      }

      if (isRecoverableRendererCrash && attempt < maxRetries) {
        console.warn(
          `[renderLabel] Renderizador falhou (tentativa ${attempt}/${maxRetries}). Aguardando ${retryDelay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      if (isRecoverableRendererCrash) {
        throw new Error(
          "O motor de renderizacao falhou apos varias tentativas. Revise as dimensoes da etiqueta e tente novamente.",
        );
      }

      throw err;
    }
  }

  throw new Error("Erro desconhecido ao renderizar.");
}
