"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Actividad, Comentario, Hito, Obra, ObraGeneral, UserSession } from "../../types/index.js";
import { apiFetch, API_BASE } from "../../lib/api";

export default function LoginPage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [email, setEmail] = useState("ciudadano@obratrack.local");
  const [password, setPassword] = useState("123456");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [obras, setObras] = useState<Obra[]>([]);
  const [selectedObra, setSelectedObra] = useState<string>("");
  const [selectedObraGeneral, setSelectedObraGeneral] = useState<ObraGeneral | null>(null);
  const [showObraMore, setShowObraMore] = useState(false);
  const [obraSearch, setObraSearch] = useState("");
  const [hitos, setHitos] = useState<Hito[]>([]);
  const [actividadesByHito, setActividadesByHito] = useState<Record<string, Actividad[]>>({});
  const [comentariosByActividad, setComentariosByActividad] = useState<Record<string, Comentario[]>>({});
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [selectedFiscActividadId, setSelectedFiscActividadId] = useState<string | null>(null);
  const [selectedFiscActividadNombre, setSelectedFiscActividadNombre] = useState<string>("");
  const [selectedFiscClickDate, setSelectedFiscClickDate] = useState<Date | undefined>(undefined);
  const [expandedHitos, setExpandedHitos] = useState<Set<string>>(new Set());
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [showCreateObra, setShowCreateObra] = useState(false);
  const [isCreatingObra, setIsCreatingObra] = useState(false);
  const [createObraError, setCreateObraError] = useState<string | null>(null);
  const [showCreateHito, setShowCreateHito] = useState(false);
  const [isCreatingHito, setIsCreatingHito] = useState(false);
  const [createHitoError, setCreateHitoError] = useState<string | null>(null);
  const [showCreateActividad, setShowCreateActividad] = useState(false);
  const [isCreatingActividad, setIsCreatingActividad] = useState(false);
  const [createActividadError, setCreateActividadError] = useState<string | null>(null);
  const [obraForm, setObraForm] = useState({
    nombre: "",
    descripcion: "",
    ubicacion: "",
    encargado: "",
    valor: "",
    fechaInicio: "",
    fechaFin: "",
  });
  const [hitoForm, setHitoForm] = useState({
    nombre: "",
    descripcion: "",
    fechaInicio: "",
    fechaFin: "",
    orden: "",
  });
  const [actividadForm, setActividadForm] = useState({
    hitoId: "",
    nombre: "",
    descripcion: "",
    fechaInicio: "",
    fechaFin: "",
    orden: "",
  });

  const canComment = session?.user.rol === "FISCALIZADOR" || session?.user.rol === "ADMIN";
  const canCreateObra = session?.user.rol === "ADMIN";

  function toFriendlyApiError(rawError: unknown): string {
    const fallback = "No se pudo completar la operación.";
    if (!(rawError instanceof Error)) return fallback;

    const rawMessage = rawError.message || fallback;
    let extracted = rawMessage;

    try {
      const parsed = JSON.parse(rawMessage) as { message?: string };
      if (typeof parsed.message === "string") {
        extracted = parsed.message;
      }
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

  async function login() {
    const data = await apiFetch<UserSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setSession(data);
    const dataObras = await apiFetch<Obra[]>("/obras", {}, data.token);
    setObras(dataObras);
    setSelectedObra("");
    setSelectedObraGeneral(null);
    setHitos([]);
    setActividadesByHito({});
    setComentariosByActividad({});
    setObraSearch("");
  }

  async function crearHito() {
    if (!session || session.user.rol !== "ADMIN" || !selectedObra) return;

    const ordenNumerico = Number(hitoForm.orden);
    if (!hitoForm.nombre || !hitoForm.descripcion || !hitoForm.fechaInicio || !hitoForm.fechaFin || !Number.isInteger(ordenNumerico) || ordenNumerico <= 0) {
      setCreateHitoError("Completa todos los datos del hito con valores válidos.");
      return;
    }

    if (hitos.some((hito) => hito.orden === ordenNumerico)) {
      setCreateHitoError("Ese orden de hito ya existe para la obra seleccionada.");
      return;
    }

    setIsCreatingHito(true);
    setCreateHitoError(null);

    try {
      await apiFetch<Hito>(
        "/hitos",
        {
          method: "POST",
          body: JSON.stringify({
            obraId: selectedObra,
            nombre: hitoForm.nombre,
            descripcion: hitoForm.descripcion,
            fechaInicio: new Date(`${hitoForm.fechaInicio}T00:00:00`).toISOString(),
            fechaFin: new Date(`${hitoForm.fechaFin}T00:00:00`).toISOString(),
            orden: ordenNumerico,
          }),
        },
        session.token,
      );

      await loadObraDetail(selectedObra, undefined, session.token);
      setHitoForm({
        nombre: "",
        descripcion: "",
        fechaInicio: "",
        fechaFin: "",
        orden: "",
      });
      setShowCreateHito(false);
    } catch (error) {
      setCreateHitoError(toFriendlyApiError(error));
    } finally {
      setIsCreatingHito(false);
    }
  }

  async function crearActividad() {
    if (!session || session.user.rol !== "ADMIN" || !selectedObra) return;

    const ordenNumerico = Number(actividadForm.orden);
    if (!actividadForm.hitoId || !actividadForm.nombre || !actividadForm.descripcion || !actividadForm.fechaInicio || !actividadForm.fechaFin || !Number.isInteger(ordenNumerico) || ordenNumerico <= 0) {
      setCreateActividadError("Completa todos los datos de la actividad con valores válidos.");
      return;
    }

    if ((actividadesByHito[actividadForm.hitoId] ?? []).some((actividad) => actividad.orden === ordenNumerico)) {
      setCreateActividadError("Ese orden de actividad ya existe para el hito seleccionado.");
      return;
    }

    setIsCreatingActividad(true);
    setCreateActividadError(null);

    try {
      await apiFetch<Actividad>(
        `/hitos/${actividadForm.hitoId}/actividades`,
        {
          method: "POST",
          body: JSON.stringify({
            nombre: actividadForm.nombre,
            descripcion: actividadForm.descripcion,
            fechaInicio: new Date(`${actividadForm.fechaInicio}T00:00:00`).toISOString(),
            fechaFin: new Date(`${actividadForm.fechaFin}T00:00:00`).toISOString(),
            orden: ordenNumerico,
          }),
        },
        session.token,
      );

      await loadObraDetail(selectedObra, undefined, session.token);
      setActividadForm((prev) => ({
        ...prev,
        nombre: "",
        descripcion: "",
        fechaInicio: "",
        fechaFin: "",
        orden: "",
      }));
      setShowCreateActividad(false);
    } catch (error) {
      setCreateActividadError(toFriendlyApiError(error));
    } finally {
      setIsCreatingActividad(false);
    }
  }

  useEffect(() => {
    setIsBootstrapping(false);
  }, []);

  async function loadObras() {
    if (!session) return;
    const data = await apiFetch<Obra[]>("/obras", {}, session.token);
    setObras(data);
  }

  async function loadObraDetail(obraId: string, current?: Obra[], tokenOverride?: string) {
    const activeToken = tokenOverride ?? session?.token;
    if (!activeToken) return;
    setSelectedObra(obraId);
    setSelectedCommentId(null);

    const works = current ?? obras;
    if (works.length === 0) {
      const latest = await apiFetch<Obra[]>("/obras", {}, activeToken);
      setObras(latest);
    }

    const hitoData = await apiFetch<Hito[]>(`/obras/${obraId}/hitos`, {}, activeToken);
    setHitos(hitoData);
    setActividadForm((prev) => ({
      ...prev,
      hitoId: prev.hitoId && hitoData.some((h) => h.id === prev.hitoId) ? prev.hitoId : (hitoData[0]?.id ?? ""),
    }));
    const general = await apiFetch<ObraGeneral>(`/obras/${obraId}/general`, {}, activeToken);
    setSelectedObraGeneral(general);

    const actividadesMap: Record<string, Actividad[]> = {};
    const comentariosMap: Record<string, Comentario[]> = {};
    for (const h of hitoData) {
      const actividades = await apiFetch<Actividad[]>(`/hitos/${h.id}/actividades`, {}, activeToken);
      actividadesMap[h.id] = actividades;
      for (const actividad of actividades) {
        comentariosMap[actividad.id] = await apiFetch<Comentario[]>(`/actividades/${actividad.id}/comentarios`, {}, activeToken);
      }
    }
    setActividadesByHito(actividadesMap);
    setComentariosByActividad(comentariosMap);
  }

  async function openObraMore(obraId: string) {
    await loadObraDetail(obraId);
    setShowObraMore(true);
  }

  async function enviarComentario(actividadId: string, texto: string, severidad: "LEVE" | "MODERADO" | "GRAVE", file?: File | null, fechaInspeccion?: Date) {
    if (!session || !texto) return;
    const form = new FormData();
    form.append("texto", texto);
    form.append("tipo", "AVANCE");
    form.append("severidad", severidad);
    if (file) form.append("evidencia", file);
    if (fechaInspeccion) form.append("fechaInspeccion", fechaInspeccion.toISOString());

    const response = await fetch(`${API_BASE}/actividades/${actividadId}/comentarios`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
      body: form,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    await loadObraDetail(selectedObra);
  }

  async function crearObra() {
    if (!session || session.user.rol !== "ADMIN") return;

    const valorNumerico = Number(obraForm.valor);
    if (!obraForm.nombre || !obraForm.descripcion || !obraForm.ubicacion || !obraForm.encargado || !obraForm.fechaInicio || !obraForm.fechaFin || !Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      setCreateObraError("Completa todos los campos con datos válidos.");
      return;
    }

    setIsCreatingObra(true);
    setCreateObraError(null);

    try {
      const nuevaObra = await apiFetch<Obra>(
        "/obras",
        {
          method: "POST",
          body: JSON.stringify({
            nombre: obraForm.nombre,
            descripcion: obraForm.descripcion,
            ubicacion: obraForm.ubicacion,
            encargado: obraForm.encargado,
            valor: valorNumerico,
            fechaInicio: new Date(`${obraForm.fechaInicio}T00:00:00`).toISOString(),
            fechaFin: new Date(`${obraForm.fechaFin}T00:00:00`).toISOString(),
          }),
        },
        session.token,
      );

      const dataObras = await apiFetch<Obra[]>("/obras", {}, session.token);
      setObras(dataObras);
      await loadObraDetail(nuevaObra.id, dataObras, session.token);
      setObraForm({
        nombre: "",
        descripcion: "",
        ubicacion: "",
        encargado: "",
        valor: "",
        fechaInicio: "",
        fechaFin: "",
      });
      setShowCreateObra(false);
    } catch (error) {
      setCreateObraError(error instanceof Error ? error.message : "No se pudo crear la obra.");
    } finally {
      setIsCreatingObra(false);
    }
  }

  const selectedWork = useMemo(() => obras.find((o) => o.id === selectedObra), [obras, selectedObra]);
  const filteredObras = useMemo(() => {
    const q = obraSearch.trim().toLowerCase();
    if (!q) return [];
    return obras.filter((o) => o.nombre.toLowerCase().includes(q));
  }, [obras, obraSearch]);
  const completedHitos = hitos.filter((h) => h.estado === "COMPLETADO").length;
  const progressByHitos = hitos.length > 0 ? Math.round((completedHitos / hitos.length) * 100) : 0;
  const sortedHitos = useMemo(() => [...hitos].sort((a, b) => a.orden - b.orden), [hitos]);
  const nextHitoOrden = useMemo(() => {
    const maxOrden = hitos.reduce((max, hito) => Math.max(max, hito.orden), 0);
    return maxOrden + 1;
  }, [hitos]);
  const allActividades = useMemo(
    () => sortedHitos.flatMap((hito) => actividadesByHito[hito.id] ?? []).sort((a, b) => a.orden - b.orden),
    [sortedHitos, actividadesByHito],
  );
  const nextActividadOrden = useMemo(() => {
    const hitoObjetivoId = actividadForm.hitoId || sortedHitos[0]?.id;
    if (!hitoObjetivoId) return 1;
    const maxOrden = (actividadesByHito[hitoObjetivoId] ?? []).reduce((max, actividad) => Math.max(max, actividad.orden), 0);
    return maxOrden + 1;
  }, [actividadForm.hitoId, sortedHitos, actividadesByHito]);
  const today = new Date();
  const progressByTime = useMemo(() => {
    if (!selectedWork) return 0;
    const start = new Date(selectedWork.fechaInicio).getTime();
    const end = new Date(selectedWork.fechaFin).getTime();
    const now = today.getTime();
    if (now <= start) return 0;
    if (now >= end) return 100;
    return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
  }, [selectedWork, today]);

  const orderedComments = useMemo(() => {
    const flattened = Object.values(comentariosByActividad as Record<string, Comentario[]>).reduce(
      (acc: Comentario[], comments) => {
        acc.push(...comments);
        return acc;
      },
      [] as Comentario[],
    );

    return flattened.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [comentariosByActividad]);

  const legendComments = orderedComments.slice(0, 3);
  const presupuestoM = selectedObraGeneral ? `$${(selectedObraGeneral.valor / 1_000_000).toFixed(1)}M` : "-";
  const responsibleEntity = selectedObraGeneral?.actores[0]?.organizacion ?? selectedObraGeneral?.encargado ?? "Sin definir";
  const selectedComment = orderedComments.find((comment) => comment.id === selectedCommentId) ?? null;

  const selectedActivity = useMemo(() => {
    if (!selectedActivityId) return null;
    return allActividades.find((a) => a.id === selectedActivityId) ?? null;
  }, [allActividades, selectedActivityId]);

  function getSeverityPointClasses(severidad: "LEVE" | "MODERADO" | "GRAVE", isSelected: boolean): string {
    const base = "absolute top-1/2 z-20 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow";
    const selected = isSelected ? " ring-2 ring-slate-200" : "";
    if (severidad === "LEVE") return `${base} bg-yellow-500${selected}`;
    if (severidad === "MODERADO") return `${base} bg-blue-500${selected}`;
    return `${base} bg-red-500${selected}`;
  }

  function getSeverityGlyph(severidad: "LEVE" | "MODERADO" | "GRAVE"): string {
    if (severidad === "LEVE") return "!";
    if (severidad === "MODERADO") return "i";
    return "!";
  }

  const ganttStart = useMemo(() => {
    if (allActividades.length === 0) {
      return selectedWork ? new Date(selectedWork.fechaInicio) : new Date();
    }

    return new Date(Math.min(...allActividades.map((a) => new Date(a.fechaInicio).getTime())));
  }, [allActividades, selectedWork]);

  const ganttEnd = useMemo(() => {
    if (allActividades.length === 0) {
      return selectedWork ? new Date(selectedWork.fechaFin) : new Date();
    }

    return new Date(Math.max(...allActividades.map((a) => new Date(a.fechaFin).getTime())));
  }, [allActividades, selectedWork]);

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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Civilis by ioio</h1>
          <span className="rounded-full bg-rose-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">Gantt v2</span>
        </div>
        <p className="text-sm text-slate-600">Visualizador ciudadano de avance, evidencia y trazabilidad por hito</p>
      </header>

      {!session ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{isBootstrapping ? "Cargando obras..." : "Login"}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="rounded border p-2" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input
              className="rounded border p-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="rounded bg-brand-700 px-4 py-2 text-white" onClick={login} disabled={isBootstrapping}>
              Ingresar
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold">Credenciales demo</p>
            <p>ADMIN: admin@obratrack.local / 123456</p>
            <p>FISCALIZADOR: fiscal@obratrack.local / 123456</p>
            <p>CIUDADANO: ciudadano@obratrack.local / 123456</p>
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>
                Sesión: <strong>{session.user.nombre}</strong> ({session.user.rol})
              </p>
              <div className="flex gap-2">
                {canCreateObra && (
                  <button className="rounded border border-cyan-200 bg-cyan-50 px-4 py-2 text-cyan-800" onClick={() => setShowCreateObra((v) => !v)}>
                    {showCreateObra ? "Cerrar formulario" : "Agregar obra"}
                  </button>
                )}
                <button className="rounded bg-slate-900 px-4 py-2 text-white" onClick={loadObras}>
                  Cargar obras
                </button>
                <button className="rounded border px-4 py-2" onClick={() => setSession(null)}>
                  Salir
                </button>
              </div>
            )}
            </div>

            {canCreateObra && showCreateObra && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Nueva obra</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <input
                    className="rounded border bg-white p-2 text-sm"
                    placeholder="Nombre"
                    value={obraForm.nombre}
                    onChange={(e) => setObraForm((prev) => ({ ...prev, nombre: e.target.value }))}
                  />
                  <input
                    className="rounded border bg-white p-2 text-sm"
                    placeholder="Ubicación"
                    value={obraForm.ubicacion}
                    onChange={(e) => setObraForm((prev) => ({ ...prev, ubicacion: e.target.value }))}
                  />
                  <input
                    className="rounded border bg-white p-2 text-sm"
                    placeholder="Encargado"
                    value={obraForm.encargado}
                    onChange={(e) => setObraForm((prev) => ({ ...prev, encargado: e.target.value }))}
                  />
                  <input
                    className="rounded border bg-white p-2 text-sm"
                    placeholder="Valor (número)"
                    type="number"
                    min={1}
                    value={obraForm.valor}
                    onChange={(e) => setObraForm((prev) => ({ ...prev, valor: e.target.value }))}
                  />
                  <input
                    className="rounded border bg-white p-2 text-sm"
                    type="date"
                    value={obraForm.fechaInicio}
                    onChange={(e) => setObraForm((prev) => ({ ...prev, fechaInicio: e.target.value }))}
                  />
                  <input
                    className="rounded border bg-white p-2 text-sm"
                    type="date"
                    value={obraForm.fechaFin}
                    onChange={(e) => setObraForm((prev) => ({ ...prev, fechaFin: e.target.value }))}
                  />
                  <textarea
                    className="md:col-span-2 rounded border bg-white p-2 text-sm"
                    placeholder="Descripción"
                    rows={3}
                    value={obraForm.descripcion}
                    onChange={(e) => setObraForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                  />
                </div>
                {createObraError && <p className="mt-2 text-xs text-rose-600">{createObraError}</p>}
                <div className="mt-3 flex justify-end">
                  <button
                    className="rounded bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-60"
                    onClick={crearObra}
                    disabled={isCreatingObra}
                  >
                    {isCreatingObra ? "Guardando..." : "Crear obra"}
                  </button>
                </div>
              </div>
            )}

            {canCreateObra && selectedObra && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">Agregar hito a la obra</p>
                    <button
                      className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700"
                      onClick={() => {
                        setShowCreateHito((v) => !v);
                        setHitoForm((prev) => ({
                          ...prev,
                          orden: prev.orden || String(nextHitoOrden),
                        }));
                      }}
                    >
                      {showCreateHito ? "Ocultar" : "Nuevo hito"}
                    </button>
                  </div>
                  {showCreateHito && (
                    <div className="mt-3 grid gap-2">
                      <input
                        className="rounded border bg-white p-2 text-sm"
                        placeholder="Nombre del hito"
                        value={hitoForm.nombre}
                        onChange={(e) => setHitoForm((prev) => ({ ...prev, nombre: e.target.value }))}
                      />
                      <textarea
                        className="rounded border bg-white p-2 text-sm"
                        placeholder="Descripción"
                        rows={2}
                        value={hitoForm.descripcion}
                        onChange={(e) => setHitoForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                      />
                      <div className="grid gap-2 md:grid-cols-3">
                        <input
                          className="rounded border bg-white p-2 text-sm"
                          type="date"
                          value={hitoForm.fechaInicio}
                          onChange={(e) => setHitoForm((prev) => ({ ...prev, fechaInicio: e.target.value }))}
                        />
                        <input
                          className="rounded border bg-white p-2 text-sm"
                          type="date"
                          value={hitoForm.fechaFin}
                          onChange={(e) => setHitoForm((prev) => ({ ...prev, fechaFin: e.target.value }))}
                        />
                        <input
                          className="rounded border bg-white p-2 text-sm"
                          type="number"
                          min={1}
                          placeholder="Orden"
                          value={hitoForm.orden}
                          onChange={(e) => setHitoForm((prev) => ({ ...prev, orden: e.target.value }))}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">Sugerido: {nextHitoOrden}</p>
                      {createHitoError && <p className="text-xs text-rose-600">{createHitoError}</p>}
                      <div className="flex justify-end">
                        <button
                          className="rounded bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-60"
                          onClick={crearHito}
                          disabled={isCreatingHito}
                        >
                          {isCreatingHito ? "Guardando..." : "Crear hito"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">Agregar actividad a hito</p>
                    <button
                      className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700"
                      onClick={() => {
                        setShowCreateActividad((v) => !v);
                        setActividadForm((prev) => ({
                          ...prev,
                          hitoId: prev.hitoId || sortedHitos[0]?.id || "",
                          orden: prev.orden || String(nextActividadOrden),
                        }));
                      }}
                    >
                      {showCreateActividad ? "Ocultar" : "Nueva actividad"}
                    </button>
                  </div>
                  {showCreateActividad && (
                    <div className="mt-3 grid gap-2">
                      <select
                        className="rounded border bg-white p-2 text-sm"
                        value={actividadForm.hitoId}
                        onChange={(e) => {
                          const selectedHitoId = e.target.value;
                          const nextOrden = ((actividadesByHito[selectedHitoId] ?? []).reduce((max, actividad) => Math.max(max, actividad.orden), 0) + 1).toString();
                          setActividadForm((prev) => ({
                            ...prev,
                            hitoId: selectedHitoId,
                            orden: prev.orden || nextOrden,
                          }));
                        }}
                      >
                        <option value="">Selecciona hito</option>
                        {sortedHitos.map((hito) => (
                          <option key={hito.id} value={hito.id}>
                            {hito.orden}. {hito.nombre}
                          </option>
                        ))}
                      </select>
                      <input
                        className="rounded border bg-white p-2 text-sm"
                        placeholder="Nombre de la actividad"
                        value={actividadForm.nombre}
                        onChange={(e) => setActividadForm((prev) => ({ ...prev, nombre: e.target.value }))}
                      />
                      <textarea
                        className="rounded border bg-white p-2 text-sm"
                        placeholder="Descripción"
                        rows={2}
                        value={actividadForm.descripcion}
                        onChange={(e) => setActividadForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                      />
                      <div className="grid gap-2 md:grid-cols-3">
                        <input
                          className="rounded border bg-white p-2 text-sm"
                          type="date"
                          value={actividadForm.fechaInicio}
                          onChange={(e) => setActividadForm((prev) => ({ ...prev, fechaInicio: e.target.value }))}
                        />
                        <input
                          className="rounded border bg-white p-2 text-sm"
                          type="date"
                          value={actividadForm.fechaFin}
                          onChange={(e) => setActividadForm((prev) => ({ ...prev, fechaFin: e.target.value }))}
                        />
                        <input
                          className="rounded border bg-white p-2 text-sm"
                          type="number"
                          min={1}
                          placeholder="Orden"
                          value={actividadForm.orden}
                          onChange={(e) => setActividadForm((prev) => ({ ...prev, orden: e.target.value }))}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">Sugerido: {nextActividadOrden}</p>
                      {createActividadError && <p className="text-xs text-rose-600">{createActividadError}</p>}
                      <div className="flex justify-end">
                        <button
                          className="rounded bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-60"
                          onClick={crearActividad}
                          disabled={isCreatingActividad}
                        >
                          {isCreatingActividad ? "Guardando..." : "Crear actividad"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="rounded-2xl border border-sky-100 bg-[#f5fbfd] p-4">
              <div className="mx-auto w-full max-w-xl">
                <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">Buscar obra</p>
                <div className="relative mt-2">
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                    placeholder="Escribe el nombre de una obra..."
                    value={obraSearch}
                    onChange={(e) => {
                      setObraSearch(e.target.value);
                    }}
                  />

                  {filteredObras.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                      <div className="max-h-80 overflow-y-auto p-1">
                        {filteredObras.map((obra) => (
                          <button
                            key={obra.id}
                            type="button"
                            className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                            onClick={async () => {
                              await loadObraDetail(obra.id);
                              setObraSearch(obra.nombre);
                            }}
                          >
                            <p className="text-sm font-semibold text-slate-800">{obra.nombre}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{obra.ubicacion}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {selectedWork && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{selectedWork.nombre}</p>
                        <p className="mt-1 text-xs text-slate-600">{selectedWork.ubicacion}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{selectedWork.estado.replace("_", " ")}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">${(selectedWork.valor / 1_000_000).toFixed(1)}M</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Avance: {progressByHitos}%</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Esperado: {progressByTime}%</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => setShowObraMore(true)}
                      >
                        Ver más
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {showObraMore && (
              <div
                className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/70 p-4"
                onClick={() => setShowObraMore(false)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.18 }}
                  className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Detalle de obra</p>
                      <p className="text-[11px] text-slate-500">{selectedWork?.nombre ?? ""}</p>
                    </div>
                    <button
                      className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600"
                      onClick={() => setShowObraMore(false)}
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="grid gap-3 p-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Ubicación</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{selectedObraGeneral?.ubicacion ?? "-"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Presupuesto</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{presupuestoM}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Avance Total</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{progressByHitos}%</p>
                      <p className="text-[11px] text-slate-500">Esperado: {progressByTime}%</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Entidad Responsable</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{responsibleEntity}</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {selectedWork && (
              <div className="mt-4 overflow-hidden rounded-3xl border border-sky-100 bg-[#eaf4f6] p-4">
              <div className="mb-3 inline-flex rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-semibold text-cyan-800">
                Vista Gantt de actividades por hito
              </div>

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
                    {sortedHitos.map((hito, idx) => {
                      const actividades = [...(actividadesByHito[hito.id] ?? [])].sort((a, b) => a.orden - b.orden);
                      const isExpanded = expandedHitos.has(hito.id);

                      return (
                        <motion.div key={hito.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                          <button
                            type="button"
                            className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                            onClick={() => {
                              setExpandedHitos((prev) => {
                                const next = new Set(prev);
                                if (next.has(hito.id)) next.delete(hito.id);
                                else next.add(hito.id);
                                return next;
                              });
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{hito.nombre}</p>
                                <p className="mt-0.5 text-[11px] text-slate-500">{hito.descripcion}</p>
                                <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                                  {hito.estado.replace("_", " ")} · {new Date(hito.fechaInicio).toLocaleDateString()} - {new Date(hito.fechaFin).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                {isExpanded ? "Ocultar" : "Ver"} ({actividades.length})
                              </div>
                            </div>
                          </button>

                          {isExpanded && (
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
                              const rowComments = [...(comentariosByActividad[actividad.id] ?? [])].sort(
                                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
                              );

                              return (
                                <div key={actividad.id} className="grid grid-cols-[240px_1fr] items-center gap-3">
                                  <button
                                    type="button"
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                                    onClick={() => setSelectedActivityId(actividad.id)}
                                  >
                                    <p className="text-xs font-semibold text-slate-800">{actividad.nombre}</p>
                                    <p className="mt-0.5 text-[11px] text-slate-500">{actividad.descripcion}</p>
                                  </button>

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
                                      className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${barColor} ${canComment ? "cursor-pointer hover:brightness-110" : ""}`}
                                      style={{ left: `${Math.max(0, Math.min(100, left))}%`, width: `${Math.min(100 - left, width)}%` }}
                                      onClick={canComment ? (e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const ratio = (e.clientX - rect.left) / rect.width;
                                        const clickTime = ganttStart.getTime() + ratio * ganttDurationMs;
                                        setSelectedFiscClickDate(new Date(clickTime));
                                        setSelectedFiscActividadId(actividad.id);
                                        setSelectedFiscActividadNombre(actividad.nombre);
                                      } : undefined}
                                    />

                                    {rowComments.map((comment) => {
                                      const commentTime = new Date(comment.fechaInspeccion ?? comment.createdAt).getTime();
                                      const commentLeft = ((commentTime - ganttStart.getTime()) / ganttDurationMs) * 100;
                                      const isSelected = selectedCommentId === comment.id;

                                      return (
                                        <button
                                          key={comment.id}
                                          className={getSeverityPointClasses(comment.severidad, isSelected)}
                                          style={{ left: `${Math.max(0, Math.min(100, commentLeft))}%` }}
                                          title="Abrir reporte fiscalizador"
                                          onClick={() => setSelectedCommentId(isSelected ? null : comment.id)}
                                        >
                                          <span className="text-[10px] font-black leading-none text-white">{getSeverityGlyph(comment.severidad)}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
                <p className="font-semibold text-slate-700">Leyenda de fiscalización</p>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-slate-600">
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> Burbuja comentario</span>
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Comentario seleccionado</span>
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-6 rounded-full bg-emerald-500" /> Hito completado</span>
                  <span className="inline-flex items-center gap-2"><span className="h-2.5 w-6 rounded-full bg-amber-400" /> Hito en proceso</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Haz clic en una burbuja para abrir el reporte fiscalizador en popup.
                </p>
              </div>

              {legendComments.length > 0 && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white/95 p-3 text-xs shadow">
                  <p className="mb-2 font-semibold text-slate-700">Actividad reciente</p>
                  <div className="space-y-1.5">
                    {legendComments.map((item, idx) => (
                      <p key={item.id} className="flex items-center gap-2 text-slate-600">
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${
                            idx === 0 ? "bg-emerald-500" : idx === 1 ? "bg-amber-400" : "bg-rose-500"
                          }`}
                        />
                        <span className="truncate">{item.texto}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
              </div>
            )}


            {selectedFiscActividadId && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
                onClick={() => setSelectedFiscActividadId(null)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.18 }}
                  className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Registrar fiscalización</p>
                      <p className="text-[11px] text-slate-500">{selectedFiscActividadNombre}</p>
                    </div>
                    <button
                      className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600"
                      onClick={() => setSelectedFiscActividadId(null)}
                    >
                      Cerrar
                    </button>
                  </div>
                  <div className="px-4 py-4">
                    <CommentForm
                      onSubmit={async (texto, severidad, file) => {
                        await enviarComentario(selectedFiscActividadId, texto, severidad, file, selectedFiscClickDate);
                        setSelectedFiscActividadId(null);
                      }}
                    />
                  </div>
                </motion.div>
              </div>
            )}

            {selectedComment && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4"
                onClick={() => setSelectedCommentId(null)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.18 }}
                  className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Reporte fiscalizador</p>
                      <p className="text-[11px] text-slate-500">{new Date(selectedComment.createdAt).toLocaleString()}</p>
                    </div>
                    <button className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600" onClick={() => setSelectedCommentId(null)}>
                      Cerrar
                    </button>
                  </div>

                  {selectedComment.evidencias[0] ? (
                    <a href={selectedComment.evidencias[0].url} target="_blank" rel="noreferrer">
                      <img src={selectedComment.evidencias[0].url} alt="Evidencia fiscalizador" className="h-72 w-full object-cover" />
                    </a>
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-slate-100 text-xs text-slate-500">Sin evidencia visual adjunta</div>
                  )}

                  <div className="space-y-2 px-4 py-3 text-sm text-slate-700">
                    <p className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      {selectedComment.tipo}
                    </p>
                    <p>{selectedComment.texto}</p>
                    <div className="pt-1 text-[11px] text-slate-500">
                      Tx:{" "}
                      {selectedComment.txSignature ? (
                        <a
                          href={`https://solscan.io/tx/${selectedComment.txSignature}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
                          title="Abrir en Solscan"
                        >
                          {selectedComment.txSignature.slice(0, 6)}...{selectedComment.txSignature.slice(-6)}
                        </a>
                      ) : (
                        "N/D"
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {selectedActivity && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
                onClick={() => setSelectedActivityId(null)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.18 }}
                  className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{selectedActivity.nombre}</p>
                      <p className="text-[11px] text-slate-500">Timeline de fiscalizaciones</p>
                    </div>
                    <button
                      className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600"
                      onClick={() => setSelectedActivityId(null)}
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="space-y-3 px-4 py-4">
                    <p className="text-xs text-slate-600">{selectedActivity.descripcion}</p>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      {(() => {
                        const activityStart = new Date(selectedActivity.fechaInicio).getTime();
                        const activityEnd = new Date(selectedActivity.fechaFin).getTime();
                        const duration = Math.max(1, activityEnd - activityStart);
                        const days = Math.max(1, Math.ceil(duration / (1000 * 60 * 60 * 24)));
                        const timelineWidthPx = Math.min(4000, Math.max(980, Math.round(days * 40)));
                        const divisions = 10;
                        const ticks = Array.from({ length: divisions + 1 }, (_, idx) => {
                          const ratio = idx / divisions;
                          const time = activityStart + ratio * duration;
                          return { key: idx, left: `${ratio * 100}%`, label: new Date(time).toLocaleDateString() };
                        });
                        const comments = [...(comentariosByActividad[selectedActivity.id] ?? [])].sort(
                          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
                        );

                        const bucketCounts = new Map<number, number>();
                        return (
                          <div className="overflow-x-auto">
                            <div className="space-y-3" style={{ width: timelineWidthPx }}>
                              <div className="relative h-10">
                                {ticks.map((tick) => (
                                  <div key={tick.key} className="absolute top-0 -translate-x-1/2" style={{ left: tick.left }}>
                                    <p className="text-[10px] text-slate-500">{tick.label}</p>
                                    <span className="mx-auto mt-1 block h-1.5 w-1.5 rounded-full bg-slate-300" />
                                  </div>
                                ))}
                              </div>

                              <div className="relative h-20 rounded-xl bg-slate-50 px-2">
                                <div className="absolute left-2 right-2 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200" />

                                {comments.map((comment) => {
                                  const commentTime = new Date(comment.fechaInspeccion ?? comment.createdAt).getTime();
                                  const rawLeft = ((commentTime - activityStart) / duration) * 100;
                                  const left = Math.max(0, Math.min(100, rawLeft));
                                  const bucket = Math.round(left);
                                  const count = bucketCounts.get(bucket) ?? 0;
                                  bucketCounts.set(bucket, count + 1);
                                  const yOffset = (count % 3) * 18 - 18;
                                  const isSelected = selectedCommentId === comment.id;

                                  return (
                                    <button
                                      key={comment.id}
                                      className={getSeverityPointClasses(comment.severidad, isSelected)}
                                      style={{ left: `${left}%`, marginTop: yOffset }}
                                      title="Abrir reporte fiscalizador"
                                      onClick={() => setSelectedCommentId(isSelected ? null : comment.id)}
                                    >
                                      <span className="text-[10px] font-black leading-none text-white">{getSeverityGlyph(comment.severidad)}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function CommentForm({ onSubmit }: { onSubmit: (texto: string, severidad: "LEVE" | "MODERADO" | "GRAVE", file?: File | null) => Promise<void> }) {
  const [texto, setTexto] = useState("");
  const [severidad, setSeveridad] = useState<"LEVE" | "MODERADO" | "GRAVE">("LEVE");
  const [file, setFile] = useState<File | null>(null);

  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(texto, severidad, file);
        setTexto("");
        setSeveridad("LEVE");
        setFile(null);
      }}
    >
      <input
        className="w-full rounded border bg-white px-2 py-1 text-xs"
        placeholder="Comentario de avance"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSeveridad("LEVE")}
          className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
            severidad === "LEVE" ? "bg-yellow-500 text-white" : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
          }`}
        >
          Leve
        </button>
        <button
          type="button"
          onClick={() => setSeveridad("MODERADO")}
          className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
            severidad === "MODERADO" ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-700 hover:bg-blue-200"
          }`}
        >
          Moderado
        </button>
        <button
          type="button"
          onClick={() => setSeveridad("GRAVE")}
          className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
            severidad === "GRAVE" ? "bg-red-500 text-white" : "bg-red-100 text-red-700 hover:bg-red-200"
          }`}
        >
          Grave
        </button>
      </div>
      <input className="w-full text-xs" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button className="w-full rounded bg-brand-700 px-2 py-1 text-xs text-white">Enviar evidencia</button>
    </form>
  );
}
