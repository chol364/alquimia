import { useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";

type ZplItem = {
  id: string;
  name: string;
  zpl: string;
  kind: "text";
};

type RenderParams = {
  dpmm: number;
  widthIn: number;
  heightIn: number;
  rotation: 0 | 90 | 180 | 270;
  darkness?: number;
};

const defaultParams: RenderParams = {
  dpmm: 8,
  widthIn: 100, // 100mm
  heightIn: 150, // 150mm
  rotation: 0,
};

function apiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return (fromEnv ?? "").replace(/\/+$/, "");
}

async function renderPreview(zpl: string, params: RenderParams): Promise<Blob> {
  const base = apiBase();
  const res = await fetch(`${base}/api/render/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ zpl, index: 0, ...params }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Erro ao renderizar (${res.status})`);
  }
  return await res.blob();
}

async function downloadBatchZip(items: ZplItem[], params: RenderParams): Promise<Blob> {
  const base = apiBase();
  const fd = new FormData();
  fd.set("dpmm", String(params.dpmm));
  fd.set("widthIn", String(params.widthIn));
  fd.set("heightIn", String(params.heightIn));
  fd.set("rotation", String(params.rotation));
  if (typeof params.darkness === "number") fd.set("darkness", String(params.darkness));

  for (const it of items) {
    fd.append(
      "files",
      new Blob([it.zpl], { type: "text/plain" }),
      it.name.toLowerCase().endsWith(".zpl") || it.name.toLowerCase().endsWith(".txt")
        ? it.name
        : `${it.name}.zpl`,
    );
  }

  const res = await fetch(`${base}/api/batch/pdf`, { method: "POST", body: fd });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Erro ao gerar ZIP (${res.status})`);
  }
  return await res.blob();
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function App() {
  const [items, setItems] = useState<ZplItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  const [params, setParams] = useState<RenderParams>(defaultParams);
  const [isRendering, setIsRendering] = useState(false);
  const [isBatching, setIsBatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const [particlesReady, setParticlesReady] = useState(false);
  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setParticlesReady(true));
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: true,
    accept: {
      "text/plain": [".zpl", ".txt"],
    },
    onDrop: async (files) => {
      setError(null);
      const next: ZplItem[] = [];
      for (const f of files) {
        const text = await f.text();
        next.push({
          id: crypto.randomUUID(),
          name: f.name,
          zpl: text,
          kind: "text",
        });
      }
      setItems((prev) => {
        const merged = [...next, ...prev];
        if (!selectedId && merged.length) setSelectedId(merged[0]!.id);
        return merged;
      });
    },
  });

  async function doRender() {
    if (!selected) return;
    setError(null);
    setIsRendering(true);
    try {
      const blob = await renderPreview(selected.zpl, params);
      const url = URL.createObjectURL(blob);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } catch (e) {
      setPreviewUrl(null);
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setIsRendering(false);
    }
  }

  async function doBatchDownload() {
    if (!items.length) return;
    setError(null);
    setIsBatching(true);
    try {
      const blob = await downloadBatchZip(items, params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "labels.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setIsBatching(false);
    }
  }

  useEffect(() => {
    if (!selected) return;
    void doRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className={cn(
      "relative min-h-full transition-colors duration-300",
      isDarkMode ? "text-slate-100" : "text-slate-900"
    )}>
      {particlesReady ? (
        <Particles
          id="bg"
          options={{
            background: { color: { value: isDarkMode ? "#0b0618" : "#f8fafc" } },
            fullScreen: { enable: true, zIndex: 0 },
            fpsLimit: 60,
            interactivity: {
              events: {
                onHover: {
                  enable: true,
                  mode: "repulse",
                },
                resize: {
                  enable: true,
                },
              },
              modes: {
                repulse: {
                  distance: 160,
                  duration: 0.2,
                },
              },
            },
            particles: {
              number: { value: 70, density: { enable: true } },
              color: { value: isDarkMode ? ["#a855f7", "#c084fc", "#22c55e"] : ["#8b5cf6", "#a78bfa", "#10b981"] },
              links: {
                enable: true,
                distance: 140,
                opacity: isDarkMode ? 0.25 : 0.15,
                width: 1,
                color: isDarkMode ? "#7c3aed" : "#6d28d9",
              },
              move: { enable: true, speed: 1.2 },
              opacity: { value: isDarkMode ? 0.4 : 0.3 },
              size: { value: { min: 1, max: 3 } },
            },
            detectRetina: true,
          }}
        />
      ) : null}

      <div className={cn(
        "relative z-10 mx-auto flex min-h-full max-w-7xl flex-col px-4 py-6 transition-colors duration-300",
        isDarkMode 
          ? "text-slate-100 selection:bg-violet-400/30 selection:text-white"
          : "text-slate-900 selection:bg-violet-400/20 selection:text-slate-900"
      )}>
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <div className={cn(
              "text-xs font-semibold tracking-widest transition-colors duration-300",
              isDarkMode ? "text-violet-300" : "text-violet-600"
            )}>
              ALQUIMIA STUDIO
            </div>
            <div className={cn(
              "text-xl font-semibold transition-colors duration-300",
              isDarkMode ? "text-violet-100" : "text-violet-900"
            )}>
              Alquimia Studio
            </div>
            <div className={cn(
              "mt-1 text-xs transition-colors duration-300",
              isDarkMode ? "text-slate-300" : "text-slate-600"
            )}>
              Colar o ZPL no editor ou faça upload. O preview atualiza ao trocar o item.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={cn(
                "relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2 focus:ring-offset-black/20",
                isDarkMode ? "bg-violet-600" : "bg-amber-400",
              )}
              title={isDarkMode ? "Modo escuro" : "Modo claro"}
            >
              <span
                className={cn(
                  "inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300",
                  isDarkMode ? "translate-x-1" : "translate-x-7",
                )}
              >
                <span className="flex h-full w-full items-center justify-center">
                  {isDarkMode ? (
                    <svg className="h-4 w-4 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  )}
                </span>
              </span>
            </button>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors duration-300",
                isRendering
                  ? isDarkMode
                    ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-100"
                    : "border-cyan-600/40 bg-cyan-100/50 text-cyan-800"
                  : isDarkMode
                    ? "border-slate-400/20 bg-white/5 text-slate-200"
                    : "border-slate-300/40 bg-slate-100/50 text-slate-700"
              )}
            >
              {isRendering ? "Renderizando..." : isBatching ? "Gerando ZIP..." : "Pronto"}
            </span>
            <button
              onClick={() => void doRender()}
              disabled={!selected || isRendering || isBatching}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium transition-all duration-200",
                isDarkMode
                  ? "border-violet-400/30 bg-violet-500/15 hover:bg-violet-500/25 hover:shadow-violet-500/10"
                  : "border-violet-500/30 bg-violet-50 hover:bg-violet-100 hover:shadow-violet-200/20",
                "hover:-translate-y-0.5 hover:shadow-lg",
                "active:translate-y-0 active:scale-[0.99]",
                "focus-visible:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2",
                isDarkMode ? "focus:ring-offset-black/20" : "focus:ring-offset-white/20",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              Atualizar preview
            </button>
            <button
              onClick={() => void doBatchDownload()}
              disabled={!items.length || isRendering || isBatching}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium transition-all duration-200",
                isDarkMode
                  ? "border-white/10 bg-white/10 hover:bg-white/15 hover:shadow-violet-500/10"
                  : "border-slate-300/40 bg-slate-100/50 hover:bg-slate-200/50 hover:shadow-slate-200/20",
                "hover:-translate-y-0.5 hover:shadow-lg",
                "active:translate-y-0 active:scale-[0.99]",
                "focus-visible:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2",
                isDarkMode ? "focus:ring-offset-black/20" : "focus:ring-offset-white/20",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              title="Gera um ZIP com um PDF por item"
            >
              Baixar ZIP (PDFs)
            </button>
          </div>
        </header>

        <main className="grid flex-1 grid-cols-12 gap-4">
          <section className="col-span-12 lg:col-span-3">
            <div className={cn(
              "rounded-xl border p-3 backdrop-blur transition-all duration-200 hover:border-opacity-35",
              isDarkMode
                ? "border-violet-500/25 bg-violet-950/40 hover:border-violet-400/35"
                : "border-violet-200/40 bg-violet-50/50 hover:border-violet-300/50"
            )}>
              <div className={cn(
                "mb-2 text-sm font-semibold transition-colors duration-300",
                isDarkMode ? "text-slate-100" : "text-slate-900"
              )}>
                Upload
              </div>
              <div
                {...getRootProps()}
                className={cn(
                  "cursor-pointer rounded-lg border border-dashed px-3 py-4 transition-all duration-200",
                  isDarkMode
                    ? "border-white/15 bg-black/20 hover:bg-black/30 hover:shadow-violet-500/10"
                    : "border-slate-300/40 bg-slate-100/50 hover:bg-slate-200/50 hover:shadow-slate-200/20",
                  "hover:-translate-y-0.5 hover:shadow-lg",
                  isDragActive &&
                    (isDarkMode
                      ? "border-violet-300/60 bg-violet-400/10 shadow-lg shadow-violet-500/15"
                      : "border-violet-400/60 bg-violet-100/50 shadow-lg shadow-violet-300/20")
                )}>
                <input {...getInputProps()} />
                <div className={cn(
                  "text-sm transition-colors duration-300",
                  isDarkMode ? "text-slate-200" : "text-slate-700"
                )}>
                  Arraste e solte <span className="font-semibold">.zpl</span> ou{" "}
                  <span className="font-semibold">.txt</span> aqui
                </div>
                <div className={cn(
                  "mt-1 text-xs transition-colors duration-300",
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                )}>
                  Dica: você também pode começar digitando no editor — ele cria um item “Manual.zpl”.
                </div>
              </div>

              <div className="mt-4">
                <div className={cn(
                  "mb-2 text-sm font-semibold transition-colors duration-300",
                  isDarkMode ? "text-slate-100" : "text-slate-900"
                )}>
                  Itens ({items.length})
                </div>
                <div className={cn(
                  "max-h-[44vh] overflow-auto rounded-lg border transition-colors duration-200",
                  isDarkMode
                    ? "border-white/10 bg-black/10"
                    : "border-slate-300/40 bg-slate-100/30"
                )}>
                  {items.length ? (
                    <ul className={cn(
                      "divide-y transition-colors duration-200",
                      isDarkMode ? "divide-white/10" : "divide-slate-300/40"
                    )}>
                      {items.map((it) => (
                        <li key={it.id}>
                          <button
                            className={cn(
                              "group w-full px-3 py-2 text-left text-sm transition-colors duration-150",
                              it.id === selectedId
                                ? isDarkMode
                                  ? "bg-white/10"
                                  : "bg-slate-200/50"
                                : isDarkMode
                                  ? "hover:bg-white/5"
                                  : "hover:bg-slate-100/30",
                            )}
                            onClick={() => setSelectedId(it.id)}
                          >
                            <div className={cn(
                              "truncate font-medium transition-colors duration-300",
                              isDarkMode ? "text-slate-100" : "text-slate-900"
                            )}>
                              {it.name}
                            </div>
                            <div className={cn(
                              "truncate text-xs transition-colors duration-300",
                              isDarkMode ? "text-slate-400" : "text-slate-500"
                            )}>
                              {it.zpl.trim().slice(0, 60) || "(vazio)"}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className={cn(
                      "px-3 py-3 text-sm transition-colors duration-300",
                      isDarkMode ? "text-slate-400" : "text-slate-500"
                    )}>
                      Nenhum item ainda. Comece pelo upload ou cole um ZPL no editor.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className={cn(
                  "mb-2 text-sm font-semibold transition-colors duration-300",
                  isDarkMode ? "text-slate-100" : "text-slate-900"
                )}>
                  Parâmetros
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className={cn(
                    "text-xs transition-colors duration-300",
                    isDarkMode ? "text-slate-200" : "text-slate-700"
                  )}>
                    DPMM
                    <input
                      type="number"
                      value={params.dpmm}
                      min={6}
                      max={24}
                      onChange={(e) =>
                        setParams((p) => ({ ...p, dpmm: Number(e.target.value) }))
                      }
                      className={cn(
                        "mt-1 w-full rounded-md border px-2 py-1 text-sm outline-none transition-all",
                        isDarkMode
                          ? "border-white/10 bg-black/30 text-slate-100 focus:border-violet-300/60 focus:ring-violet-400/20"
                          : "border-slate-300/40 bg-white/70 text-slate-900 focus:border-violet-400/60 focus:ring-violet-300/20"
                      )}
                    />
                  </label>
                  <label className={cn(
                    "text-xs transition-colors duration-300",
                    isDarkMode ? "text-slate-300" : "text-slate-600"
                  )}>
                    Rotação
                    <select
                      value={params.rotation}
                      onChange={(e) =>
                        setParams((p) => ({
                          ...p,
                          rotation: Number(e.target.value) as RenderParams["rotation"],
                        }))
                      }
                      className={cn(
                        "mt-1 w-full rounded-md border px-2 py-1 text-sm outline-none transition-all",
                        isDarkMode
                          ? "border-white/10 bg-black/30 text-slate-100 focus:border-violet-300/60 focus:ring-violet-400/20"
                          : "border-slate-300/40 bg-white/70 text-slate-900 focus:border-violet-400/60 focus:ring-violet-300/20"
                      )}
                    >
                      <option value={0}>0</option>
                      <option value={90}>90</option>
                      <option value={180}>180</option>
                      <option value={270}>270</option>
                    </select>
                  </label>
                  <label className={cn(
                    "text-xs transition-colors duration-300",
                    isDarkMode ? "text-slate-300" : "text-slate-600"
                  )}>
                    Largura (mm)
                    <input
                      type="number"
                      value={params.widthIn}
                      step="0.1"
                      min={10}
                      max={200}
                      onChange={(e) =>
                        setParams((p) => ({
                          ...p,
                          widthIn: Number(e.target.value),
                        }))
                      }
                      className={cn(
                        "mt-1 w-full rounded-md border px-2 py-1 text-sm outline-none transition-all",
                        isDarkMode
                          ? "border-white/10 bg-black/30 text-slate-100 focus:border-violet-300/60 focus:ring-violet-400/20"
                          : "border-slate-300/40 bg-white/70 text-slate-900 focus:border-violet-400/60 focus:ring-violet-300/20"
                      )}
                    />
                  </label>
                  <label className={cn(
                    "text-xs transition-colors duration-300",
                    isDarkMode ? "text-slate-300" : "text-slate-600"
                  )}>
                    Altura (mm)
                    <input
                      type="number"
                      value={params.heightIn}
                      step="0.1"
                      min={10}
                      max={300}
                      onChange={(e) =>
                        setParams((p) => ({
                          ...p,
                          heightIn: Number(e.target.value),
                        }))
                      }
                      className={cn(
                        "mt-1 w-full rounded-md border px-2 py-1 text-sm outline-none transition-all",
                        isDarkMode
                          ? "border-white/10 bg-black/30 text-slate-100 focus:border-violet-300/60 focus:ring-violet-400/20"
                          : "border-slate-300/40 bg-white/70 text-slate-900 focus:border-violet-400/60 focus:ring-violet-300/20"
                      )}
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section className="col-span-12 lg:col-span-5">
            <div className={cn(
              "rounded-xl border p-3 backdrop-blur transition-all duration-200 hover:border-opacity-35",
              isDarkMode
                ? "border-violet-500/25 bg-violet-950/40 hover:border-violet-400/35"
                : "border-violet-200/40 bg-violet-50/50 hover:border-violet-300/50"
            )}>
              <div className="mb-2 flex items-center justify-between">
                <div className={cn(
                  "text-sm font-semibold transition-colors duration-300",
                  isDarkMode ? "text-slate-100" : "text-slate-900"
                )}>
                  ZPL (editor)
                </div>
                <div className={cn(
                  "text-xs transition-colors duration-300",
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                )}>
                  {selected ? selected.name : "Selecione um item"}
                </div>
              </div>
              <div className={cn(
                "mb-2 text-xs transition-colors duration-300",
                isDarkMode ? "text-slate-300" : "text-slate-600"
              )}>
                Cole um ZPL aqui. Se o ZPL tiver várias etiquetas, o download gera um PDF com várias páginas.
              </div>
              <textarea
                value={selected?.zpl ?? ""}
                onChange={(e) => {
                  const next = e.target.value;
                  setError(null);
                  if (!selectedId) {
                    const id = crypto.randomUUID();
                    const newItem: ZplItem = {
                      id,
                      name: "Manual.zpl",
                      zpl: next,
                      kind: "text",
                    };
                    setSelectedId(id);
                    setItems((prev) => [newItem, ...prev]);
                    return;
                  }
                  setItems((prev) =>
                    prev.map((it) => (it.id === selectedId ? { ...it, zpl: next } : it)),
                  );
                }}
                className={cn(
                  "h-[62vh] w-full resize-none rounded-lg border p-3 font-mono text-xs leading-5 outline-none transition-all",
                  isDarkMode
                    ? "border-white/10 bg-black/30 text-slate-100 focus:border-violet-300/60 focus:ring-violet-400/20"
                    : "border-slate-300/40 bg-white/70 text-slate-900 focus:border-violet-400/60 focus:ring-violet-300/20"
                )}
                placeholder="Cole seu ZPL aqui..."
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className={cn(
                  "text-xs transition-colors duration-300",
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                )}>
                  Dica: ao trocar o item, o preview atualiza automaticamente.
                </div>
                <button
                  onClick={() => void doRender()}
                  disabled={!selected || isRendering || isBatching}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition-all duration-200",
                    isDarkMode
                      ? "border-white/10 bg-white/10 hover:bg-white/15 hover:shadow-violet-500/10"
                      : "border-slate-300/40 bg-slate-100/50 hover:bg-slate-200/50 hover:shadow-slate-200/20",
                    "hover:-translate-y-0.5 hover:shadow-lg",
                    "active:translate-y-0 active:scale-[0.99]",
                    "focus-visible:outline-none focus:ring-2 focus:ring-violet-400/50 focus:ring-offset-2",
                    isDarkMode ? "focus:ring-offset-black/20" : "focus:ring-offset-white/20",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  Renderizar
                </button>
              </div>
              {error ? (
                <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}
            </div>
          </section>

          <section className="col-span-12 lg:col-span-4">
            <div className={cn(
              "rounded-xl border p-3 backdrop-blur transition-all duration-200 hover:border-opacity-35",
              isDarkMode
                ? "border-violet-500/25 bg-violet-950/40 hover:border-violet-400/35"
                : "border-violet-200/40 bg-violet-50/50 hover:border-violet-300/50"
            )}>
              <div className={cn(
                "mb-2 text-sm font-semibold transition-colors duration-300",
                isDarkMode ? "text-slate-100" : "text-slate-900"
              )}>
                Preview
              </div>
              <div
                className={cn(
                  "flex h-[70vh] items-center justify-center overflow-hidden rounded-lg border transition-colors duration-200",
                  isDarkMode
                    ? "bg-black/30"
                    : "bg-slate-100/50",
                  isRendering
                    ? isDarkMode
                      ? "border-violet-300/40"
                      : "border-violet-400/40"
                    : isDarkMode
                      ? "border-white/10 hover:border-violet-300/30"
                      : "border-slate-300/40 hover:border-violet-300/50",
                )}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview do label"
                    className={cn(
                      "max-h-full max-w-full object-contain",
                      "transition-transform duration-200",
                      "hover:scale-[1.01]",
                    )}
                  />
                ) : (
                  <div className={cn(
                    "px-6 text-center text-sm transition-colors duration-300",
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  )}>
                    {selected ? "Sem preview ainda." : "Faça upload e selecione um item."}
                  </div>
                )}
              </div>
              <div className={cn(
                "mt-2 text-xs transition-colors duration-300",
                isDarkMode ? "text-slate-400" : "text-slate-500"
              )}>
                Backend: <span className="font-mono">{apiBase()}</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
