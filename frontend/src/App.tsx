import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type ModuleId = "home" | "studio" | "operations";

type ZplItem = {
  id: string;
  name: string;
  zpl: string;
};

type RenderParams = {
  dpmm: number;
  widthMm: number;
  heightMm: number;
  rotation: 0 | 90 | 180 | 270;
};

const modules = [
  {
    id: "home" as const,
    label: "Home",
    eyebrow: "Entrada",
    description: "Visao geral, destaque visual e acesso rapido aos modulos.",
  },
  {
    id: "studio" as const,
    label: "Studio ZPL",
    eyebrow: "Edicao",
    description: "Area de upload, edicao e preparo do conteudo ZPL.",
  },
  {
    id: "operations" as const,
    label: "Operacoes",
    eyebrow: "Gestao",
    description: "Resumo do lote e atalhos para exportacao e conferencia.",
  },
];

const defaultParams: RenderParams = {
  dpmm: 8,
  widthMm: 100,
  heightMm: 150,
  rotation: 0,
};

const rotationOptions: Array<{ value: RenderParams["rotation"]; label: string; description: string }> = [
  { value: 0, label: "0°", description: "Padrao" },
  { value: 90, label: "90°", description: "Horizontal" },
  { value: 180, label: "180°", description: "Invertida" },
  { value: 270, label: "270°", description: "Lateral" },
];

function apiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return (fromEnv ?? "").replace(/\/+$/, "");
}

async function renderPreview(zpl: string, params: RenderParams): Promise<Blob> {
  const base = apiBase();
  const response = await fetch(`${base}/api/render/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ zpl, index: 0, ...params }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Erro ao renderizar (${response.status})`);
  }

  return response.blob();
}

async function downloadBatchZip(items: ZplItem[], params: RenderParams): Promise<Blob> {
  const base = apiBase();
  const formData = new FormData();

  formData.set("dpmm", String(params.dpmm));
  formData.set("widthMm", String(params.widthMm));
  formData.set("heightMm", String(params.heightMm));
  formData.set("rotation", String(params.rotation));

  for (const item of items) {
    formData.append(
      "files",
      new Blob([item.zpl], { type: "text/plain" }),
      item.name.toLowerCase().endsWith(".zpl") || item.name.toLowerCase().endsWith(".txt")
        ? item.name
        : `${item.name}.zpl`,
    );
  }

  const response = await fetch(`${base}/api/batch/pdf`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Erro ao gerar ZIP (${response.status})`);
  }

  return response.blob();
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ParticleField({ isDarkMode }: { isDarkMode: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const mouse = { x: -9999, y: -9999, radius: 140 };
    const particles = Array.from({ length: 80 }, () => ({
      x: 0,
      y: 0,
      vx: (Math.random() - 0.5) * 0.55,
      vy: (Math.random() - 0.5) * 0.55,
      size: Math.random() * 2.2 + 0.8,
    }));

    let width = 0;
    let height = 0;
    let animationFrame = 0;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * window.devicePixelRatio);
      canvas.height = Math.floor(height * window.devicePixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

      for (const particle of particles) {
        if (particle.x === 0 && particle.y === 0) {
          particle.x = Math.random() * width;
          particle.y = Math.random() * height;
        }
      }
    }

    function handlePointerMove(event: PointerEvent) {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    }

    function handlePointerLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }

    function draw() {
      context.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        const dx = mouse.x - particle.x;
        const dy = mouse.y - particle.y;
        const distance = Math.hypot(dx, dy);

        if (distance < mouse.radius) {
          const force = (mouse.radius - distance) / mouse.radius;
          const angle = Math.atan2(dy, dx);
          particle.vx -= Math.cos(angle) * force * 0.08;
          particle.vy -= Math.sin(angle) * force * 0.08;
        }

        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.992;
        particle.vy *= 0.992;

        if (particle.x < -30) particle.x = width + 30;
        if (particle.x > width + 30) particle.x = -30;
        if (particle.y < -30) particle.y = height + 30;
        if (particle.y > height + 30) particle.y = -30;

        context.beginPath();
        context.fillStyle = isDarkMode ? "rgba(103, 232, 249, 0.7)" : "rgba(8, 145, 178, 0.85)";
        context.shadowBlur = isDarkMode ? 16 : 18;
        context.shadowColor = isDarkMode ? "rgba(34, 211, 238, 0.35)" : "rgba(8, 145, 178, 0.3)";
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }

      context.shadowBlur = 0;

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);

          if (distance < 120) {
            context.beginPath();
            context.strokeStyle = isDarkMode
              ? `rgba(56, 189, 248, ${0.14 - distance / 1000})`
              : `rgba(14, 116, 144, ${0.24 - distance / 700})`;
            context.lineWidth = 1;
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }
      }

      animationFrame = window.requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [isDarkMode]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none fixed inset-0 z-0", isDarkMode ? "opacity-80" : "opacity-95")}
      aria-hidden="true"
    />
  );
}

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>("home");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [items, setItems] = useState<ZplItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [params, setParams] = useState<RenderParams>(defaultParams);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isBatching, setIsBatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [isRotationMenuOpen, setIsRotationMenuOpen] = useState(false);
  const rotationMenuRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rotationMenuRef.current?.contains(event.target as Node)) {
        setIsRotationMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsRotationMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    const nextItems: ZplItem[] = [];

    for (const file of files) {
      const text = await file.text();
      nextItems.push({
        id: makeId(),
        name: file.name,
        zpl: text,
      });
    }

    setItems((current) => {
      const merged = [...nextItems, ...current];
      if (!selectedId && merged.length > 0) {
        setSelectedId(merged[0].id);
      }
      return merged;
    });
    setActiveModule("studio");
    event.target.value = "";
  }

  async function handleRender() {
    if (!selected?.zpl.trim()) return;

    setError(null);
    setIsRendering(true);

    try {
      const blob = await renderPreview(selected.zpl, params);
      const url = URL.createObjectURL(blob);

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }

      previewUrlRef.current = url;
      setPreviewUrl(url);
    } catch (err) {
      setPreviewUrl(null);
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setIsRendering(false);
    }
  }

  async function handleDownloadZip() {
    if (!items.length) return;

    setError(null);
    setIsBatching(true);

    try {
      const blob = await downloadBatchZip(items, params);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "labels.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setIsBatching(false);
    }
  }

  const completedItems = items.filter((item) => item.zpl.trim()).length;
  const totalCharacters = items.reduce((total, item) => total + item.zpl.length, 0);
  const currentRotation =
    rotationOptions.find((option) => option.value === params.rotation) ?? rotationOptions[0];

  function renderHome() {
    return (
      <main className="flex flex-1 flex-col gap-6">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className={cn(
            "animate-panel-in rounded-[2rem] border p-8 backdrop-blur-xl",
            isDarkMode
              ? "border-white/10 bg-white/5"
              : "border-white/70 bg-white/75 shadow-[0_30px_90px_-50px_rgba(14,165,233,0.28)]",
          )}>
            <div className={cn(
              "inline-flex rounded-full border px-4 py-2 text-xs uppercase tracking-[0.28em]",
              isDarkMode
                ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                : "border-cyan-300/60 bg-cyan-100/90 text-cyan-900",
            )}>
              Plataforma de etiquetas
            </div>
            <h1 className={cn(
              "mt-6 max-w-4xl text-4xl font-semibold leading-tight md:text-6xl",
              isDarkMode ? "text-white" : "text-slate-950",
            )}>
              Alquimia studio foi criado para facilitar a conversão das suas etiquetas do ecommerce.
            </h1>
            <p className={cn(
              "mt-5 max-w-2xl text-base leading-7 md:text-lg",
              isDarkMode ? "text-slate-300" : "text-slate-700",
            )}>
              A entrada agora funciona como dashboard do sistema: apresenta o produto, destaca o
              lote atual e leva o usuario direto para edicao ou operacao.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setActiveModule("studio")}
                className={cn(
                  "rounded-full px-6 py-3 text-sm font-semibold transition hover:-translate-y-0.5",
                  isDarkMode
                    ? "bg-cyan-400 text-slate-950"
                    : "bg-slate-950 text-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.35)]",
                )}
              >
                Abrir studio
              </button>
              <button
                type="button"
                onClick={() => setActiveModule("operations")}
                className={cn(
                  "rounded-full border px-6 py-3 text-sm font-semibold transition hover:-translate-y-0.5",
                  isDarkMode
                    ? "border-white/15 bg-white/5 text-white hover:bg-white/10"
                    : "border-slate-300/60 bg-white text-slate-800 hover:bg-slate-50",
                )}
              >
                Ir para operacoes
              </button>
            </div>
          </div>

          <div className={cn(
            "animate-panel-in animate-panel-delay-1 rounded-[2rem] border p-8 backdrop-blur-xl",
            isDarkMode
              ? "border-cyan-400/20 bg-slate-950/70"
              : "border-cyan-200/70 bg-white/75 shadow-[0_30px_90px_-50px_rgba(34,211,238,0.3)]",
          )}>
            <div className={cn(
              "home-hero-card relative overflow-hidden rounded-[1.5rem] border p-6",
              isDarkMode
                ? "border-white/10 bg-[linear-gradient(135deg,rgba(8,145,178,0.18),rgba(15,23,42,0.75))]"
                : "border-white/70 bg-[linear-gradient(135deg,rgba(103,232,249,0.34),rgba(255,255,255,0.9))]",
            )}>
              <div className="home-orbit home-orbit-a" />
              <div className="home-orbit home-orbit-b" />
              <div className="home-grid" />
              <div className="relative">
                <div className={cn(
                  "text-xs uppercase tracking-[0.3em]",
                  isDarkMode ? "text-cyan-100" : "text-cyan-800",
                )}>Status atual</div>
                <div className="mt-6 grid gap-4">
                  {[
                    { label: "Arquivos", value: String(items.length), note: `${completedItems} prontos` },
                    { label: "Caracteres ZPL", value: String(totalCharacters), note: "no lote atual" },
                    {
                      label: "Formato",
                      value: `${params.widthMm} x ${params.heightMm} mm`,
                      note: `${params.dpmm} dpmm · ${params.rotation}°`,
                    },
                  ].map((card) => (
                    <div
                      key={card.label}
                      className={cn(
                        "rounded-2xl border p-4",
                        isDarkMode
                          ? "border-white/10 bg-white/5"
                          : "border-white/80 bg-white/70",
                      )}
                    >
                      <div className={cn("text-xs uppercase tracking-[0.25em]", isDarkMode ? "text-slate-400" : "text-slate-500")}>{card.label}</div>
                      <div className={cn("mt-2 text-2xl font-semibold", isDarkMode ? "text-white" : "text-slate-950")}>{card.value}</div>
                      <div className={cn("mt-1 text-sm", isDarkMode ? "text-slate-300" : "text-slate-600")}>{card.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {modules.map((module, index) => (
            <button
              key={module.id}
              type="button"
              onClick={() => setActiveModule(module.id)}
              className={cn(
                "animate-panel-in rounded-[1.5rem] border p-6 text-left transition hover:-translate-y-1",
                isDarkMode
                  ? "border-white/10 bg-white/5 hover:bg-white/10"
                  : "border-slate-200/90 bg-white/92 hover:bg-white shadow-[0_24px_80px_-44px_rgba(8,145,178,0.34)]",
              )}
              style={{ animationDelay: `${120 + index * 80}ms` }}
            >
              <div className={cn("text-xs uppercase tracking-[0.28em]", isDarkMode ? "text-cyan-200" : "text-cyan-800")}>{module.eyebrow}</div>
              <div className={cn("mt-4 text-2xl font-semibold", isDarkMode ? "text-white" : "text-slate-950")}>{module.label}</div>
              <p className={cn("mt-3 text-sm leading-6", isDarkMode ? "text-slate-300" : "text-slate-700")}>{module.description}</p>
              <div className={cn("mt-6 text-sm font-medium", isDarkMode ? "text-cyan-100" : "text-cyan-900")}>Entrar no modulo →</div>
            </button>
          ))}
        </section>
      </main>
    );
  }

  function renderStudio() {
    return (
      <main className="grid flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
        <section className={cn(
          "animate-panel-in rounded-[1.5rem] border p-5 backdrop-blur-xl",
          isDarkMode
            ? "border-white/10 bg-white/5"
            : "border-white/70 bg-white/82 shadow-[0_20px_60px_-40px_rgba(14,165,233,0.22)]",
        )}>
          <div className={cn("text-sm font-semibold", isDarkMode ? "text-white" : "text-slate-950")}>Arquivos e parametros</div>
          <label className={cn(
            "mt-4 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed px-4 py-6 text-center text-sm transition",
            isDarkMode
              ? "border-cyan-400/35 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15"
              : "border-cyan-300/70 bg-cyan-50 text-cyan-900 hover:bg-cyan-100",
          )}>
            Selecionar arquivos .zpl ou .txt
            <input type="file" multiple accept=".zpl,.txt,.text/plain" onChange={handleFileUpload} className="hidden" />
          </label>

          <div className="mt-5 space-y-3">
            <label className={cn("block text-xs", isDarkMode ? "text-slate-300" : "text-slate-700")}>
              DPMM
              <input
                type="number"
                value={params.dpmm}
                onChange={(event) => setParams((current) => ({ ...current, dpmm: Number(event.target.value) }))}
                className={cn(
                  "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                  isDarkMode
                    ? "border-white/10 bg-black/20 text-white"
                    : "border-slate-200 bg-white text-slate-900",
                )}
              />
            </label>
            <label className={cn("block text-xs", isDarkMode ? "text-slate-300" : "text-slate-700")}>
              Largura (mm)
              <input
                type="number"
                value={params.widthMm}
                onChange={(event) => setParams((current) => ({ ...current, widthMm: Number(event.target.value) }))}
                className={cn(
                  "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                  isDarkMode
                    ? "border-white/10 bg-black/20 text-white"
                    : "border-slate-200 bg-white text-slate-900",
                )}
              />
            </label>
            <label className={cn("block text-xs", isDarkMode ? "text-slate-300" : "text-slate-700")}>
              Altura (mm)
              <input
                type="number"
                value={params.heightMm}
                onChange={(event) => setParams((current) => ({ ...current, heightMm: Number(event.target.value) }))}
                className={cn(
                  "mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none",
                  isDarkMode
                    ? "border-white/10 bg-black/20 text-white"
                    : "border-slate-200 bg-white text-slate-900",
                )}
              />
            </label>
            <div ref={rotationMenuRef} className={cn("block text-xs", isDarkMode ? "text-slate-300" : "text-slate-700")}>
              <div className="mb-1">Rotacao</div>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isRotationMenuOpen}
                onClick={() => setIsRotationMenuOpen((current) => !current)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm outline-none transition hover:-translate-y-0.5",
                  isDarkMode
                    ? "border-white/10 bg-black/20 text-white hover:border-cyan-300/35 hover:bg-cyan-500/10"
                    : "border-slate-200 bg-white text-slate-900 hover:border-cyan-300 hover:bg-cyan-50",
                )}
              >
                <span className="flex flex-col items-start">
                  <span className="font-medium">{currentRotation.label}</span>
                  <span className={cn("text-[11px]", isDarkMode ? "text-slate-400" : "text-slate-500")}>{currentRotation.description}</span>
                </span>
                <span className={cn("text-lg transition-transform", isRotationMenuOpen && "rotate-180", isDarkMode ? "text-cyan-200" : "text-cyan-700")}>
                  ▾
                </span>
              </button>

              {isRotationMenuOpen ? (
                <div
                  role="listbox"
                  className={cn(
                    "animate-menu-reveal mt-3 grid gap-3 rounded-2xl border p-3 shadow-2xl",
                    isDarkMode
                      ? "border-cyan-400/20 bg-slate-950/88"
                      : "border-cyan-200 bg-white/96",
                  )}
                >
                  {rotationOptions.map((option) => {
                    const isActive = option.value === params.rotation;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => {
                          setParams((current) => ({ ...current, rotation: option.value }));
                          setIsRotationMenuOpen(false);
                        }}
                        className={cn(
                          "rounded-xl border px-4 py-3 text-left transition hover:-translate-y-0.5",
                          isActive
                            ? "border-cyan-300/45 bg-cyan-500/15 text-white"
                            : isDarkMode
                              ? "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/25 hover:bg-cyan-500/10"
                              : "border-slate-200 bg-slate-50 text-slate-800 hover:border-cyan-300 hover:bg-cyan-50",
                        )}
                      >
                        <div className="text-sm font-semibold">{option.label}</div>
                        <div className={cn(
                          "mt-1 text-xs",
                          isActive ? "text-cyan-100/80" : isDarkMode ? "text-slate-400" : "text-slate-500",
                        )}>
                          {option.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5">
            <div className={cn("mb-2 text-sm font-semibold", isDarkMode ? "text-white" : "text-slate-950")}>Lote atual</div>
            <div className="max-h-[380px] space-y-2 overflow-auto">
              {items.length ? (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-left transition",
                      item.id === selectedId
                        ? "border-cyan-300/50 bg-cyan-400/10"
                        : isDarkMode
                          ? "border-white/10 bg-black/20 hover:bg-white/5"
                          : "border-slate-200 bg-slate-50 hover:bg-white",
                    )}
                  >
                    <div className={cn("truncate text-sm font-medium", isDarkMode ? "text-white" : "text-slate-950")}>{item.name}</div>
                    <div className={cn("mt-1 truncate text-xs", isDarkMode ? "text-slate-400" : "text-slate-500")}>{item.zpl.slice(0, 72) || "(vazio)"}</div>
                  </button>
                ))
              ) : (
                <div className={cn(
                  "rounded-2xl border p-4 text-sm",
                  isDarkMode
                    ? "border-white/10 bg-black/20 text-slate-400"
                    : "border-slate-200 bg-slate-50 text-slate-500",
                )}>
                  Nenhum arquivo carregado ainda.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className={cn(
          "animate-panel-in animate-panel-delay-1 rounded-[1.5rem] border p-5 backdrop-blur-xl",
          isDarkMode
            ? "border-white/10 bg-white/5"
            : "border-white/70 bg-white/82 shadow-[0_20px_60px_-40px_rgba(14,165,233,0.22)]",
        )}>
          <div className="flex items-center justify-between gap-3">
            <div className={cn("text-sm font-semibold", isDarkMode ? "text-white" : "text-slate-950")}>Editor ZPL</div>
            <div className={cn("text-xs", isDarkMode ? "text-slate-400" : "text-slate-500")}>{selected?.name ?? "Manual.zpl"}</div>
          </div>
          <textarea
            value={selected?.zpl ?? ""}
            onChange={(event) => {
              const nextValue = event.target.value;

              if (!selectedId) {
                const id = makeId();
                setItems([{ id, name: "Manual.zpl", zpl: nextValue }]);
                setSelectedId(id);
                return;
              }

              setItems((current) =>
                current.map((item) => (item.id === selectedId ? { ...item, zpl: nextValue } : item)),
              );
            }}
            placeholder="Cole seu ZPL aqui..."
            className={cn(
              "mt-4 h-[620px] w-full resize-none rounded-[1.5rem] border p-4 font-mono text-xs leading-6 outline-none",
              isDarkMode
                ? "border-white/10 bg-black/25 text-white"
                : "border-slate-200 bg-white text-slate-900",
            )}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleRender()}
              disabled={!selected?.zpl.trim() || isRendering || isBatching}
              className={cn(
                "rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50",
                isDarkMode ? "bg-cyan-400 text-slate-950" : "bg-slate-950 text-white",
              )}
            >
              {isRendering ? "Renderizando..." : "Renderizar preview"}
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadZip()}
              disabled={!items.length || isRendering || isBatching}
              className={cn(
                "rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50",
                isDarkMode
                  ? "border border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                  : "border border-cyan-300 bg-cyan-50 text-cyan-900",
              )}
            >
              {isBatching ? "Gerando ZIP..." : "Baixar ZIP em PDF"}
            </button>
            <button
              type="button"
              onClick={() => setActiveModule("operations")}
              className={cn(
                "rounded-full border px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5",
                isDarkMode
                  ? "border-white/15 bg-white/5 text-white"
                  : "border-slate-300 bg-white text-slate-800",
              )}
            >
              Ver operacoes
            </button>
          </div>
          {error ? (
            <div className={cn(
              "mt-4 rounded-2xl px-4 py-3 text-sm",
              isDarkMode ? "bg-rose-500/10 text-rose-200" : "bg-rose-50 text-rose-700",
            )}>
              {error}
            </div>
          ) : null}
        </section>

        <section className={cn(
          "animate-panel-in animate-panel-delay-2 rounded-[1.5rem] border p-5 backdrop-blur-xl",
          isDarkMode
            ? "border-white/10 bg-white/5"
            : "border-white/70 bg-white/82 shadow-[0_20px_60px_-40px_rgba(14,165,233,0.22)]",
        )}>
          <div className={cn("text-sm font-semibold", isDarkMode ? "text-white" : "text-slate-950")}>Preview</div>
          <div className={cn(
            "mt-4 flex h-[620px] items-center justify-center rounded-[1.5rem] border p-6",
            isDarkMode
              ? "border-white/10 bg-black/20"
              : "border-slate-200 bg-slate-50",
          )}>
            {previewUrl ? (
              <img src={previewUrl} alt="Preview do label" className="max-h-full max-w-full object-contain" />
            ) : (
              <div className={cn("text-center text-sm", isDarkMode ? "text-slate-400" : "text-slate-500")}>
                {selected?.zpl.trim() ? "Clique em renderizar preview." : "Adicione um ZPL para visualizar."}
              </div>
            )}
          </div>
          <div className={cn("mt-4 text-xs", isDarkMode ? "text-slate-400" : "text-slate-500")}>Backend: {apiBase() || "mesma origem"}</div>
        </section>
      </main>
    );
  }

  function renderOperations() {
    return (
      <main className="grid flex-1 gap-4 lg:grid-cols-[1fr_1fr]">
        <section className={cn(
          "animate-panel-in rounded-[1.5rem] border p-6 backdrop-blur-xl",
          isDarkMode
            ? "border-white/10 bg-white/5"
            : "border-white/70 bg-white/82 shadow-[0_20px_60px_-40px_rgba(14,165,233,0.22)]",
        )}>
          <div className={cn("text-xs uppercase tracking-[0.28em]", isDarkMode ? "text-cyan-200" : "text-cyan-700")}>Resumo operacional</div>
          <div className={cn("mt-4 text-3xl font-semibold", isDarkMode ? "text-white" : "text-slate-950")}>Controle do lote atual</div>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              { label: "Arquivos", value: String(items.length) },
              { label: "Prontos", value: String(completedItems) },
              { label: "Formato", value: `${params.widthMm} x ${params.heightMm}` },
              { label: "Rotacao", value: `${params.rotation}°` },
            ].map((card) => (
              <div
                key={card.label}
                className={cn(
                  "rounded-2xl border p-4",
                  isDarkMode
                    ? "border-white/10 bg-black/20"
                    : "border-slate-200 bg-slate-50",
                )}
              >
                <div className={cn("text-xs uppercase tracking-[0.25em]", isDarkMode ? "text-slate-400" : "text-slate-500")}>{card.label}</div>
                <div className={cn("mt-2 text-2xl font-semibold", isDarkMode ? "text-white" : "text-slate-950")}>{card.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setActiveModule("home")}
              className={cn(
                "rounded-full border px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5",
                isDarkMode
                  ? "border-white/15 bg-white/5 text-white"
                  : "border-slate-300 bg-white text-slate-800",
              )}
            >
              Voltar para home
            </button>
            <button
              type="button"
              onClick={() => setActiveModule("studio")}
              className={cn(
                "rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5",
                isDarkMode ? "bg-cyan-400 text-slate-950" : "bg-slate-950 text-white",
              )}
            >
              Voltar para studio
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadZip()}
              disabled={!items.length || isRendering || isBatching}
              className={cn(
                "rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50",
                isDarkMode
                  ? "border border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                  : "border border-cyan-300 bg-cyan-50 text-cyan-900",
              )}
            >
              {isBatching ? "Gerando ZIP..." : "Baixar ZIP em PDF"}
            </button>
          </div>
        </section>

        <section className={cn(
          "animate-panel-in animate-panel-delay-1 rounded-[1.5rem] border p-6 backdrop-blur-xl",
          isDarkMode
            ? "border-white/10 bg-white/5"
            : "border-white/70 bg-white/82 shadow-[0_20px_60px_-40px_rgba(14,165,233,0.22)]",
        )}>
          <div className={cn("text-xs uppercase tracking-[0.28em]", isDarkMode ? "text-cyan-200" : "text-cyan-700")}>Fila de arquivos</div>
          <div className={cn("mt-4 text-2xl font-semibold", isDarkMode ? "text-white" : "text-slate-950")}>Itens carregados</div>
          <div className="mt-5 space-y-3">
            {items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setActiveModule("studio");
                  }}
                  className={cn(
                    "flex w-full items-start justify-between rounded-2xl border p-4 text-left transition",
                    isDarkMode
                      ? "border-white/10 bg-black/20 hover:bg-white/5"
                      : "border-slate-200 bg-slate-50 hover:bg-white",
                  )}
                >
                  <div>
                    <div className={cn("text-sm font-medium", isDarkMode ? "text-white" : "text-slate-950")}>{item.name}</div>
                    <div className={cn("mt-1 text-xs", isDarkMode ? "text-slate-400" : "text-slate-500")}>{item.zpl.slice(0, 90) || "(vazio)"}</div>
                  </div>
                  <span className={cn(
                    "rounded-full px-3 py-1 text-xs",
                    isDarkMode ? "bg-cyan-400/10 text-cyan-100" : "bg-cyan-100 text-cyan-900",
                  )}>Abrir</span>
                </button>
              ))
            ) : (
              <div className={cn(
                "rounded-2xl border p-5 text-sm",
                isDarkMode
                  ? "border-white/10 bg-black/20 text-slate-400"
                  : "border-slate-200 bg-slate-50 text-slate-500",
              )}>
                Nenhum item no lote. Use o Studio ZPL para adicionar arquivos.
              </div>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <div
      className={cn(
        "min-h-screen overflow-hidden",
        isDarkMode ? "bg-[linear-gradient(180deg,#04111f_0%,#071826_45%,#03101a_100%)] text-slate-100" : "bg-slate-100 text-slate-900",
      )}
    >
      <ParticleField isDarkMode={isDarkMode} />
      <div className="pointer-events-none absolute left-[-80px] top-10 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl animate-aurora-float" />
      <div className="pointer-events-none absolute right-[-40px] top-40 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl animate-soft-pulse" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 md:px-6">
        <header className={cn(
          "animate-panel-in mb-6 flex flex-col gap-4 rounded-[1.75rem] border px-5 py-5 backdrop-blur-xl md:flex-row md:items-center md:justify-between",
          isDarkMode
            ? "border-white/10 bg-white/5"
            : "border-white/70 bg-white/78 shadow-[0_20px_60px_-40px_rgba(14,165,233,0.25)]",
        )}>
          <div className="flex items-center gap-4">
            <div className={cn(
              "logo-badge flex h-16 w-16 items-center justify-center rounded-2xl border p-2",
              isDarkMode
                ? "border-cyan-400/20 bg-white/5"
                : "border-cyan-200/80 bg-white/90",
            )}>
              <img
                src="/logo-alquimia-2.png"
                alt="Logo Alquimia"
                className="logo-mark h-full w-full object-contain"
              />
            </div>
            <div>
              <div className={cn("text-xs font-semibold tracking-[0.32em]", isDarkMode ? "text-cyan-200" : "text-cyan-700")}>ALQUIMIA STUDIO</div>
              <div className={cn("mt-2 text-2xl font-semibold", isDarkMode ? "text-white" : "text-slate-950")}>Painel principal</div>
              <div className={cn("mt-1 text-sm", isDarkMode ? "text-slate-300" : "text-slate-600")}>
                Alquimia Studio focado em ZPL.
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <nav className="flex flex-wrap gap-2">
              {modules.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => setActiveModule(module.id)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5",
                    activeModule === module.id
                      ? isDarkMode
                        ? "border-cyan-300/50 bg-cyan-400/15 text-white"
                        : "border-cyan-400/60 bg-cyan-100 text-cyan-950"
                      : isDarkMode
                        ? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                        : "border-slate-300/70 bg-white/90 text-slate-800 hover:bg-white",
                  )}
                >
                  {module.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <span className={cn(
                "rounded-full border px-3 py-1 text-xs",
                isDarkMode
                  ? "border-white/10 bg-white/5 text-slate-300"
                  : "border-slate-300/60 bg-white text-slate-600",
              )}>
                {isRendering ? "Renderizando..." : isBatching ? "Gerando ZIP..." : "Sistema ativo"}
              </span>
              <button
                type="button"
                onClick={() => setIsDarkMode((current) => !current)}
                className={cn(
                  "inline-flex h-10 w-16 items-center rounded-full p-1 transition",
                  isDarkMode ? "bg-cyan-600" : "bg-slate-300",
                )}
              >
                <span
                  className={cn(
                    "h-8 w-8 rounded-full bg-white shadow transition-transform",
                    isDarkMode ? "translate-x-0" : "translate-x-6",
                  )}
                />
              </button>
            </div>
          </div>
        </header>

        {activeModule === "home"
          ? renderHome()
          : activeModule === "studio"
            ? renderStudio()
            : renderOperations()}
      </div>
    </div>
  );
}
