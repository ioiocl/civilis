"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Hito, Obra, UserSession } from "../../types/index.js";
import { apiFetch } from "../../lib/api";

type CsvActividad = { nombre: string; descripcion: string; fechaInicio: string; fechaFin: string; orden: number };
type CsvHito = { nombre: string; descripcion: string; fechaInicio: string; fechaFin: string; orden: number; actividades: CsvActividad[] };

const COLORS = [
  { bar: "bg-cyan-500", light: "bg-cyan-100", text: "text-cyan-800", border: "border-cyan-300" },
  { bar: "bg-violet-500", light: "bg-violet-100", text: "text-violet-800", border: "border-violet-300" },
  { bar: "bg-amber-500", light: "bg-amber-100", text: "text-amber-800", border: "border-amber-300" },
  { bar: "bg-emerald-500", light: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" },
  { bar: "bg-rose-500", light: "bg-rose-100", text: "text-rose-800", border: "border-rose-300" },
  { bar: "bg-sky-500", light: "bg-sky-100", text: "text-sky-800", border: "border-sky-300" },
];

export default function NuevaObraPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [ready, setReady] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    ubicacion: "",
    encargado: "",
    valor: "",
    fechaInicio: "",
    fechaFin: "",
    latitud: "",
    longitud: "",
  });
  const [gpsLoading, setGpsLoading] = useState(false);

  const [csvHitos, setCsvHitos] = useState<CsvHito[] | null>(null);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvPreview, setCsvPreview] = useState<CsvHito[] | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const csvRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem("civilis_session");
    if (!raw) { router.replace("/login"); return; }
    try {
      const s = JSON.parse(raw) as UserSession;
      if (s.user.rol !== "ADMIN") { router.replace("/login"); return; }
      setSession(s);
    } catch {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes;
      } else if (line[i] === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += line[i];
      }
    }
    result.push(current.trim());
    return result;
  }

  async function parseCsv(file: File) {
    const text = await file.text();
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.toLowerCase().startsWith("tipo"));

    const hitos: CsvHito[] = [];
    let currentHito: CsvHito | null = null;

    for (const [idx, line] of lines.entries()) {
      const cols = parseCsvLine(line);
      const tipo = cols[0]?.toUpperCase();
      if (tipo === "HITO") {
        currentHito = {
          nombre: cols[1] ?? "",
          descripcion: cols[2] ?? "",
          fechaInicio: cols[6] ?? "",
          fechaFin: cols[7] ?? "",
          orden: Number(cols[8]),
          actividades: [],
        };
        hitos.push(currentHito);
      } else if (tipo === "ACTIVIDAD") {
        if (!currentHito) { console.warn(`Fila ${idx + 2}: ACTIVIDAD sin HITO previo`); continue; }
        currentHito.actividades.push({
          nombre: cols[1] ?? "",
          descripcion: cols[2] ?? "",
          fechaInicio: cols[6] ?? "",
          fechaFin: cols[7] ?? "",
          orden: Number(cols[8]),
        });
      }
    }

    hitos.forEach((h, i) => {
      h.orden = i + 1;
      h.actividades.forEach((a, j) => { a.orden = j + 1; });
    });

    setCsvFileName(file.name);
    setCsvPreview(hitos);
  }

  function toFriendlyApiError(rawError: unknown): string {
    const fallback = "No se pudo completar la operación.";
    if (!(rawError instanceof Error)) return fallback;
    const rawMessage = rawError.message || fallback;
    let extracted = rawMessage;
    try {
      const parsed = JSON.parse(rawMessage) as { message?: string };
      if (typeof parsed.message === "string") extracted = parsed.message;
    } catch {
      extracted = rawMessage;
    }
    if (extracted.includes("Unique constraint failed") && extracted.includes("obraId") && extracted.includes("orden")) {
      return "El orden del hito ya existe en esta obra. Usa otro número de orden.";
    }
    if (extracted.includes("Unique constraint failed") && extracted.includes("hitoId") && extracted.includes("orden")) {
      return "El orden de la actividad ya existe en este hito. Usa otro número de orden.";
    }
    return extracted;
  }

  async function crear() {
    if (!session) return;

    const valorNumerico = Number(form.valor);
    if (!form.nombre || !form.descripcion || !form.ubicacion || !form.encargado || !form.fechaInicio || !form.fechaFin || !Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      setError("Completa todos los campos con datos válidos.");
      return;
    }
    if (!csvHitos) {
      setError("Sube el archivo CSV con los hitos y actividades antes de crear la obra.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const nuevaObra = await apiFetch<Obra>("/obras", {
        method: "POST",
        body: JSON.stringify({
          nombre: form.nombre,
          descripcion: form.descripcion,
          ubicacion: form.ubicacion,
          encargado: form.encargado,
          valor: valorNumerico,
          fechaInicio: new Date(`${form.fechaInicio}T00:00:00`).toISOString(),
          fechaFin: new Date(`${form.fechaFin}T00:00:00`).toISOString(),
          latitud: form.latitud ? parseFloat(form.latitud) : null,
          longitud: form.longitud ? parseFloat(form.longitud) : null,
        }),
      }, session.token);

      for (const hito of csvHitos) {
        let createdHito: Hito;
        try {
          createdHito = await apiFetch<Hito>("/hitos", {
            method: "POST",
            body: JSON.stringify({
              obraId: nuevaObra.id,
              nombre: hito.nombre,
              descripcion: hito.descripcion,
              fechaInicio: new Date(`${hito.fechaInicio}T00:00:00`).toISOString(),
              fechaFin: new Date(`${hito.fechaFin}T00:00:00`).toISOString(),
              orden: hito.orden,
            }),
          }, session.token);
        } catch (e) {
          throw new Error(`Hito "${hito.nombre}": ${toFriendlyApiError(e)}`);
        }
        for (const actividad of hito.actividades) {
          try {
            await apiFetch(`/hitos/${createdHito.id}/actividades`, {
              method: "POST",
              body: JSON.stringify({
                nombre: actividad.nombre,
                descripcion: actividad.descripcion,
                fechaInicio: new Date(`${actividad.fechaInicio}T00:00:00`).toISOString(),
                fechaFin: new Date(`${actividad.fechaFin}T00:00:00`).toISOString(),
                orden: actividad.orden,
              }),
            }, session.token);
          } catch (e) {
            throw new Error(`Actividad "${actividad.nombre}": ${toFriendlyApiError(e)}`);
          }
        }
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la obra.");
    } finally {
      setIsCreating(false);
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4 flex items-center gap-4">
        <button
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          onClick={() => router.push("/login")}
        >
          ← Volver
        </button>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Nueva obra</h1>
          <p className="text-xs text-slate-500">Completa los datos y sube el CSV de hitos antes de guardar</p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">

        {/* Datos de la obra */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 mb-4">Datos generales</p>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-cyan-400 focus:outline-none"
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-cyan-400 focus:outline-none"
              placeholder="Ubicación"
              value={form.ubicacion}
              onChange={(e) => setForm((p) => ({ ...p, ubicacion: e.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-cyan-400 focus:outline-none"
              placeholder="Encargado"
              value={form.encargado}
              onChange={(e) => setForm((p) => ({ ...p, encargado: e.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-cyan-400 focus:outline-none"
              placeholder="Valor (número)"
              type="number"
              min={1}
              value={form.valor}
              onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))}
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Fecha inicio</label>
              <input
                className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-cyan-400 focus:outline-none"
                type="date"
                value={form.fechaInicio}
                onChange={(e) => setForm((p) => ({ ...p, fechaInicio: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Fecha fin</label>
              <input
                className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-cyan-400 focus:outline-none"
                type="date"
                value={form.fechaFin}
                onChange={(e) => setForm((p) => ({ ...p, fechaFin: e.target.value }))}
              />
            </div>
            <textarea
              className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-cyan-400 focus:outline-none"
              placeholder="Descripción"
              rows={3}
              value={form.descripcion}
              onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
            />
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-600">Coordenadas (opcional)</p>
                <button
                  type="button"
                  disabled={gpsLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 disabled:opacity-50"
                  onClick={() => {
                    setGpsLoading(true);
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setForm((p) => ({
                          ...p,
                          latitud: pos.coords.latitude.toFixed(6),
                          longitud: pos.coords.longitude.toFixed(6),
                        }));
                        setGpsLoading(false);
                      },
                      () => setGpsLoading(false)
                    );
                  }}
                >
                  {gpsLoading ? "Obteniendo..." : "📍 Usar mi ubicación"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-cyan-400 focus:outline-none"
                  placeholder="Latitud (ej: -33.4569)"
                  value={form.latitud}
                  onChange={(e) => setForm((p) => ({ ...p, latitud: e.target.value }))}
                />
                <input
                  className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-cyan-400 focus:outline-none"
                  placeholder="Longitud (ej: -70.6483)"
                  value={form.longitud}
                  onChange={(e) => setForm((p) => ({ ...p, longitud: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </section>

        {/* CSV */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 mb-1">Hitos y actividades (CSV)</p>
          <p className="text-xs text-slate-500 mb-4">El archivo debe tener filas HITO y ACTIVIDAD con fechas y orden.</p>

          {csvHitos === null ? (
            <button
              type="button"
              className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 hover:border-cyan-400 hover:text-cyan-700 transition-colors"
              onClick={() => csvRef.current?.click()}
            >
              Cargar CSV de hitos y actividades
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <span className="font-medium">
                {csvFileName} — {csvHitos.length} hito(s) · {csvHitos.reduce((s, h) => s + h.actividades.length, 0)} actividad(es)
              </span>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <button
                  type="button"
                  className="text-xs text-cyan-700 underline hover:text-cyan-900"
                  onClick={() => setCsvPreview(csvHitos)}
                >
                  Ver Gantt
                </button>
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-rose-600"
                  onClick={() => { setCsvHitos(null); setCsvFileName(""); }}
                >
                  Quitar
                </button>
              </div>
            </div>
          )}
          <input
            ref={csvRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) parseCsv(f);
              e.target.value = "";
            }}
          />
        </section>

        {/* Error / Success */}
        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}
        {success && (
          <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Obra creada correctamente. Redirigiendo...
          </p>
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-3">
          <button
            className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
            onClick={() => router.push("/login")}
          >
            Cancelar
          </button>
          <button
            className="rounded-lg bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90"
            onClick={crear}
            disabled={isCreating || csvHitos === null}
            title={csvHitos === null ? "Primero sube el CSV de hitos y actividades" : undefined}
          >
            {isCreating ? "Guardando..." : "Crear obra"}
          </button>
        </div>
      </div>

      {/* Modal Gantt preview */}
      {csvPreview && (() => {
        const allDates = csvPreview.flatMap((h) => [
          new Date(h.fechaInicio).getTime(),
          new Date(h.fechaFin).getTime(),
          ...h.actividades.flatMap((a) => [new Date(a.fechaInicio).getTime(), new Date(a.fechaFin).getTime()]),
        ]).filter((t) => !isNaN(t));
        const gStart = new Date(Math.min(...allDates));
        const gEnd = new Date(Math.max(...allDates));
        const gDuration = Math.max(1, gEnd.getTime() - gStart.getTime());
        const ticks = Array.from({ length: 7 }, (_, i) => {
          const ratio = i / 6;
          return { key: i, left: `${ratio * 100}%`, label: new Date(gStart.getTime() + ratio * gDuration).toLocaleDateString() };
        });
        const totalActividades = csvPreview.reduce((s, h) => s + h.actividades.length, 0);
        const isViewOnly = csvHitos !== null;

        return (
          <div
            className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={() => setCsvPreview(null)}
          >
            <div
              className="mx-auto my-auto w-full max-w-4xl flex flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-6 py-4 gap-4">
                <div>
                  <p className="text-base font-semibold text-slate-900">Previsualización Gantt — CSV</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {csvFileName} · {csvPreview.length} hito(s) · {totalActividades} actividad(es)
                  </p>
                </div>
                <button
                  className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  onClick={() => setCsvPreview(null)}
                >
                  ✕
                </button>
              </div>

              {/* Gantt body */}
              <div className="overflow-x-auto px-6 py-5">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-[180px_1fr] gap-3 border-b border-slate-100 pb-2 mb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Elemento</p>
                    <div className="relative h-5">
                      {ticks.map((tick) => (
                        <div key={tick.key} className="absolute top-0 -translate-x-1/2 flex flex-col items-center" style={{ left: tick.left }}>
                          <span className="h-2 w-px bg-slate-300" />
                          <p className="text-[9px] text-slate-400 whitespace-nowrap mt-0.5">{tick.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-5">
                    {csvPreview.map((hito, hitoIdx) => {
                      const color = COLORS[hitoIdx % COLORS.length];
                      const hitoStart = new Date(hito.fechaInicio).getTime();
                      const hitoEnd = new Date(hito.fechaFin).getTime();
                      const hitoLeft = ((hitoStart - gStart.getTime()) / gDuration) * 100;
                      const hitoWidth = Math.max(3, ((hitoEnd - hitoStart) / gDuration) * 100);
                      return (
                        <div key={hitoIdx}>
                          <div className="grid grid-cols-[180px_1fr] items-center gap-3 mb-1.5">
                            <div className={`flex items-center gap-1.5 rounded-lg border ${color.border} ${color.light} px-2 py-1`}>
                              <span className={`h-2 w-2 rounded-full ${color.bar} shrink-0`} />
                              <p className={`text-xs font-semibold truncate ${color.text}`} title={hito.nombre}>
                                {hitoIdx + 1}. {hito.nombre}
                              </p>
                            </div>
                            <div className="relative h-6 rounded-lg bg-slate-100">
                              {ticks.map((tick) => (
                                <span key={tick.key} className="absolute inset-y-0 w-px bg-slate-200" style={{ left: tick.left }} />
                              ))}
                              <div
                                className={`absolute top-1 h-4 rounded-md ${color.bar} opacity-80`}
                                style={{ left: `${hitoLeft}%`, width: `${hitoWidth}%` }}
                                title={`${hito.fechaInicio} → ${hito.fechaFin}`}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            {hito.actividades.map((act, actIdx) => {
                              const aStart = new Date(act.fechaInicio).getTime();
                              const aEnd = new Date(act.fechaFin).getTime();
                              const aLeft = ((aStart - gStart.getTime()) / gDuration) * 100;
                              const aWidth = Math.max(2, ((aEnd - aStart) / gDuration) * 100);
                              return (
                                <div key={actIdx} className="grid grid-cols-[180px_1fr] items-center gap-3">
                                  <p className="pl-4 text-[11px] text-slate-500 truncate" title={act.nombre}>· {act.nombre}</p>
                                  <div className="relative h-4 rounded bg-white border border-slate-200">
                                    {ticks.map((tick) => (
                                      <span key={tick.key} className="absolute inset-y-0 w-px bg-slate-100" style={{ left: tick.left }} />
                                    ))}
                                    <div
                                      className={`absolute top-0.5 h-3 rounded ${color.bar} opacity-60`}
                                      style={{ left: `${aLeft}%`, width: `${aWidth}%` }}
                                      title={`${act.nombre} · ${act.fechaInicio} → ${act.fechaFin}`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
                <button
                  className="rounded-lg border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  onClick={() => setCsvPreview(null)}
                >
                  {isViewOnly ? "Cerrar" : "Cancelar"}
                </button>
                {!isViewOnly && (
                  <button
                    className="rounded-lg bg-brand-700 px-6 py-2 text-sm font-semibold text-white hover:opacity-90"
                    onClick={() => { setCsvHitos(csvPreview); setCsvPreview(null); }}
                  >
                    Confirmar CSV
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
