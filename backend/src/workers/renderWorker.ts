import { parentPort } from "node:worker_threads";
import { renderLabel, type RenderLabelInput } from "../services/labelaryClient.js";

type RenderWorkerRequest = {
  taskId: number;
  input: RenderLabelInput;
};

type RenderWorkerResponse =
  | {
      taskId: number;
      ok: true;
      output: Uint8Array;
    }
  | {
      taskId: number;
      ok: false;
      error: string;
    };

if (!parentPort) {
  throw new Error("renderWorker must run inside a worker thread.");
}

const port = parentPort;

port.on("message", async (message: RenderWorkerRequest) => {
  try {
    const output = await renderLabel(message.input);
    const response: RenderWorkerResponse = {
      taskId: message.taskId,
      ok: true,
      output,
    };
    port.postMessage(response);
  } catch (error) {
    const response: RenderWorkerResponse = {
      taskId: message.taskId,
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao renderizar.",
    };
    port.postMessage(response);
  }
});
