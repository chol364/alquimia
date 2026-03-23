import os from "node:os";
import { Worker } from "node:worker_threads";
import type { RenderLabelInput } from "./labelaryClient.js";

type RenderPoolTask<TMeta> = {
  input: RenderLabelInput;
  meta: TMeta;
};

type RenderPoolResult<TMeta> = {
  output: Uint8Array;
  meta: TMeta;
};

type WorkerSuccessMessage = {
  taskId: number;
  ok: true;
  output: Uint8Array;
};

type WorkerErrorMessage = {
  taskId: number;
  ok: false;
  error: string;
};

type WorkerMessage = WorkerSuccessMessage | WorkerErrorMessage;

type PendingTask<TMeta> = {
  taskId: number;
  task: RenderPoolTask<TMeta>;
};

function resolveWorkerCount(requestedConcurrency: number, taskCount: number): number {
  const cpuCount = typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
  const safeCpuCount = Math.max(1, cpuCount - 1);
  return Math.max(1, Math.min(requestedConcurrency, taskCount, safeCpuCount, 6));
}

export async function renderBatchWithWorkers<TMeta>(
  tasks: Array<RenderPoolTask<TMeta>>,
  requestedConcurrency: number,
): Promise<Array<RenderPoolResult<TMeta>>> {
  if (!tasks.length) return [];

  const workerCount = resolveWorkerCount(requestedConcurrency, tasks.length);
  if (workerCount === 1) {
    const { renderLabel } = await import("./labelaryClient.js");
    return Promise.all(
      tasks.map(async (task) => ({
        meta: task.meta,
        output: await renderLabel(task.input),
      })),
    );
  }

  const workerUrl = new URL("../workers/renderWorker.js", import.meta.url);
  const workers = Array.from({ length: workerCount }, () => new Worker(workerUrl));
  const queue = tasks.map((task, index) => ({ taskId: index, task }));
  const results = new Array<RenderPoolResult<TMeta>>(tasks.length);
  const activeTasks = new Map<number, PendingTask<TMeta>>();

  return await new Promise<Array<RenderPoolResult<TMeta>>>((resolve, reject) => {
    let completed = 0;
    let settled = false;

    const cleanup = async () => {
      await Promise.allSettled(workers.map((worker) => worker.terminate()));
    };

    const fail = async (error: Error) => {
      if (settled) return;
      settled = true;
      await cleanup();
      reject(error);
    };

    const finishIfDone = async () => {
      if (settled || completed !== tasks.length) return;
      settled = true;
      await cleanup();
      resolve(results);
    };

    const dispatch = (worker: Worker) => {
      if (settled) return;
      const next = queue.shift();
      if (!next) {
        void finishIfDone();
        return;
      }

      activeTasks.set(next.taskId, next);
      worker.postMessage({
        taskId: next.taskId,
        input: next.task.input,
      });
    };

    for (const worker of workers) {
      worker.on("message", (message: WorkerMessage) => {
        const pending = activeTasks.get(message.taskId);
        activeTasks.delete(message.taskId);

        if (!pending) {
          void fail(new Error(`Resposta de render sem tarefa pendente: ${message.taskId}`));
          return;
        }

        if (!message.ok) {
          void fail(new Error(message.error));
          return;
        }

        results[message.taskId] = {
          meta: pending.task.meta,
          output: message.output,
        };
        completed += 1;
        dispatch(worker);
        void finishIfDone();
      });

      worker.on("error", (error) => {
        void fail(error);
      });

      worker.on("exit", (code) => {
        if (!settled && code !== 0) {
          void fail(new Error(`Worker de render finalizou com codigo ${code}.`));
        }
      });

      dispatch(worker);
    }
  });
}
