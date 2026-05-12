"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import QRCode from "react-qr-code";
import type { Actividad, Comentario, Hito, Obra, ObraGeneral, UserSession } from "../../types/index.js";
import { apiFetch, API_BASE } from "../../lib/api";

export default function MisObrasPage() {
  const router = useRouter();

  const [session, setSession] = useState<UserSession | null>(null);
  const [ready, setReady] = useState(false);

  const [obras, setObras] = useState<Obra[]>([]);
  const [selectedObra, setSelectedObra] = useState<string>("");
  const [selectedObraGeneral, setSelectedObraGeneral] = useState<ObraGeneral | null>(null);
  const [showObraMore, setShowObraMore] = useState(false);
  const [obraSearch, setObraSearch] = useState("");
  const [hitos, setHitos] = useState<Hito[]>([]);
  const [actividadesByHito, setActividadesByHito] = useState<Record<string, Actividad[]>>({});
  const [comentariosByActividad, setComentariosByActividad] = useState<Record<string, Comentario[]>>({});
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [selectedFiscClickDate, setSelectedFiscClickDate] = useState<Date | undefined>(undefined);
  const [expandedHitos, setExpandedHitos] = useState<Set<string>>(new Set());
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  const [showCreateHito, setShowCreateHito] = useState(false);
  const [isCreatingHito, setIsCreatingHito] = useState(false);
  const [createHitoError, setCreateHitoError] = useState<string | null>(null);
  const [showCreateActividad, setShowCreateActividad] = useState(false);
  const [isCreatingActividad, setIsCreatingActividad] = useState(false);
  const [createActividadError, setCreateActividadError] = useState<string | null>(null);

  const [hitoForm, setHitoForm] = useState({ nombre: "", descripcion: "", fechaInicio: "", fechaFin: "", orden: "" });
  const [actividadForm, setActividadForm] = useState({ hitoId: "", nombre: "", descripcion: "", fechaInicio: "", fechaFin: "", orden: "" });

  const [qrCopied, setQrCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = localStorage.getItem("civilis_session");
    if (!raw) { router.replace("/login"); return; }
    try {
      const s: UserSession = JSON.parse(raw);
      if (s.user.rol === "CIUDADANO") { router.replace("/login"); return; }
      setSession(s);
      apiFetch<Obra[]>("/obras", {}, s.token).then(setObras).catch(() => {});
    } catch {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  const canCreateObra = session?.user.rol === "ADMIN";
  const canComment = session?.user.rol === "FISCALIZADOR";

  function toFriendlyApiError(rawError: unknown): string {
    const fallback = "No se pudo completar la operación.";
    if (!(rawError instanceof Error)) return fallback;
    const rawMessage = rawError.message || fallback;
    let extracted = rawMessage;
    try {
      const parsed = JSON.parse(rawMessage) as { message?: string };
      if (typeof parsed.message === "string") extracted = parsed.message;
    } catch { extracted = rawMessage; }
    if (extracted.includes("Unique constraint failed") && extracted.includes("obraId") && extracted.includes("orden"))
      return "El orden del hito ya existe en esta obra. Usa otro número de orden.";
    if (extracted.includes("Unique constraint failed") && extracted.includes("hitoId") && extracted.includes("orden"))
      return "El orden de la actividad ya existe en este hito. Usa otro número de orden.";
    return extracted;
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

  async function crearHito() {
    if (!session || !selectedObra) return;
    const ordenNumerico = Number(hitoForm.orden);
    if (!hitoForm.nombre || !hitoForm.descripcion || !hitoForm.fechaInicio || !hitoForm.fechaFin || !Number.isInteger(ordenNumerico) || ordenNumerico <= 0) {
      setCreateHitoError("Completa todos los datos del hito con valores válidos."); return;
    }
    if (hitos.some((h) => h.orden === ordenNumerico)) {
      setCreateHitoError("Ese orden de hito ya existe para la obra seleccionada."); return;
    }
    setIsCreatingHito(true); setCreateHitoError(null);
    try {
      await apiFetch<Hito>("/hitos", {
        method: "POST",
        body: JSON.stringify({
          obraId: selectedObra, nombre: hitoForm.nombre, descripcion: hitoForm.descripcion,
          fechaInicio: new Date(`${hitoForm.fechaInicio}T00:00:00`).toISOString(),
          fechaFin: new Date(`${hitoForm.fechaFin}T00:00:00`).toISOString(),
          orden: ordenNumerico,
        }),
      }, session.token);
      await loadObraDetail(selectedObra, undefined, session.token);
      setHitoForm({ nombre: "", descripcion: "", fechaInicio: "", fechaFin: "", orden: "" });
      setShowCreateHito(false);
    } catch (e) { setCreateHitoError(toFriendlyApiError(e)); }
    finally { setIsCreatingHito(false); }
  }

  async function crearActividad() {
    if (!session || !selectedObra) return;
    const ordenNumerico = Number(actividadForm.orden);
    if (!actividadForm.hitoId || !actividadForm.nombre || !actividadForm.descripcion || !actividadForm.fechaInicio || !actividadForm.fechaFin || !Number.isInteger(ordenNumerico) || ordenNumerico <= 0) {
      setCreateActividadError("Completa todos los datos de la actividad con valores válidos."); return;
    }
    if ((actividadesByHito[actividadForm.hitoId] ?? []).some((a) => a.orden === ordenNumerico)) {
      setCreateActividadError("Ese orden de actividad ya existe para el hito seleccionado."); return;
    }
    setIsCreatingActividad(true); setCreateActividadError(null);
    try {
      await apiFetch<Actividad>(`/hitos/${actividadForm.hitoId}/actividades`, {
        method: "POST",
        body: JSON.stringify({
          nombre: actividadForm.nombre, descripcion: actividadForm.descripcion,
          fechaInicio: new Date(`${actividadForm.fechaInicio}T00:00:00`).toISOString(),
          fechaFin: new Date(`${actividadForm.fechaFin}T00:00:00`).toISOString(),
          orden: ordenNumerico,
        }),
      }, session.token);
      await loadObraDetail(selectedObra, undefined, session.token);
      setActividadForm((prev) => ({ ...prev, nombre: "", descripcion: "", fechaInicio: "", fechaFin: "", orden: "" }));
      setShowCreateActividad(false);
    } catch (e) { setCreateActividadError(toFriendlyApiError(e)); }
    finally { setIsCreatingActividad(false); }
  }

  async function enviarComentario(actividadId: string, texto: string, severidad: "LEVE" | "MODERADO" | "GRAVE", file?: File | null, fechaInspeccion?: Date) {
    if (!session || !texto || session.user.rol !== "FISCALIZADOR") return;
    const form = new FormData();
    form.append("texto", texto); form.append("tipo", "AVANCE"); form.append("severidad", severidad);
    if (file) form.append("evidencia", file);
    if (fechaInspeccion) form.append("fechaInspeccion", fechaInspeccion.toISOString());
    const response = await fetch(`${API_BASE}/actividades/${actividadId}/comentarios`, {
      method: "POST", headers: { Authorization: `Bearer ${session.token}` }, body: form,
    });
    if (!response.ok) throw new Error(await response.text());
    await loadObraDetail(selectedObra);
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
  const nextHitoOrden = useMemo(() => hitos.reduce((max, h) => Math.max(max, h.orden), 0) + 1, [hitos]);
  const allActividades = useMemo(
    () => sortedHitos.flatMap((h) => actividadesByHito[h.id] ?? []).sort((a, b) => a.orden - b.orden),
    [sortedHitos, actividadesByHito],
  );
  const nextActividadOrden = useMemo(() => {
    const hitoId = actividadForm.hitoId || sortedHitos[0]?.id;
    if (!hitoId) return 1;
    return (actividadesByHito[hitoId] ?? []).reduce((max, a) => Math.max(max, a.orden), 0) + 1;
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
    const flat = Object.values(comentariosByActividad as Record<string, Comentario[]>).flat();
    return flat.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [comentariosByActividad]);

  const legendComments = orderedComments.slice(0, 3);
  const presupuestoM = selectedObraGeneral ? `$${(selectedObraGeneral.valor / 1_000_000).toFixed(1)}M` : "-";
  const responsibleEntity = selectedObraGeneral?.actores[0]?.organizacion ?? selectedObraGeneral?.encargado ?? "Sin definir";
  const selectedComment = orderedComments.find((c) => c.id === selectedCommentId) ?? null;
  const obraShareUrl = selectedObra ? `https://civilis.cl/?obra=${selectedObra}` : "";

  const selectedActivity = useMemo(() => {
    if (!selectedActivityId) return null;
    return allActividades.find((a) => a.id === selectedActivityId) ?? null;
  }, [allActividades, selectedActivityId]);

  const ganttStart = useMemo(() => {
    if (allActividades.length === 0) return selectedWork ? new Date(selectedWork.fechaInicio) : new Date();
    return new Date(Math.min(...allActividades.map((a) => new Date(a.fechaInicio).getTime())));
  }, [allActividades, selectedWork]);

  const ganttEnd = useMemo(() => {
    if (allActividades.length === 0) return selectedWork ? new Date(selectedWork.fechaFin) : new Date();
    return new Date(Math.max(...allActividades.map((a) => new Date(a.fechaFin).getTime())));
  }, [allActividades, selectedWork]);

  const ganttDurationMs = Math.max(1, ganttEnd.getTime() - ganttStart.getTime());
  const timelineTicks = useMemo(() => {
    return Array.from({ length: 9 }, (_, i) => {
      const ratio = i / 8;
      return { key: i, left: `${ratio * 100}%`, label: new Date(ganttStart.getTime() + ratio * ganttDurationMs).toLocaleDateString() };
    });
  }, [ganttStart, ganttDurationMs]);

  function getSeverityPointClasses(severidad: "LEVE" | "MODERADO" | "GRAVE", isSelected: boolean): string {
    const base = "absolute top-1/2 z-20 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow";
    const sel = isSelected ? " ring-2 ring-slate-200" : "";
    if (severidad === "LEVE") return `${base} bg-yellow-500${sel}`;
    if (severidad === "MODERADO") return `${base} bg-blue-500${sel}`;
    return `${base} bg-red-500${sel}`;
  }

  function getSeverityGlyph(severidad: "LEVE" | "MODERADO" | "GRAVE"): string {
    return severidad === "MODERADO" ? "i" : "!";
  }

  function handleCopyObraLink() {
    if (!obraShareUrl) return;
    void navigator.clipboard.writeText(obraShareUrl).then(() => { setQrCopied(true); setTimeout(() => setQrCopied(false), 2000); });
  }

  function handleDownloadQR() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 256, 256); ctx.drawImage(img, 0, 0, 256, 256);
      const link = document.createElement("a");
      link.download = `qr-obra-${selectedObra}.png`; link.href = canvas.toDataURL("image/png"); link.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
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
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            onClick={() => router.push("/")}
          >
            ← Inicio
          </button>
          <div>
            <h1 className="text-base font-semibold text-slate-900">Mis Obras</h1>
            <p className="text-xs text-slate-500">{session?.user.nombre} · {session?.user.rol}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canCreateObra && (
            <button
              className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm text-cyan-800 hover:bg-cyan-100"
              onClick={() => router.push("/nueva-obra")}
            >
              + Agregar obra
            </button>
          )}
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={() => { localStorage.removeItem("civilis_session"); router.push("/login"); }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[1240px] space-y-5 p-4 md:p-6">

        {/* Formularios hito / actividad */}
        {canCreateObra && selectedObra && (
          <div className="grid gap-3 md:grid-cols-2">
            {/* Nuevo hito */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">Agregar hito a la obra</p>
                <button
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  onClick={() => { setShowCreateHito((v) => !v); setHitoForm((p) => ({ ...p, orden: p.orden || String(nextHitoOrden) })); }}
                >
                  {showCreateHito ? "Ocultar" : "Nuevo hito"}
                </button>
              </div>
              {showCreateHito && (
                <div className="mt-3 grid gap-2">
                  <input className="rounded border bg-slate-50 p-2 text-sm" placeholder="Nombre del hito" value={hitoForm.nombre} onChange={(e) => setHitoForm((p) => ({ ...p, nombre: e.target.value }))} />
                  <textarea className="rounded border bg-slate-50 p-2 text-sm" placeholder="Descripción" rows={2} value={hitoForm.descripcion} onChange={(e) => setHitoForm((p) => ({ ...p, descripcion: e.target.value }))} />
                  <div className="grid gap-2 md:grid-cols-3">
                    <input className="rounded border bg-slate-50 p-2 text-sm" type="date" value={hitoForm.fechaInicio} onChange={(e) => setHitoForm((p) => ({ ...p, fechaInicio: e.target.value }))} />
                    <input className="rounded border bg-slate-50 p-2 text-sm" type="date" value={hitoForm.fechaFin} onChange={(e) => setHitoForm((p) => ({ ...p, fechaFin: e.target.value }))} />
                    <input className="rounded border bg-slate-50 p-2 text-sm" type="number" min={1} placeholder="Orden" value={hitoForm.orden} onChange={(e) => setHitoForm((p) => ({ ...p, orden: e.target.value }))} />
                  </div>
                  <p className="text-[11px] text-slate-500">Sugerido: {nextHitoOrden}</p>
                  {createHitoError && <p className="text-xs text-rose-600">{createHitoError}</p>}
                  <div className="flex justify-end">
                    <button className="rounded bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-60" onClick={crearHito} disabled={isCreatingHito}>
                      {isCreatingHito ? "Guardando..." : "Crear hito"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Nueva actividad */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">Agregar actividad a hito</p>
                <button
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  onClick={() => { setShowCreateActividad((v) => !v); setActividadForm((p) => ({ ...p, hitoId: p.hitoId || sortedHitos[0]?.id || "", orden: p.orden || String(nextActividadOrden) })); }}
                >
                  {showCreateActividad ? "Ocultar" : "Nueva actividad"}
                </button>
              </div>
              {showCreateActividad && (
                <div className="mt-3 grid gap-2">
                  <select className="rounded border bg-slate-50 p-2 text-sm" value={actividadForm.hitoId} onChange={(e) => {
                    const id = e.target.value;
                    const next = ((actividadesByHito[id] ?? []).reduce((max, a) => Math.max(max, a.orden), 0) + 1).toString();
                    setActividadForm((p) => ({ ...p, hitoId: id, orden: p.orden || next }));
                  }}>
                    <option value="">Selecciona hito</option>
                    {sortedHitos.map((h) => <option key={h.id} value={h.id}>{h.orden}. {h.nombre}</option>)}
                  </select>
                  <input className="rounded border bg-slate-50 p-2 text-sm" placeholder="Nombre de la actividad" value={actividadForm.nombre} onChange={(e) => setActividadForm((p) => ({ ...p, nombre: e.target.value }))} />
                  <textarea className="rounded border bg-slate-50 p-2 text-sm" placeholder="Descripción" rows={2} value={actividadForm.descripcion} onChange={(e) => setActividadForm((p) => ({ ...p, descripcion: e.target.value }))} />
                  <div className="grid gap-2 md:grid-cols-3">
                    <input className="rounded border bg-slate-50 p-2 text-sm" type="date" value={actividadForm.fechaInicio} onChange={(e) => setActividadForm((p) => ({ ...p, fechaInicio: e.target.value }))} />
                    <input className="rounded border bg-slate-50 p-2 text-sm" type="date" value={actividadForm.fechaFin} onChange={(e) => setActividadForm((p) => ({ ...p, fechaFin: e.target.value }))} />
                    <input className="rounded border bg-slate-50 p-2 text-sm" type="number" min={1} placeholder="Orden" value={actividadForm.orden} onChange={(e) => setActividadForm((p) => ({ ...p, orden: e.target.value }))} />
                  </div>
                  <p className="text-[11px] text-slate-500">Sugerido: {nextActividadOrden}</p>
                  {createActividadError && <p className="text-xs text-rose-600">{createActividadError}</p>}
                  <div className="flex justify-end">
                    <button className="rounded bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-60" onClick={crearActividad} disabled={isCreatingActividad}>
                      {isCreatingActividad ? "Guardando..." : "Crear actividad"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Buscador de obras */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="rounded-2xl border border-sky-100 bg-[#f5fbfd] p-4">
            <div className="mx-auto w-full max-w-xl">
              <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">Buscar obra</p>
              <div className="relative mt-2">
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                  placeholder="Escribe el nombre de una obra..."
                  value={obraSearch}
                  onChange={(e) => setObraSearch(e.target.value)}
                />
                {filteredObras.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                    <div className="max-h-80 overflow-y-auto p-1">
                      {filteredObras.map((obra) => (
                        <button key={obra.id} type="button" className="w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50"
                          onClick={async () => { await loadObraDetail(obra.id); setObraSearch(obra.nombre); }}>
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
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{selectedWork.nombre}</p>
                      <p className="mt-1 text-xs text-slate-600">{selectedWork.ubicacion}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{selectedWork.estado.replace("_", " ")}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">${(selectedWork.valor / 1_000_000).toFixed(1)}M</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Avance: {progressByHitos}%</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Esperado: {progressByTime}%</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-2">
                      {obraShareUrl && (
                        <div className="rounded-lg border border-slate-200 bg-white p-2">
                          <QRCode value={obraShareUrl} size={80} />
                        </div>
                      )}
                      <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => { void loadObraDetail(selectedWork.id); setShowObraMore(true); }}>
                        Ver más
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Gantt */}
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
                          <button type="button" className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                            onClick={() => setExpandedHitos((prev) => { const next = new Set(prev); next.has(hito.id) ? next.delete(hito.id) : next.add(hito.id); return next; })}>
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
                                const barColor = actividad.estado === "COMPLETADO" ? "bg-emerald-500" : actividad.estado === "EN_PROGRESO" ? "bg-amber-400" : "bg-cyan-500";
                                const rowComments = [...(comentariosByActividad[actividad.id] ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                                return (
                                  <div key={actividad.id} className="grid grid-cols-[240px_1fr] items-center gap-3">
                                    <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50" onClick={() => setSelectedActivityId(actividad.id)}>
                                      <p className="text-xs font-semibold text-slate-800">{actividad.nombre}</p>
                                      <p className="mt-0.5 text-[11px] text-slate-500">{actividad.descripcion}</p>
                                    </button>
                                    <div className="relative h-14 rounded-xl border border-slate-200 bg-white/90 px-2">
                                      {timelineTicks.map((tick) => <span key={`l-${actividad.id}-${tick.key}`} className="absolute bottom-2 top-2 w-px bg-slate-100" style={{ left: tick.left }} />)}
                                      <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200" />
                                      <div className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${barColor}`} style={{ left: `${Math.max(0, Math.min(100, left))}%`, width: `${Math.min(100 - left, width)}%` }} />
                                      {rowComments.map((comment) => {
                                        const ct = new Date(comment.fechaInspeccion ?? comment.createdAt).getTime();
                                        const cl = ((ct - ganttStart.getTime()) / ganttDurationMs) * 100;
                                        const isSel = selectedCommentId === comment.id;
                                        return (
                                          <button key={comment.id} className={getSeverityPointClasses(comment.severidad, isSel)} style={{ left: `${Math.max(0, Math.min(100, cl))}%` }}
                                            title="Abrir reporte fiscalizador" onClick={() => setSelectedCommentId(isSel ? null : comment.id)}>
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
              </div>

              {legendComments.length > 0 && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white/95 p-3 text-xs shadow">
                  <p className="mb-2 font-semibold text-slate-700">Actividad reciente</p>
                  <div className="space-y-1.5">
                    {legendComments.map((item, i) => (
                      <p key={item.id} className="flex items-center gap-2 text-slate-600">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-emerald-500" : i === 1 ? "bg-amber-400" : "bg-rose-500"}`} />
                        <span className="truncate">{item.texto}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Modal: detalle obra */}
      {showObraMore && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setShowObraMore(false)}>
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.18 }}
            className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Detalle de obra</p>
                <p className="text-[11px] text-slate-500">{selectedWork?.nombre ?? ""}</p>
              </div>
              <button className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600" onClick={() => setShowObraMore(false)}>Cerrar</button>
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Ubicación</p><p className="mt-1 text-sm font-semibold text-slate-800">{selectedObraGeneral?.ubicacion ?? "-"}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Presupuesto</p><p className="mt-1 text-sm font-semibold text-slate-800">{presupuestoM}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Avance Total</p><p className="mt-1 text-sm font-semibold text-slate-800">{progressByHitos}%</p><p className="text-[11px] text-slate-500">Esperado: {progressByTime}%</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Entidad Responsable</p><p className="mt-1 text-sm font-semibold text-slate-800">{responsibleEntity}</p></div>
            </div>
            {obraShareUrl && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                <p className="mb-3 text-[11px] uppercase tracking-wide text-slate-500">Acceso directo a esta obra</p>
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                  <div ref={qrRef} className="shrink-0 rounded-xl border border-slate-200 bg-white p-3"><QRCode value={obraShareUrl} size={120} /></div>
                  <div className="flex flex-1 flex-col gap-2">
                    <p className="text-xs text-slate-600">Escanea el QR para ir directamente a esta obra en <span className="font-semibold">civilis.cl</span></p>
                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <p className="flex-1 truncate font-mono text-[10px] text-slate-500">{obraShareUrl}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleCopyObraLink} className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">{qrCopied ? "¡Copiado!" : "Copiar enlace"}</button>
                      <button type="button" onClick={handleDownloadQR} className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Descargar QR</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Modal: comentario seleccionado */}
      {selectedComment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setSelectedCommentId(null)}>
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.18 }}
            className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div><p className="text-sm font-semibold text-slate-800">Reporte fiscalizador</p><p className="text-[11px] text-slate-500">{new Date(selectedComment.createdAt).toLocaleString()}</p></div>
              <button className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600" onClick={() => setSelectedCommentId(null)}>Cerrar</button>
            </div>
            {selectedComment.evidencias[0] ? (
              <a href={selectedComment.evidencias[0].url} target="_blank" rel="noreferrer">
                <img src={selectedComment.evidencias[0].url} alt="Evidencia" className="h-72 w-full object-cover" />
              </a>
            ) : (
              <div className="flex h-40 items-center justify-center bg-slate-100 text-xs text-slate-500">Sin evidencia visual adjunta</div>
            )}
            <div className="space-y-2 px-4 py-3 text-sm text-slate-700">
              <p className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{selectedComment.tipo}</p>
              <p>{selectedComment.texto}</p>
              <div className="pt-1 text-[11px] text-slate-500">
                Tx:{" "}
                {selectedComment.txSignature ? (
                  <a href={`https://solscan.io/tx/${selectedComment.txSignature}?cluster=devnet`} target="_blank" rel="noreferrer" className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800">
                    {selectedComment.txSignature.slice(0, 6)}...{selectedComment.txSignature.slice(-6)}
                  </a>
                ) : "N/D"}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: actividad seleccionada */}
      {selectedActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => { setSelectedActivityId(null); setSelectedFiscClickDate(undefined); }}>
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.18 }}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
              <div><p className="text-sm font-semibold text-slate-800">{selectedActivity.nombre}</p><p className="text-[11px] text-slate-500">Progreso y fiscalizaciones</p></div>
              <button className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600" onClick={() => { setSelectedActivityId(null); setSelectedFiscClickDate(undefined); }}>Cerrar</button>
            </div>
            <div className="overflow-y-auto">
              <div className="space-y-3 px-4 py-4">
                <p className="text-xs text-slate-600">{selectedActivity.descripcion}</p>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  {(() => {
                    const actStart = new Date(selectedActivity.fechaInicio).getTime();
                    const actEnd = new Date(selectedActivity.fechaFin).getTime();
                    const duration = Math.max(1, actEnd - actStart);
                    const days = Math.max(1, Math.ceil(duration / (1000 * 60 * 60 * 24)));
                    const timelineW = Math.min(4000, Math.max(980, Math.round(days * 40)));
                    const ticks = Array.from({ length: 11 }, (_, i) => ({ key: i, left: `${(i / 10) * 100}%`, label: new Date(actStart + (i / 10) * duration).toLocaleDateString() }));
                    const comments = [...(comentariosByActividad[selectedActivity.id] ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                    const buckets = new Map<number, number>();
                    return (
                      <div className="overflow-x-auto">
                        <div className="space-y-3" style={{ width: timelineW }}>
                          <div className="relative h-10">
                            {ticks.map((tick) => (
                              <div key={tick.key} className="absolute top-0 -translate-x-1/2" style={{ left: tick.left }}>
                                <p className="text-[10px] text-slate-500">{tick.label}</p>
                                <span className="mx-auto mt-1 block h-1.5 w-1.5 rounded-full bg-slate-300" />
                              </div>
                            ))}
                          </div>
                          <div className={`relative h-20 rounded-xl bg-slate-50 px-2 ${canComment ? "cursor-crosshair" : ""}`}
                            onClick={canComment ? (e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setSelectedFiscClickDate(new Date(actStart + ((e.clientX - rect.left) / rect.width) * duration));
                            } : undefined}>
                            <div className="absolute left-2 right-2 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200" />
                            {comments.map((comment) => {
                              const ct = new Date(comment.fechaInspeccion ?? comment.createdAt).getTime();
                              const cl = Math.max(0, Math.min(100, ((ct - actStart) / duration) * 100));
                              const bucket = Math.round(cl);
                              const cnt = buckets.get(bucket) ?? 0; buckets.set(bucket, cnt + 1);
                              const isSel = selectedCommentId === comment.id;
                              return (
                                <button key={comment.id} className={getSeverityPointClasses(comment.severidad, isSel)} style={{ left: `${cl}%`, marginTop: (cnt % 3) * 18 - 18 }}
                                  onClick={(e) => { e.stopPropagation(); setSelectedCommentId(isSel ? null : comment.id); }}>
                                  <span className="text-[10px] font-black leading-none text-white">{getSeverityGlyph(comment.severidad)}</span>
                                </button>
                              );
                            })}
                          </div>
                          {canComment && <p className="text-[10px] text-slate-400">Haz clic en el timeline para registrar una fiscalización en esa fecha</p>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: registrar fiscalización */}
      {selectedFiscClickDate && selectedActivity && canComment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setSelectedFiscClickDate(undefined)}>
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.18 }}
            className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Registrar fiscalización</p>
                <p className="text-[11px] text-slate-500">{selectedActivity.nombre} · {selectedFiscClickDate.toLocaleDateString()}</p>
              </div>
              <button className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600" onClick={() => setSelectedFiscClickDate(undefined)}>Cerrar</button>
            </div>
            <div className="px-4 py-4">
              <CommentForm onSubmit={async (texto, severidad, file) => {
                await enviarComentario(selectedActivity.id, texto, severidad, file, selectedFiscClickDate);
                setSelectedFiscClickDate(undefined);
              }} />
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}

function CommentForm({ onSubmit }: { onSubmit: (texto: string, severidad: "LEVE" | "MODERADO" | "GRAVE", file?: File | null) => Promise<void> }) {
  const [texto, setTexto] = useState("");
  const [severidad, setSeveridad] = useState<"LEVE" | "MODERADO" | "GRAVE">("LEVE");
  const [file, setFile] = useState<File | null>(null);
  return (
    <form className="mt-3 space-y-2" onSubmit={async (e) => { e.preventDefault(); await onSubmit(texto, severidad, file); setTexto(""); setSeveridad("LEVE"); setFile(null); }}>
      <input className="w-full rounded border bg-white px-2 py-1 text-xs" placeholder="Comentario de avance" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className="flex gap-2">
        {(["LEVE", "MODERADO", "GRAVE"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setSeveridad(s)}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${severidad === s
              ? s === "LEVE" ? "bg-yellow-500 text-white" : s === "MODERADO" ? "bg-blue-500 text-white" : "bg-red-500 text-white"
              : s === "LEVE" ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" : s === "MODERADO" ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-red-100 text-red-700 hover:bg-red-200"}`}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <input type="file" accept="image/*,video/*" className="w-full rounded border bg-white px-2 py-1 text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button type="submit" className="w-full rounded bg-slate-800 py-1.5 text-xs font-semibold text-white hover:bg-slate-700" disabled={!texto.trim()}>
        Enviar fiscalización
      </button>
    </form>
  );
}
