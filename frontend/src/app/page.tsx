"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Actividad, Comentario, Hito, Obra, UserSession } from "../types/index.js";
import { apiFetch } from "../lib/api";

export default function HomePage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<UserSession | null>(null);
  const [hitos, setHitos] = useState<Hito[]>([]);
  const [actividadesByHito, setActividadesByHito] = useState<Record<string, Actividad[]>>({});
  const [comentariosByActividad, setComentariosByActividad] = useState<Record<string, Comentario[]>>({});

  useEffect(() => {
    async function loadPublicView() {
      try {
        const session = await apiFetch<UserSession>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: "ciudadano@obratrack.local", password: "123456" }),
        });
        setSession(session);
        const data = await apiFetch<Obra[]>("/obras", {}, session.token);
        setObras(data);
        if (data.length > 0) {
          setSelectedObraId(data[0].id);
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadPublicView();
  }, []);

  useEffect(() => {
    async function loadObraGantt(obraId: string) {
      if (!session?.token || !obraId) return;

      const hitoData = await apiFetch<Hito[]>(`/obras/${obraId}/hitos`, {}, session.token);
      setHitos(hitoData);

      const actividadesMap: Record<string, Actividad[]> = {};
      const comentariosMap: Record<string, Comentario[]> = {};

      for (const h of hitoData) {
        const actividades = await apiFetch<Actividad[]>(`/hitos/${h.id}/actividades`, {}, session.token);
        actividadesMap[h.id] = actividades;
        for (const actividad of actividades) {
          comentariosMap[actividad.id] = await apiFetch<Comentario[]>(`/actividades/${actividad.id}/comentarios`, {}, session.token);
        }
      }

      setActividadesByHito(actividadesMap);
      setComentariosByActividad(comentariosMap);
    }

    void loadObraGantt(selectedObraId);
  }, [selectedObraId, session?.token]);

  const selectedObra = useMemo(() => obras.find((obra) => obra.id === selectedObraId) ?? null, [obras, selectedObraId]);
  const sortedHitos = useMemo(() => [...hitos].sort((a, b) => a.orden - b.orden), [hitos]);
  const allActividades = useMemo(
    () => sortedHitos.flatMap((hito) => actividadesByHito[hito.id] ?? []).sort((a, b) => a.orden - b.orden),
    [sortedHitos, actividadesByHito],
  );

  const ganttStart = useMemo(() => {
    if (allActividades.length === 0) {
      return selectedObra ? new Date(selectedObra.fechaInicio) : new Date();
    }

    return new Date(Math.min(...allActividades.map((a) => new Date(a.fechaInicio).getTime())));
  }, [allActividades, selectedObra]);

  const ganttEnd = useMemo(() => {
    if (allActividades.length === 0) {
      return selectedObra ? new Date(selectedObra.fechaFin) : new Date();
    }

    return new Date(Math.max(...allActividades.map((a) => new Date(a.fechaFin).getTime())));
  }, [allActividades, selectedObra]);

  const ganttDurationMs = Math.max(1, ganttEnd.getTime() - ganttStart.getTime());
  const timelineTicks = useMemo(() => {
    const divisions = 8;
    return Array.from({ length: divisions + 1 }, (_, idx) => {
      const ratio = idx / divisions;
      const time = ganttStart.getTime() + ratio * ganttDurationMs;
      return {
        key: idx,
        left: `${ratio * 100}%`,
        label: new Date(time).toLocaleDateString(),
      };
    });
  }, [ganttStart, ganttDurationMs]);

  return (
    <main className="mx-auto max-w-[1240px] space-y-5 p-4 md:p-6">
      <header className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Civilis by ioio</h1>
            <span className="rounded-full bg-rose-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">Home</span>
          </div>
          <Link href="/login" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Login
          </Link>
        </div>
        <p className="text-sm text-slate-600">Listado público de obras. La carga de obras y comentarios se realiza desde la página de login.</p>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Obras</h2>
        {isLoading ? (
          <p className="mt-2 text-sm text-slate-500">Cargando obras...</p>
        ) : obras.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No hay obras disponibles.</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {obras.map((obra) => {
              const isActive = obra.id === selectedObraId;
              return (
                <button
                  key={obra.id}
                  onClick={() => setSelectedObraId(obra.id)}
                  className={`rounded-2xl border p-3 text-left transition ${
                    isActive ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-800">{obra.nombre}</p>
                  <p className="mt-1 text-xs text-slate-600">{obra.ubicacion}</p>
                  <p className="mt-2 text-[11px] text-slate-500">Estado: {obra.estado.replace("_", " ")}</p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedObra && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Ficha de obra</h3>
          <div className="mt-2 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            <p><strong>Nombre:</strong> {selectedObra.nombre}</p>
            <p><strong>Ubicación:</strong> {selectedObra.ubicacion}</p>
            <p><strong>Encargado:</strong> {selectedObra.encargado}</p>
            <p><strong>Estado:</strong> {selectedObra.estado.replace("_", " ")}</p>
            <p><strong>Presupuesto:</strong> ${selectedObra.valor.toLocaleString()}</p>
            <p><strong>Periodo:</strong> {new Date(selectedObra.fechaInicio).toLocaleDateString()} - {new Date(selectedObra.fechaFin).toLocaleDateString()}</p>
          </div>
          <p className="mt-3 text-sm text-slate-600">{selectedObra.descripcion}</p>
        </section>
      )}

      {selectedObra && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 inline-flex rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-semibold text-cyan-800">
            Detalle Gantt (modo lectura)
          </div>

          {!session ? (
            <p className="text-sm text-slate-500">Iniciando sesión pública...</p>
          ) : hitos.length === 0 ? (
            <p className="text-sm text-slate-500">No hay hitos/actividades para mostrar.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[240px_1fr] gap-3 border-b border-slate-200 pb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actividad / Hito</p>
                  <div className="relative h-8">
                    {timelineTicks.map((tick) => (
                      <div key={tick.key} className="absolute top-0 -translate-x-1/2" style={{ left: tick.left }}>
                        <p className="text-[10px] text-slate-500">{tick.label}</p>
                        <span className="mx-auto mt-1 block h-1.5 w-1.5 rounded-full bg-slate-300" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 space-y-5">
                  {sortedHitos.map((hito) => {
                    const actividades = [...(actividadesByHito[hito.id] ?? [])].sort((a, b) => a.orden - b.orden);
                    return (
                      <div key={hito.id}>
                        <div className="mb-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-sm font-semibold text-slate-800">{hito.nombre}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{hito.descripcion}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                            {hito.estado.replace("_", " ")} · {new Date(hito.fechaInicio).toLocaleDateString()} - {new Date(hito.fechaFin).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="space-y-2">
                          {actividades.map((actividad) => {
                            const start = new Date(actividad.fechaInicio).getTime();
                            const end = new Date(actividad.fechaFin).getTime();
                            const left = ((start - ganttStart.getTime()) / ganttDurationMs) * 100;
                            const width = Math.max(8, ((end - start) / ganttDurationMs) * 100);
                            const barColor =
                              actividad.estado === "COMPLETADO"
                                ? "bg-emerald-500"
                                : actividad.estado === "EN_PROGRESO"
                                  ? "bg-amber-400"
                                  : "bg-cyan-500";
                            const commentCount = (comentariosByActividad[actividad.id] ?? []).length;

                            return (
                              <div key={actividad.id} className="grid grid-cols-[240px_1fr] items-center gap-3">
                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                  <p className="text-xs font-semibold text-slate-800">{actividad.nombre}</p>
                                  <p className="mt-0.5 text-[11px] text-slate-500">{actividad.descripcion}</p>
                                  <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">Comentarios: {commentCount}</p>
                                </div>

                                <div className="relative h-14 rounded-xl border border-slate-200 bg-white/90 px-2">
                                  {timelineTicks.map((tick) => (
                                    <span
                                      key={`line-${actividad.id}-${tick.key}`}
                                      className="absolute bottom-2 top-2 w-px bg-slate-100"
                                      style={{ left: tick.left }}
                                    />
                                  ))}

                                  <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200" />

                                  <div
                                    className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${barColor}`}
                                    style={{ left: `${Math.max(0, Math.min(100, left))}%`, width: `${Math.min(100 - left, width)}%` }}
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
          )}
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-800">Usuarios demo por rol</h3>
        <div className="mt-2 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
          <p><strong>ADMIN</strong><br />admin@obratrack.local<br />123456</p>
          <p><strong>FISCALIZADOR</strong><br />fiscal@obratrack.local<br />123456</p>
          <p><strong>CIUDADANO</strong><br />ciudadano@obratrack.local<br />123456</p>
        </div>
      </section>
    </main>
  );
}
