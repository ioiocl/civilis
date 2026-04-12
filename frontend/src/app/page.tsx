"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import QRCode from "react-qr-code";
import type { Actividad, Comentario, Hito, Obra, ObraGeneral, UserSession, Notificacion, RespuestaComentario } from "../types/index.js";
import { apiFetch, API_BASE } from "../lib/api";

export default function HomePage() {
  const searchParams = useSearchParams();
  const [obras, setObras] = useState<Obra[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<UserSession | null>(null);
  const [hitos, setHitos] = useState<Hito[]>([]);
  const [actividadesByHito, setActividadesByHito] = useState<Record<string, Actividad[]>>({});
  const [comentariosByActividad, setComentariosByActividad] = useState<Record<string, Comentario[]>>({});
  const [selectedObraGeneral, setSelectedObraGeneral] = useState<ObraGeneral | null>(null);
  const [obraSearch, setObraSearch] = useState("");
  const [expandedHitos, setExpandedHitos] = useState<Set<string>>(new Set());
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [selectedFiscClickDate, setSelectedFiscClickDate] = useState<Date | undefined>(undefined);
  const [qrCopied, setQrCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [respuestaTexto, setRespuestaTexto] = useState("");
  const [showRespuestaForm, setShowRespuestaForm] = useState(false);
  const [showObraMore, setShowObraMore] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showContacto, setShowContacto] = useState(false);
  const [showAcercaDe, setShowAcercaDe] = useState(false);

  const canComment = session?.user.rol === "FISCALIZADOR";
  const isReadOnly = session?.user.rol === "CIUDADANO";

  useEffect(() => {
    async function loadView() {
      try {
        // Intentar cargar sesión desde localStorage
        const storedSession = localStorage.getItem("civilis_session");
        let activeSession: UserSession;

        if (storedSession) {
          // Usuario logeado previamente
          activeSession = JSON.parse(storedSession);
          setSession(activeSession);
        } else {
          // Usuario público (no logeado)
          activeSession = await apiFetch<UserSession>("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email: "ciudadano@obratrack.local", password: "123456" }),
          });
          setSession(activeSession);
        }

        const data = await apiFetch<Obra[]>("/obras", {}, activeSession.token);
        setObras(data);
        const obraParam = searchParams.get("obra");
        if (obraParam && data.some((o) => o.id === obraParam)) {
          await loadObraDetail(obraParam, data, activeSession.token);
        }
      } catch (error) {
        console.error("Error loading view:", error);
        // Si hay error con la sesión guardada, limpiar localStorage
        localStorage.removeItem("civilis_session");
      } finally {
        setIsLoading(false);
      }
    }

    loadView();
  }, [searchParams]);

  async function loadObraDetail(obraId: string, current?: Obra[], tokenOverride?: string) {
    const activeToken = tokenOverride ?? session?.token;
    if (!activeToken) return;
    setSelectedObraId(obraId);
    setSelectedCommentId(null);

    const works = current ?? obras;
    if (works.length === 0) {
      const latest = await apiFetch<Obra[]>("/obras", {}, activeToken);
      setObras(latest);
    }

    const hitoData = await apiFetch<Hito[]>(`/obras/${obraId}/hitos`, {}, activeToken);
    setHitos(hitoData);
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

  async function enviarComentario(actividadId: string, texto: string, severidad: "LEVE" | "MODERADO" | "GRAVE", file?: File | null, fechaInspeccion?: Date) {
    if (!session || !texto || !canComment) return;
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

    await loadObraDetail(selectedObraId);
  }

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

  const selectedObra = useMemo(() => obras.find((obra) => obra.id === selectedObraId) ?? null, [obras, selectedObraId]);
  const sortedHitos = useMemo(() => [...hitos].sort((a, b) => a.orden - b.orden), [hitos]);
  const allActividades = useMemo(
    () => sortedHitos.flatMap((hito) => actividadesByHito[hito.id] ?? []).sort((a, b) => a.orden - b.orden),
    [sortedHitos, actividadesByHito],
  );
  const filteredObras = useMemo(() => {
    const q = obraSearch.trim().toLowerCase();
    if (!q) return [];
    return obras.filter((o) => o.nombre.toLowerCase().includes(q));
  }, [obras, obraSearch]);
  const completedHitos = hitos.filter((h) => h.estado === "COMPLETADO").length;
  const progressByHitos = hitos.length > 0 ? Math.round((completedHitos / hitos.length) * 100) : 0;
  const today = new Date();
  const progressByTime = useMemo(() => {
    if (!selectedObra) return 0;
    const start = new Date(selectedObra.fechaInicio).getTime();
    const end = new Date(selectedObra.fechaFin).getTime();
    const now = today.getTime();
    if (now <= start) return 0;
    if (now >= end) return 100;
    return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
  }, [selectedObra, today]);
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
  const selectedComment = orderedComments.find((comment) => comment.id === selectedCommentId) ?? null;
  const selectedActivity = useMemo(() => {
    if (!selectedActivityId) return null;
    return allActividades.find((a) => a.id === selectedActivityId) ?? null;
  }, [allActividades, selectedActivityId]);
  const obraShareUrl = selectedObraId ? `https://civilis.cl/?obra=${selectedObraId}` : "";
  const presupuestoM = selectedObraGeneral ? `$${(selectedObraGeneral.valor / 1_000_000).toFixed(1)}M` : "-";
  const responsibleEntity = selectedObraGeneral?.actores[0]?.organizacion ?? selectedObraGeneral?.encargado ?? "Sin definir";

  function handleCopyObraLink() {
    if (!obraShareUrl) return;
    void navigator.clipboard.writeText(obraShareUrl).then(() => {
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 2000);
    });
  }

  function handleDownloadQR() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const link = document.createElement("a");
      link.download = `qr-obra-${selectedObraId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  }

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
            <img 
              src="/logo-civilis.png" 
              alt="Civilis - Fiscalización Ciudadana" 
              className="h-16 w-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = document.createElement('h1');
                fallback.className = 'text-2xl font-bold text-slate-900';
                fallback.textContent = 'CIVILIS';
                e.currentTarget.parentNode?.appendChild(fallback);
              }}
            />
            <div className="border-l-4 border-orange-500 pl-3">
              <h1 className="text-lg font-bold text-slate-900">Fiscalización ciudadana</h1>
            </div>
          </div>
          
          {session && session.user.rol !== "CIUDADANO" ? (
            <div className="relative">
              <button 
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white font-semibold text-xs">
                  {session.user.nombre.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline">{session.user.nombre}</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showMobileMenu && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-lg z-[100]">
                {session && session.user.rol !== "CIUDADANO" && (
                  <>
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{session.user.nombre}</p>
                      <p className="text-xs text-slate-500">{session.user.email}</p>
                      <p className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                        {session.user.rol}
                      </p>
                    </div>

                    <div className="p-2">
                      <button
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        onClick={() => {
                          setShowNotifications(true);
                          setShowMobileMenu(false);
                        }}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <span>Notificaciones</span>
                        {notificaciones.filter(n => !n.leida).length > 0 && (
                          <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                            {notificaciones.filter(n => !n.leida).length}
                          </span>
                        )}
                      </button>

                      {session.user.rol === "ADMIN" && (
                        <button
                          className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                          onClick={() => window.location.href = "/login"}
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span>Mis Obras</span>
                        </button>
                      )}

                      {session.user.rol === "FISCALIZADOR" && (
                        <button
                          className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                          onClick={() => window.location.href = "/login"}
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Mis Fiscalizaciones</span>
                        </button>
                      )}
                    </div>
                    <div className="border-t border-slate-100"></div>
                  </>
                )}

                <div className="p-2">
                  {(!session || session.user.rol === "CIUDADANO") && (
                    <>
                      <button
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        onClick={() => window.location.href = "/login"}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        <span>Login</span>
                      </button>
                      <button
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        onClick={() => window.location.href = "/login"}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        <span>Registrarse</span>
                      </button>
                    </>
                  )}

                  <button
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                    onClick={() => {
                      setShowAcercaDe(true);
                      setShowMobileMenu(false);
                    }}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Acerca de</span>
                  </button>

                  <button
                    className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                    onClick={() => {
                      setShowContacto(true);
                      setShowMobileMenu(false);
                    }}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Contacto</span>
                  </button>
                </div>

                {session && session.user.rol !== "CIUDADANO" && (
                  <div className="border-t border-slate-100 p-2">
                    <button
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      onClick={() => {
                        localStorage.removeItem("civilis_session");
                        setSession(null);
                        setShowMobileMenu(false);
                        window.location.href = "/";
                      }}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                )}
              </div>
            )}
            </div>
          ) : (
            <>
              {/* Desktop: Botones tradicionales */}
              <div className="hidden md:flex gap-2 items-center">
                <button 
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                  onClick={() => {
                    setShowAcercaDe(true);
                  }}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Acerca de</span>
                </button>
                <button 
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                  onClick={() => {
                    setShowContacto(true);
                  }}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>Contacto</span>
                </button>
                <button 
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                  onClick={() => window.location.href = "/login"}
                >
                  Registrarse
                </button>
                <button 
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                  onClick={() => window.location.href = "/login"}
                >
                  Login
                </button>
              </div>

              {/* Mobile: Menú hamburguesa */}
              <div className="md:hidden relative">
                <button 
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-2 hover:bg-slate-50"
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                {showMobileMenu && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-lg z-[100]">
                    <div className="p-2">
                      <button
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        onClick={() => window.location.href = "/login"}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        <span>Login</span>
                      </button>
                      <button
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        onClick={() => window.location.href = "/login"}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        <span>Registrarse</span>
                      </button>
                      <button
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        onClick={() => {
                          setShowAcercaDe(true);
                          setShowMobileMenu(false);
                        }}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Acerca de</span>
                      </button>
                      <button
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                        onClick={() => {
                          setShowContacto(true);
                          setShowMobileMenu(false);
                        }}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>Contacto</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="rounded-2xl border border-sky-100 bg-[#f5fbfd] p-4">
          <div className="mx-auto w-full max-w-xl">
            <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">BUSCAR OBRA</p>
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

            {selectedObra && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-900">{selectedObra.nombre}</p>
                  <p className="mt-1 text-xs text-slate-600">Sector {selectedObra.ubicacion}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Estado</p>
                    <p className="mt-0.5 font-semibold text-slate-700">{selectedObra.estado.replace("_", " ")}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Presupuesto</p>
                    <p className="mt-0.5 font-semibold text-slate-700">{presupuestoM}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Avance Real</p>
                    <p className="mt-0.5 font-semibold text-slate-700">{progressByHitos}%</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Avance Esperado</p>
                    <p className="mt-0.5 font-semibold text-slate-700">{progressByTime}%</p>
                  </div>
                </div>
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600 shadow-md"
                    onClick={() => setShowObraMore(true)}
                  >
                    Ver más
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

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
                  {sortedHitos.map((hito, idx) => {
                    const actividades = [...(actividadesByHito[hito.id] ?? [])].sort((a, b) => a.orden - b.orden);
                    const isExpanded = expandedHitos.has(hito.id);

                    return (
                      <motion.div key={hito.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                        <button
                          type="button"
                          className={`mb-2 w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                            isExpanded 
                              ? "border-blue-700 bg-blue-700 hover:bg-blue-800" 
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
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
                              <p className={`text-sm font-semibold ${isExpanded ? "text-white" : "text-slate-800"}`}>{hito.nombre}</p>
                              <p className={`mt-0.5 text-[11px] ${isExpanded ? "text-blue-100" : "text-slate-500"}`}>{hito.descripcion}</p>
                              <p className={`mt-1 text-[10px] uppercase tracking-wide ${isExpanded ? "text-blue-200" : "text-slate-400"}`}>
                                {hito.estado.replace("_", " ")} · {new Date(hito.fechaInicio).toLocaleDateString()} - {new Date(hito.fechaFin).toLocaleDateString()}
                              </p>
                            </div>
                            <div className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                              isExpanded 
                                ? "border-blue-500 bg-blue-600 text-white" 
                                : "border-slate-200 bg-white text-slate-600"
                            }`}>
                              {isExpanded ? "Ocultar" : "VER"} ({actividades.length})
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
                                      className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${barColor}`}
                                      style={{ left: `${Math.max(0, Math.min(100, left))}%`, width: `${Math.min(100 - left, width)}%` }}
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
                                          title="Ver comentario"
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
          )}
        </section>
      )}
      </section>

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

            <div className="space-y-3 px-4 py-3 text-sm text-slate-700">
              <div>
                <p className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {selectedComment.tipo} - {selectedComment.severidad}
                </p>
                <p className="mt-2">{selectedComment.texto}</p>
              </div>

              {selectedComment.txSignature && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-600 mb-1">Transacción Blockchain</p>
                  <a
                    href={`https://explorer.solana.com/tx/${selectedComment.txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 hover:bg-purple-100 transition-colors"
                  >
                    <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono text-purple-900 truncate">{selectedComment.txSignature}</p>
                      <p className="text-[9px] text-purple-600 group-hover:underline">Ver en Solana Explorer →</p>
                    </div>
                  </a>
                </div>
              )}

              {selectedComment.respuestas && selectedComment.respuestas.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Respuestas ({selectedComment.respuestas.length})</p>
                  <div className="space-y-2">
                    {selectedComment.respuestas.map((respuesta) => (
                      <div key={respuesta.id} className="rounded-lg bg-slate-50 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-white font-semibold text-[10px]">
                            {respuesta.usuarioNombre.charAt(0).toUpperCase()}
                          </div>
                          <p className="text-xs font-semibold text-slate-700">{respuesta.usuarioNombre}</p>
                          <p className="text-[10px] text-slate-400 ml-auto">{new Date(respuesta.createdAt).toLocaleDateString()}</p>
                        </div>
                        <p className="text-xs text-slate-600">{respuesta.texto}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {session && session.user.rol === "ADMIN" && (
                <div className="border-t border-slate-100 pt-3">
                  {!showRespuestaForm ? (
                    <button
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => setShowRespuestaForm(true)}
                    >
                      + Agregar Respuesta
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs resize-none"
                        placeholder="Escribe tu respuesta..."
                        rows={3}
                        value={respuestaTexto}
                        onChange={(e) => setRespuestaTexto(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                          onClick={() => {
                            setShowRespuestaForm(false);
                            setRespuestaTexto("");
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          className="flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800"
                          onClick={async () => {
                            if (!respuestaTexto.trim()) return;
                            // TODO: Implementar envío de respuesta al backend
                            alert("Funcionalidad de respuestas pendiente de implementar en el backend");
                            setShowRespuestaForm(false);
                            setRespuestaTexto("");
                          }}
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {selectedActivity && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => { setSelectedActivityId(null); setSelectedFiscClickDate(undefined); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.18 }}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{selectedActivity.nombre}</p>
                <p className="text-[11px] text-slate-500">Progreso y fiscalizaciones</p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600"
                onClick={() => { setSelectedActivityId(null); setSelectedFiscClickDate(undefined); }}
              >
                Cerrar
              </button>
            </div>

            <div className="overflow-y-auto">
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

                          <div
                            className={`relative h-20 rounded-xl bg-slate-50 px-2 ${canComment ? "cursor-crosshair" : ""}`}
                            onClick={canComment ? (e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const ratio = (e.clientX - rect.left) / rect.width;
                              const clickTime = activityStart + ratio * duration;
                              setSelectedFiscClickDate(new Date(clickTime));
                            } : undefined}
                          >
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
                                  onClick={(e) => { e.stopPropagation(); setSelectedCommentId(isSelected ? null : comment.id); }}
                                >
                                  <span className="text-[10px] font-black leading-none text-white">{getSeverityGlyph(comment.severidad)}</span>
                                </button>
                              );
                            })}
                          </div>

                          {canComment && (
                            <p className="text-[10px] text-slate-400">
                              Haz clic en el timeline para registrar una fiscalización en esa fecha
                            </p>
                          )}
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

      {selectedFiscClickDate && selectedActivity && canComment && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => setSelectedFiscClickDate(undefined)}
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
                <p className="text-[11px] text-slate-500">
                  {selectedActivity.nombre} · {selectedFiscClickDate.toLocaleDateString()}
                </p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600"
                onClick={() => setSelectedFiscClickDate(undefined)}
              >
                Cerrar
              </button>
            </div>
            <div className="px-4 py-4">
              <CommentForm
                onSubmit={async (texto, severidad, file) => {
                  await enviarComentario(selectedActivity.id, texto, severidad, file, selectedFiscClickDate);
                  setSelectedFiscClickDate(undefined);
                }}
              />
            </div>
          </motion.div>
        </div>
      )}

      {showNotifications && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => setShowNotifications(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm font-semibold text-slate-800">Notificaciones</p>
              </div>
              <button 
                className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600"
                onClick={() => setShowNotifications(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notificaciones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <svg className="h-16 w-16 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-sm text-slate-500">No tienes notificaciones</p>
                  <p className="text-xs text-slate-400 mt-1">Te avisaremos cuando haya novedades</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notificaciones.map((notif) => (
                    <div
                      key={notif.id}
                      className={`px-4 py-3 hover:bg-slate-50 cursor-pointer ${!notif.leida ? "bg-blue-50/50" : ""}`}
                      onClick={() => {
                        // TODO: Marcar como leída y navegar
                        alert(`Navegar a obra: ${notif.obraNombre}`);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          notif.tipo === "NUEVO_COMENTARIO" ? "bg-yellow-100" : "bg-blue-100"
                        }`}>
                          {notif.tipo === "NUEVO_COMENTARIO" ? (
                            <svg className="h-5 w-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800">{notif.mensaje}</p>
                          <p className="text-xs text-slate-500 mt-1">{notif.obraNombre}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                        </div>
                        {!notif.leida && (
                          <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {notificaciones.length > 0 && (
              <div className="border-t border-slate-100 px-4 py-3">
                <button
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    // TODO: Marcar todas como leídas
                    alert("Marcar todas como leídas - pendiente de implementar");
                  }}
                >
                  Marcar todas como leídas
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {showObraMore && selectedObra && (
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
                <p className="text-[11px] text-slate-500">{selectedObra.nombre}</p>
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
                <p className="mt-1 text-sm font-semibold text-slate-800">{selectedObraGeneral?.ubicacion ?? selectedObra.ubicacion}</p>
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

            {obraShareUrl && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                <p className="mb-3 text-[11px] uppercase tracking-wide text-slate-500">Acceso directo a esta obra</p>
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                  <div ref={qrRef} className="shrink-0 rounded-xl border border-slate-200 bg-white p-3">
                    <QRCode value={obraShareUrl} size={120} />
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <p className="text-xs text-slate-600">Escanea el QR para ir directamente a esta obra en <span className="font-semibold">civilis.cl</span></p>
                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <p className="flex-1 truncate font-mono text-[10px] text-slate-500">{obraShareUrl}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCopyObraLink}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {qrCopied ? "¡Copiado!" : "Copiar enlace"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadQR}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Descargar QR
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {showAcercaDe && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => setShowAcercaDe(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">Acerca de Civilis</h2>
              <button 
                className="rounded-full p-1 hover:bg-slate-100"
                onClick={() => setShowAcercaDe(false)}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
              <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
                <p>
                  Civilis es una plataforma diseñada para fortalecer la transparencia y la participación ciudadana en proyectos de infraestructura y obras comunitarias, tales como plazas, canchas, escenarios y otras iniciativas de interés público o privado.
                </p>
                <p>
                  A través de esta herramienta, los ciudadanos pueden visualizar de manera clara y ordenada los hitos de cada obra, incluyendo su planificación, avances y plazos comprometidos. Esto permite hacer un seguimiento continuo del progreso y verificar que se cumplan los acuerdos establecidos.
                </p>
                <p>
                  Además, la plataforma fomenta la fiscalización ciudadana, brindando la posibilidad de reportar observaciones, compartir información y contribuir activamente al control social de los proyectos. De este modo, se promueve una gestión más transparente, responsable y alineada con las necesidades de la comunidad.
                </p>
                <p>
                  Nuestro objetivo es acercar la información a las personas, facilitar la rendición de cuentas y fortalecer la confianza entre instituciones, empresas y ciudadanos, asegurando que cada proyecto genere un verdadero beneficio para la comunidad.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showContacto && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4"
          onClick={() => setShowContacto(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">Contacto</h2>
              <button 
                className="rounded-full p-1 hover:bg-slate-100"
                onClick={() => setShowContacto(false)}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <svg className="h-6 w-6 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <p className="font-semibold text-slate-900">Dirección</p>
                    <p className="text-sm text-slate-600">Abtao #576, Cerro Concepción<br />Valparaíso, Chile</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <div>
                    <p className="font-semibold text-slate-900">WhatsApp</p>
                    <a href="https://wa.me/56964484676" target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 hover:underline">
                      +56 9 6448 4676
                    </a>
                  </div>
                </div>
              </div>
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
