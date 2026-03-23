import { parentPort } from "node:worker_threads";
import { renderLabel } from "../services/labelaryClient.js";
if (!parentPort) {
    throw new Error("renderWorker must run inside a worker thread.");
}
const port = parentPort;
port.on("message", async (message) => {
    try {
        const output = await renderLabel(message.input);
        const response = {
            taskId: message.taskId,
            ok: true,
            output,
        };
        port.postMessage(response);
    }
    catch (error) {
        const response = {
            taskId: message.taskId,
            ok: false,
            error: error instanceof Error ? error.message : "Erro desconhecido ao renderizar.",
        };
        port.postMessage(response);
    }
});
