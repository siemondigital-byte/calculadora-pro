import React, { useEffect, useRef, useState } from "react";
import MaquetadorView from "./MaquetadorView.jsx";
import MercadoView from "./MercadoView.jsx";
import BlogSeoView from "./BlogSeoView.jsx";
import EstudioUnificado from "./EstudioUnificado.jsx";
import CalendarioView from "./CalendarioView.jsx";
import AnaliticaView from "./AnaliticaView.jsx";
import AdsView from "./AdsView.jsx";
import {
  cambiarClave,
  clearToken,
  estadoSecretos,
  guardarSecreto,
  loadData,
  motorGet,
  motorPost,
  saveData,
  seed,
} from "./db.js";

// ---------------------------------------------------------------- utilidades

const hoyISO = () => new Date().toISOString().slice(0, 10);
const mesActual = () => new Date().toISOString().slice(0, 7);
const sumarDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};
const uid = (pref) => `${pref}-${Math.random().toString(36).slice(2, 10)}`;

// Config SIEMPRE desde data.<ws>.config (autocorreccion #10: nada hardcodeado)
const cfg = (data, ws) => data?.[ws]?.config || {};

// ---------------------------------------------------------------- navegacion

const NAV = {
  atlantis: [
    { sec: "Panel", items: [["panel", "Panel"]] },
    {
      sec: "Comercial",
      items: [
        ["prospeccion", "Prospección"],
        ["correo", "Correo"],
        ["leads", "Leads"],
        ["pipeline", "Pipeline"],
        ["seguimiento", "Seguimiento"],
        ["consultas", "Consultas"],
        ["mercado", "Estudio de mercado"],
        ["fuentes", "Fuentes / UTM"],
      ],
    },
    {
      sec: "Contenido",
      items: [
        ["contenido", "Contenido"],
        ["calendario", "Calendario"],
        ["blogseo", "Blog y SEO"],
        ["nurturing", "Nurturing"],
        ["maquetador", "Maquetador (mi web)"],
        ["ads", "Ads (pauta)"],
        ["analitica", "Analítica"],
      ],
    },
    { sec: "Configuración", items: [["accesos", "Accesos"]] },
  ],
  cicloderiqueza: [
    { sec: "Panel", items: [["panel", "Panel"]] },
    {
      sec: "Producto 44 USD",
      items: [
        ["prospeccion", "Prospección"],
        ["correo", "Correo"],
        ["leads", "Leads"],
        ["pipeline", "Pipeline"],
        ["seguimiento", "Seguimiento"],
        ["compradores", "Compradores"],
        ["afiliados", "Afiliados"],
        ["appusuarios", "App · Calculadora Pro"],
        ["fuentes", "Fuentes / UTM"],
      ],
    },
    {
      sec: "Contenido",
      items: [
        ["contenido", "Contenido"],
        ["calendario", "Calendario"],
        ["blogseo", "Blog y SEO"],
        ["nurturing", "Nurturing"],
        ["ads", "Ads (pauta)"],
        ["analitica", "Analítica"],
      ],
    },
    { sec: "Configuración", items: [["accesos", "Accesos"]] },
  ],
};

// ---------------------------------------------------------------- shell

export default function App() {
  const [data, setData] = useState(null);
  const [vista, setVista] = useState("panel");
  const [navAbierto, setNavAbierto] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const guardandoRef = useRef(0);
  const ultimaEdicionRef = useRef(0);

  const ws = data?.workspace === "cicloderiqueza" ? "cicloderiqueza" : "atlantis";

  useEffect(() => {
    loadData()
      .then((d) => setData(d || seed()))
      .catch((e) => setErrorCarga(String(e)));
  }, []);

  // commit optimista: pinta ya, guarda el documento COMPLETO detras
  const commit = (siguiente) => {
    setData(siguiente);
    ultimaEdicionRef.current = Date.now();
    guardandoRef.current += 1;
    saveData(siguiente)
      .catch(() => {})
      .finally(() => {
        guardandoRef.current -= 1;
      });
  };

  // reload al reenfocar: trae escrituras server-side sin pisar lo no guardado
  useEffect(() => {
    const alEnfocar = () => {
      if (guardandoRef.current > 0) return;
      if (Date.now() - ultimaEdicionRef.current < 4000) return;
      loadData().then(setData).catch(() => {});
    };
    window.addEventListener("focus", alEnfocar);
    return () => window.removeEventListener("focus", alEnfocar);
  }, []);

  if (errorCarga)
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="text-red-400">No se pudo cargar el CRM: {errorCarga}</p>
          <button className="boton mt-4" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="flex min-h-screen items-center justify-center text-gris">
        Cargando el Centro de Mando...
      </div>
    );

  const cambiarWorkspace = (nuevo) => {
    commit({ ...data, workspace: nuevo });
    setVista("panel");
  };

  const recargar = () => loadData().then(setData).catch(() => {});

  const props = { data, commit, ws, recargar };
  const VISTAS = {
    panel: <Panel {...props} />,
    prospeccion: <Prospeccion {...props} />,
    correo: <Correo {...props} />,
    leads: <Leads {...props} />,
    pipeline: <Pipeline {...props} />,
    seguimiento: <Seguimiento {...props} />,
    consultas: <Consultas {...props} />,
    fuentes: <Fuentes {...props} />,
    compradores: <Compradores {...props} />,
    afiliados: <Afiliados {...props} />,
    appusuarios: <AppUsuarios {...props} />,
    contenido: <EstudioUnificado {...props} />,
    calendario: <CalendarioView {...props} />,
    analitica: <AnaliticaView {...props} />,
    ads: <AdsView {...props} />,
    nurturing: <Nurturing {...props} />,
    maquetador: <MaquetadorView {...props} />,
    mercado: <MercadoView {...props} />,
    blogseo: <BlogSeoView {...props} />,
    accesos: <Accesos {...props} />,
  };

  const titulo =
    NAV[ws].flatMap((s) => s.items).find(([v]) => v === vista)?.[1] || "Panel";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* barra superior movil */}
      <div className="flex items-center gap-3 border-b border-gris/10 p-4 md:hidden">
        <button
          aria-label="Abrir menú"
          className="text-oro"
          onClick={() => setNavAbierto(true)}
        >
          ☰
        </button>
        <span className="wordmark text-sm text-crema">Atlantis</span>
        <span className="text-sm text-gris">· {titulo}</span>
      </div>

      {navAbierto && (
        <div
          className="fixed inset-0 z-20 bg-negro/70 md:hidden"
          onClick={() => setNavAbierto(false)}
        />
      )}

      <aside
        className={`fixed z-30 h-full w-64 shrink-0 overflow-y-auto border-r border-gris/10 bg-negro p-5 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          navAbierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center gap-2.5">
          <img src="/icono.png" alt="" className="h-9 w-9 rounded-lg" />
          <div>
            <div className="wordmark text-base text-crema">
              Atlantis
            </div>
            <div className="wordmark mt-1 text-[9px] !tracking-[0.45em] text-oro">
              Global Realty
            </div>
          </div>
        </div>

        <select
          aria-label="Línea de negocio"
          className="campo mb-6"
          value={ws}
          onChange={(e) => cambiarWorkspace(e.target.value)}
        >
          <option value="atlantis">Atlantis · Inmobiliaria</option>
          <option value="cicloderiqueza">Ciclo de Riqueza · 44 USD</option>
        </select>

        {NAV[ws].map(({ sec, items }) => (
          <div key={sec} className="mb-5">
            <div className="mb-2 text-xs uppercase tracking-wider text-gris/60">
              {sec}
            </div>
            {items.map(([v, etiqueta]) => (
              <button
                key={v}
                onClick={() => {
                  setVista(v);
                  setNavAbierto(false);
                }}
                className={`mb-1 block w-full rounded-md px-3 py-2 text-left text-sm transition ${
                  vista === v
                    ? "bg-oro/15 text-oro"
                    : "text-crema/80 hover:bg-navy/60"
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        ))}

        <button
          className="mt-4 text-xs text-gris/60 hover:text-gris"
          onClick={() => {
            clearToken();
            window.location.reload();
          }}
        >
          Salir
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-5 md:p-8">{VISTAS[vista] || VISTAS.panel}</main>
      <AsistenteFlotante ws={ws} recargar={recargar} />
    </div>
  );
}

// ------------------------------------------- Credenciales de portales (manual)

function TarjetaPortales({ data, commit, ws }) {
  const portales = data?.[ws]?.accesos || [];
  const [nuevo, setNuevo] = useState({ nombre: "", url: "", usuario: "", clave: "", nota: "" });
  const [visible, setVisible] = useState({});

  const guardar = () => {
    if (!nuevo.nombre) return;
    const siguiente = structuredClone(data);
    siguiente[ws].accesos = [
      ...(siguiente[ws].accesos || []),
      { id: uid("acc"), ...nuevo },
    ];
    commit(siguiente);
    setNuevo({ nombre: "", url: "", usuario: "", clave: "", nota: "" });
  };

  const eliminar = (id) => {
    const siguiente = structuredClone(data);
    siguiente[ws].accesos = (siguiente[ws].accesos || []).filter((a) => a.id !== id);
    commit(siguiente);
  };

  return (
    <div className="tarjeta mb-6">
      <div className="mb-1 text-sm font-semibold">Credenciales de portales (manual)</div>
      <p className="mb-3 text-xs text-gris/70">
        Tu bóveda de accesos: Hotmart, hPanel, Supabase, redes, lo que necesites.
        Se guardan en tu CRM (protegidas por tu clave de acceso).
      </p>

      <div className="mb-4 grid gap-2 sm:grid-cols-5">
        <input className="campo" placeholder="Portal (ej. Hotmart)" value={nuevo.nombre}
          onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <input className="campo" placeholder="URL" value={nuevo.url}
          onChange={(e) => setNuevo({ ...nuevo, url: e.target.value })} />
        <input className="campo" placeholder="Usuario / email" value={nuevo.usuario}
          onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value })} autoComplete="off" />
        <input className="campo" type="password" placeholder="Contraseña" value={nuevo.clave}
          onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value })} autoComplete="new-password" />
        <button className="boton" disabled={!nuevo.nombre} onClick={guardar}>
          Guardar
        </button>
      </div>

      {portales.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-3 border-b border-gris/10 py-2 text-sm last:border-0">
          <span className="font-semibold">{a.nombre}</span>
          {a.url && (
            <a href={a.url.startsWith("http") ? a.url : `https://${a.url}`} target="_blank"
              rel="noreferrer" className="text-xs text-oro hover:underline">
              abrir
            </a>
          )}
          {a.usuario && <span className="text-xs text-gris">{a.usuario}</span>}
          {a.clave && (
            <button className="text-xs text-gris hover:text-crema"
              onClick={() => setVisible({ ...visible, [a.id]: !visible[a.id] })}>
              {visible[a.id] ? a.clave : "••••••••"}
            </button>
          )}
          {a.clave && (
            <button className="boton-secundario !px-2 !py-0.5 text-xs"
              onClick={() => navigator.clipboard?.writeText(a.clave)}>
              copiar
            </button>
          )}
          {a.nota && <span className="text-xs text-gris/60">{a.nota}</span>}
          <button className="ml-auto text-xs text-red-400/70 hover:text-red-400"
            onClick={() => eliminar(a.id)}>
            eliminar
          </button>
        </div>
      ))}
      {portales.length === 0 && (
        <p className="text-xs text-gris">Sin credenciales guardadas todavía.</p>
      )}
    </div>
  );
}

// ------------------------------------------------------ Push (campana)

function base64aUint8(base64) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...crudo].map((c) => c.charCodeAt(0)));
}

function TarjetaPush() {
  const [estado, setEstado] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const activar = async () => {
    setOcupado(true);
    setEstado("");
    try {
      const { clave } = await motorGet("/push/clave_publica");
      if (!clave) {
        setEstado("El motor no tiene VAPID configurado (variables VAPID_PUBLIC_KEY/PRIVATE_KEY).");
        return;
      }
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado("Permiso de notificaciones denegado en este navegador.");
        return;
      }
      const registro = await navigator.serviceWorker.ready;
      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64aUint8(clave),
      });
      await motorPost("/push/suscribir", { suscripcion: suscripcion.toJSON() });
      const prueba = await motorPost("/push/probar", {});
      setEstado(prueba.ok ? "Notificaciones activas en este dispositivo." : prueba.motivo);
    } catch (e) {
      setEstado(String(e.message || e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="tarjeta mb-6 max-w-md space-y-3">
      <div className="text-sm font-semibold">Notificaciones push</div>
      <p className="text-xs text-gris/70">
        Recordatorio diario de seguimientos pendientes y consultas del día. En
        iPhone requiere instalar la app en pantalla de inicio (iOS 16.4+).
      </p>
      <button className="boton" disabled={ocupado} onClick={activar}>
        {ocupado ? "Activando…" : "Activar en este dispositivo"}
      </button>
      {estado && <p className="text-xs text-gris">{estado}</p>}
    </div>
  );
}

// ------------------------------------------------------ Asistente flotante

function AsistenteFlotante({ ws, recargar }) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const finRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const enviar = async (e) => {
    e?.preventDefault();
    const mensaje = texto.trim();
    if (!mensaje || cargando) return;
    setTexto("");
    setMensajes((m) => [...m, { de: "yo", texto: mensaje }]);
    setCargando(true);
    try {
      const r = await motorPost("/asistente", { mensaje, workspace: ws });
      setMensajes((m) => [...m, { de: "ia", texto: r.respuesta, aplicadas: r.aplicadas }]);
      if (r.aplicadas?.length) await recargar();
    } catch (err) {
      setMensajes((m) => [...m, { de: "ia", texto: `No pude procesarlo: ${err.message || err}` }]);
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <button
        aria-label="Abrir asistente"
        onClick={() => setAbierto(!abierto)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-oro text-2xl text-negro shadow-lg transition hover:scale-105"
      >
        {abierto ? "×" : "◎"}
      </button>

      {abierto && (
        <div className="fixed bottom-24 right-5 z-40 flex max-h-[70vh] w-[min(24rem,calc(100vw-2.5rem))] flex-col rounded-xl border border-gris/20 bg-negro shadow-2xl">
          <div className="border-b border-gris/10 p-3">
            <span className="font-display text-oro">Asistente</span>
            <span className="ml-2 text-xs text-gris">ejecuta sobre el CRM</span>
          </div>
          <div className="min-h-40 flex-1 space-y-2 overflow-y-auto p-3">
            {mensajes.length === 0 && (
              <p className="text-xs text-gris">
                Pídeme cosas: "crea el lead Ana ana@correo.com", "mueve a Ana a
                Contactado", "agenda diagnóstico con Ana el viernes 10am", "pon la
                meta del mes en 20000".
              </p>
            )}
            {mensajes.map((m, i) => (
              <div key={i} className={m.de === "yo" ? "text-right" : ""}>
                <div
                  className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.de === "yo" ? "bg-oro/15 text-crema" : "bg-navy/60 text-crema/90"
                  }`}
                >
                  {m.texto}
                  {m.aplicadas?.length > 0 && (
                    <div className="mt-1 border-t border-gris/20 pt-1 text-xs text-oro">
                      {m.aplicadas.map((a, j) => (
                        <div key={j}>✓ {a}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {cargando && <div className="text-xs text-gris">Pensando…</div>}
            <div ref={finRef} />
          </div>
          <form onSubmit={enviar} className="flex gap-2 border-t border-gris/10 p-3">
            <input
              className="campo"
              placeholder="Escribe una orden…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <button className="boton shrink-0 !px-3" disabled={cargando || !texto.trim()}>
              →
            </button>
          </form>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Panel

function Panel({ data, commit, ws }) {
  const config = cfg(data, ws);
  const slice = data[ws] || {};
  const leads = slice.leads || [];
  const mes = mesActual();
  const meta = (slice.metas || {})[mes] || 0;

  const inicioMes = `${mes}-01`;
  const leadsMes = leads.filter((l) => {
    const f = l.creado ? new Date(l.creado * 1000).toISOString().slice(0, 10) : "";
    return f >= inicioMes;
  });
  const etapaFinal = config.stages?.includes("Cliente") ? "Cliente" : "Comprador";
  const cerrados = leads.filter((l) => l.etapa === etapaFinal);
  const vencidos = leads.filter(
    (l) => l.followUpDate && l.followUpDate < hoyISO() && !["Descartado", "Baja"].includes(l.etapa)
  );
  const valorCerrado = cerrados.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const avance = meta > 0 ? Math.min(100, Math.round((valorCerrado / meta) * 100)) : 0;

  const ponerMeta = () => {
    const v = window.prompt(`Meta de ${mes} (${config.moneda || "USD"})`, meta || "");
    if (v === null) return;
    const siguiente = structuredClone(data);
    siguiente[ws].metas = { ...(siguiente[ws].metas || {}), [mes]: Number(v) || 0 };
    commit(siguiente);
  };

  return (
    <div>
      <Encabezado titulo={config.nombre || "Panel"} sub={`Panel · ${mes}`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi etiqueta="Leads del mes" valor={leadsMes.length} />
        <Kpi
          etiqueta={etapaFinal === "Comprador" ? "Compradores" : "Clientes"}
          valor={cerrados.length}
        />
        <Kpi etiqueta="Seguimientos vencidos" valor={vencidos.length} alerta={vencidos.length > 0} />
        <Kpi etiqueta="Leads totales" valor={leads.length} />
      </div>

      <div className="tarjeta mt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gris">Meta del mes</div>
            <div className="font-display text-3xl text-oro">
              {valorCerrado.toLocaleString()} / {meta.toLocaleString()}{" "}
              <span className="text-base">{config.moneda || "USD"}</span>
            </div>
          </div>
          <button className="boton-secundario" onClick={ponerMeta}>
            {meta ? "Cambiar meta" : "Definir meta"}
          </button>
        </div>
        <div className="mt-4 h-2 rounded-full bg-navy">
          <div
            className="h-2 rounded-full bg-oro transition-all"
            style={{ width: `${avance}%` }}
          />
        </div>
        <div className="mt-2 text-right text-xs text-gris">{avance}%</div>
      </div>
    </div>
  );
}

function Kpi({ etiqueta, valor, alerta }) {
  return (
    <div className="tarjeta">
      <div className="text-sm text-gris">{etiqueta}</div>
      <div className={`font-display text-4xl ${alerta ? "text-red-400" : "text-oro"}`}>
        {valor}
      </div>
    </div>
  );
}

function Encabezado({ titulo, sub }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-2xl text-crema">{titulo}</h1>
      {sub && <p className="text-sm text-gris">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Prospección

function Prospeccion({ data, ws, recargar }) {
  const prospectos = data[ws]?.prospectos || [];
  const VERTICALES = [
    "productividad/hábitos",
    "mentalidad",
    "finanzas e inversión",
    "crecimiento personal",
    "crecimiento profesional",
  ];
  const [consulta, setConsulta] = useState("");
  const [vertical, setVertical] = useState(VERTICALES[2]);
  const [manual, setManual] = useState({ nombre: "", email: "" });
  const [estado, setEstado] = useState("");
  const [cargando, setCargando] = useState(false);

  const llamar = async (ruta, body, mensajeOk) => {
    setCargando(true);
    setEstado("");
    try {
      const r = await motorPost(ruta, { ...body, workspace: ws });
      setEstado(mensajeOk(r));
      await recargar();
    } catch (e) {
      setEstado(String(e.message || e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <Encabezado
        titulo="Prospección"
        sub={
          ws === "cicloderiqueza"
            ? "Embajadores de YouTube por vertical · Ambassador Fit Score"
            : "Prospectos que encajan con el avatar"
        }
      />

      <div className="tarjeta mb-4 grid gap-3 sm:grid-cols-4">
        <input
          className="campo sm:col-span-2"
          placeholder="Buscar canales de YouTube (ej: finanzas personales latam)"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
        />
        <select
          className="campo"
          value={vertical}
          onChange={(e) => setVertical(e.target.value)}
        >
          {VERTICALES.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <button
          className="boton"
          disabled={cargando || !consulta}
          onClick={() =>
            llamar("/prospectar", { consulta, vertical }, (r) => `${r.nuevos} prospectos nuevos.`)
          }
        >
          {cargando ? "Buscando..." : "Prospectar YouTube"}
        </button>
      </div>

      <div className="tarjeta mb-4 grid gap-3 sm:grid-cols-3">
        <input
          className="campo"
          placeholder="Nombre (captura manual)"
          value={manual.nombre}
          onChange={(e) => setManual({ ...manual, nombre: e.target.value })}
        />
        <input
          className="campo"
          type="email"
          placeholder="Email"
          value={manual.email}
          onChange={(e) => setManual({ ...manual, email: e.target.value })}
        />
        <button
          className="boton-secundario"
          disabled={cargando || (!manual.nombre && !manual.email)}
          onClick={() =>
            llamar("/prospectos/capturar", manual, () => "Prospecto capturado.").then(() =>
              setManual({ nombre: "", email: "" })
            )
          }
        >
          Capturar manual
        </button>
      </div>

      {estado && <p className="mb-4 text-sm text-oro">{estado}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-gris/20 text-left text-gris">
              <th className="p-2">Prospecto</th>
              <th className="p-2">Vertical</th>
              <th className="p-2">Subs</th>
              <th className="p-2">Score</th>
              <th className="p-2">Estado</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {prospectos.map((p) => (
              <tr key={p.id} className="border-b border-gris/10">
                <td className="p-2">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-oro hover:underline">
                      {p.titulo || p.nombre || p.canal}
                    </a>
                  ) : (
                    p.titulo || p.nombre || p.canal || p.email
                  )}
                </td>
                <td className="p-2 text-gris">{p.vertical || "-"}</td>
                <td className="p-2 text-gris">{p.subs ? p.subs.toLocaleString() : "-"}</td>
                <td className="p-2">
                  <span className={p.score >= 60 ? "text-oro" : "text-gris"}>{p.score ?? "-"}</span>
                </td>
                <td className="p-2 text-gris">{p.estado}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    {p.estado !== "promovido" && (
                      <button
                        className="boton-secundario !px-2 !py-1 text-xs"
                        disabled={cargando}
                        onClick={() =>
                          llamar("/prospectos/promover", { id: p.id }, () => "Promovido a lead.")
                        }
                      >
                        Promover
                      </button>
                    )}
                    <button
                      className="boton-secundario !border-red-400/40 !px-2 !py-1 text-xs !text-red-400"
                      disabled={cargando}
                      onClick={() =>
                        llamar("/prospectos/descartar", { id: p.id }, () => "Descartado (blocklist).")
                      }
                    >
                      Descartar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {prospectos.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gris">
                  Sin prospectos. Busca canales arriba (requiere YOUTUBE_API_KEY en
                  Accesos) o captura uno manual.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Correo

function Correo({ data, ws, recargar }) {
  const hilos = data[ws]?.outreach || [];
  const [abierto, setAbierto] = useState(null);
  const [borrador, setBorrador] = useState(null);
  const [estado, setEstado] = useState("");
  const [cargando, setCargando] = useState(false);

  const COLORES = {
    interesado: "text-oro",
    pregunta: "text-oro",
    no_interesado: "text-gris",
    baja: "text-red-400",
    sin_clasificar: "text-gris/60",
  };

  const leerAhora = async () => {
    setCargando(true);
    setEstado("");
    try {
      const r = await motorPost("/leer_correos", {});
      setEstado(`Leídos: ${r.leidos} · con match: ${r.conMatch}${r.errores ? ` · errores: ${r.errores}` : ""}`);
      await recargar();
    } catch (e) {
      setEstado(String(e.message || e));
    } finally {
      setCargando(false);
    }
  };

  const redactar = async (email) => {
    setCargando(true);
    setEstado("");
    try {
      const r = await motorPost("/generar_mensaje", { email, workspace: ws });
      setBorrador({ para: email, ...r.mensaje });
    } catch (e) {
      setEstado(String(e.message || e));
    } finally {
      setCargando(false);
    }
  };

  const enviar = async () => {
    setCargando(true);
    try {
      await motorPost("/enviar_correo", {
        para: borrador.para, asunto: borrador.asunto,
        cuerpo: (borrador.cuerpo || "").split("\n").map((p) => `<p>${p}</p>`).join(""),
        workspace: ws,
      });
      setEstado(`Enviado a ${borrador.para}.`);
      setBorrador(null);
      await recargar();
    } catch (e) {
      setEstado(String(e.message || e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <Encabezado
        titulo="Correo"
        sub="Respuestas clasificadas por IA · el cron lee la bandeja cada 15 min"
      />
      <div className="mb-4 flex items-center gap-3">
        <button className="boton" disabled={cargando} onClick={leerAhora}>
          {cargando ? "Trabajando..." : "Leer bandeja ahora"}
        </button>
        {estado && <span className="text-sm text-oro">{estado}</span>}
      </div>

      {hilos.map((h) => (
        <div key={h.email} className="tarjeta mb-2 !p-4">
          <button
            className="flex w-full items-center justify-between text-left"
            onClick={() => setAbierto(abierto === h.email ? null : h.email)}
          >
            <div>
              <span className="text-sm">{h.email}</span>
              <span className={`ml-3 text-xs ${COLORES[h.clasificacion] || "text-gris"}`}>
                {h.clasificacion || "sin clasificar"}
              </span>
              {h.resumen && <div className="mt-1 text-xs text-gris">{h.resumen}</div>}
            </div>
            <span className="text-xs text-gris">{(h.conversacion || []).length} mensajes</span>
          </button>

          {abierto === h.email && (
            <div className="mt-3 space-y-2 border-t border-gris/10 pt-3">
              {(h.conversacion || []).map((m, i) => (
                <div key={i} className="rounded-lg bg-negro/40 p-3">
                  <div className="text-xs text-gris">
                    {m.de} · {m.asunto}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-crema/90">
                    {(m.texto || "").slice(0, 600)}
                  </p>
                </div>
              ))}
              <button
                className="boton-secundario !px-3 !py-1 text-xs"
                disabled={cargando}
                onClick={() => redactar(h.email)}
              >
                Redactar respuesta con IA
              </button>
            </div>
          )}
        </div>
      ))}
      {hilos.length === 0 && (
        <p className="text-sm text-gris">
          Sin respuestas todavía. Configura un buzón en Accesos y activa el cron de
          lectura (n8n, cada 15 min) o pulsa "Leer bandeja ahora".
        </p>
      )}

      {borrador && (
        <div className="tarjeta mt-4">
          <div className="mb-2 text-sm font-semibold">Borrador para {borrador.para}</div>
          <input className="campo mb-2" value={borrador.asunto || ""}
            onChange={(e) => setBorrador({ ...borrador, asunto: e.target.value })} />
          <textarea className="campo min-h-32" value={borrador.cuerpo || ""}
            onChange={(e) => setBorrador({ ...borrador, cuerpo: e.target.value })} />
          <div className="mt-3 flex gap-2">
            <button className="boton" disabled={cargando} onClick={enviar}>
              Enviar
            </button>
            <button className="boton-secundario" onClick={() => setBorrador(null)}>
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Leads

function moverEtapa(data, ws, leadId, etapa) {
  const siguiente = structuredClone(data);
  const lead = (siguiente[ws].leads || []).find((l) => l.id === leadId);
  if (!lead) return data;
  lead.etapa = etapa;
  // cadencia de seguimiento: SIEMPRE de la config, nunca constante
  const dias = cfg(siguiente, ws).cadenciaDias?.[etapa];
  lead.followUpDate = dias ? sumarDias(dias) : lead.followUpDate || "";
  return siguiente;
}

function Leads({ data, commit, ws }) {
  const config = cfg(data, ws);
  const leads = data[ws]?.leads || [];
  const [nuevo, setNuevo] = useState({ nombre: "", email: "", fuente: "directo" });

  const agregar = (e) => {
    e.preventDefault();
    if (!nuevo.email) return;
    const siguiente = structuredClone(data);
    siguiente[ws].leads = [
      ...(siguiente[ws].leads || []),
      {
        id: uid("lead"),
        ...nuevo,
        etapa: config.stages?.[0] || "Nuevo",
        creado: Math.floor(Date.now() / 1000),
        followUpDate: sumarDias(config.cadenciaDias?.[config.stages?.[0]] || 2),
      },
    ];
    commit(siguiente);
    setNuevo({ nombre: "", email: "", fuente: "directo" });
  };

  const actualizar = (id, campo, valor) => {
    if (campo === "etapa") return commit(moverEtapa(data, ws, id, valor));
    const siguiente = structuredClone(data);
    const lead = siguiente[ws].leads.find((l) => l.id === id);
    if (lead) lead[campo] = valor;
    commit(siguiente);
  };

  return (
    <div>
      <Encabezado titulo="Leads" sub={`${leads.length} en total`} />
      <form onSubmit={agregar} className="tarjeta mb-6 grid gap-3 sm:grid-cols-4">
        <input
          className="campo"
          placeholder="Nombre"
          value={nuevo.nombre}
          onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
        />
        <input
          className="campo"
          type="email"
          placeholder="Email"
          value={nuevo.email}
          onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
        />
        <select
          className="campo"
          value={nuevo.fuente}
          onChange={(e) => setNuevo({ ...nuevo, fuente: e.target.value })}
        >
          {(config.fuentes || ["directo"]).map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <button className="boton">Agregar lead</button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-gris/20 text-left text-gris">
              <th className="p-2">Nombre</th>
              <th className="p-2">Email</th>
              <th className="p-2">Fuente</th>
              <th className="p-2">Etapa</th>
              <th className="p-2">Valor</th>
              <th className="p-2">Seguimiento</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-gris/10">
                <td className="p-2">{l.nombre || "(sin nombre)"}</td>
                <td className="p-2 text-gris">{l.email}</td>
                <td className="p-2 text-gris">{l.fuente}</td>
                <td className="p-2">
                  <select
                    className="campo !py-1"
                    value={l.etapa}
                    onChange={(e) => actualizar(l.id, "etapa", e.target.value)}
                  >
                    {(config.stages || []).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <input
                    className="campo !w-24 !py-1"
                    type="number"
                    value={l.valor || ""}
                    placeholder="0"
                    onChange={(e) => actualizar(l.id, "valor", e.target.value)}
                  />
                </td>
                <td className="p-2 text-gris">{l.followUpDate || "-"}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gris">
                  Aún no hay leads. Agrega el primero arriba o conecta un formulario a
                  /crm/lead.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Pipeline

function Pipeline({ data, commit, ws }) {
  const config = cfg(data, ws);
  const leads = data[ws]?.leads || [];
  const etapas = config.stages || [];

  return (
    <div>
      <Encabezado titulo="Pipeline" sub="Forecast ponderado por probabilidad de etapa" />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {etapas.map((etapa) => {
          const columna = leads.filter((l) => l.etapa === etapa);
          const prob = (config.probabilidadPorEtapa?.[etapa] ?? 0) / 100;
          const forecast = columna.reduce(
            (s, l) => s + (Number(l.valor) || 0) * prob,
            0
          );
          return (
            <div key={etapa} className="w-64 shrink-0">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-crema">{etapa}</span>
                <span className="text-xs text-gris">
                  {columna.length} · {Math.round(forecast).toLocaleString()}{" "}
                  {config.moneda || "USD"}
                </span>
              </div>
              <div className="space-y-2">
                {columna.map((l) => (
                  <div key={l.id} className="tarjeta !p-3">
                    <div className="text-sm">{l.nombre || l.email}</div>
                    {l.valor && (
                      <div className="text-xs text-oro">
                        {Number(l.valor).toLocaleString()} {config.moneda || "USD"}
                      </div>
                    )}
                    <select
                      aria-label={`Mover ${l.nombre || l.email} a otra etapa`}
                      className="campo mt-2 !py-1 text-xs"
                      value={l.etapa}
                      onChange={(e) =>
                        commit(moverEtapa(data, ws, l.id, e.target.value))
                      }
                    >
                      {etapas.map((s) => (
                        <option key={s} value={s}>
                          Mover a: {s}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Seguimiento

function Seguimiento({ data, commit, ws }) {
  const leads = (data[ws]?.leads || []).filter(
    (l) => l.followUpDate && !["Descartado", "Baja", "Cliente", "Comprador"].includes(l.etapa)
  );
  const hoy = hoyISO();
  const finSemana = sumarDias(7);
  const grupos = {
    Vencidas: leads.filter((l) => l.followUpDate < hoy),
    Hoy: leads.filter((l) => l.followUpDate === hoy),
    "Esta semana": leads.filter((l) => l.followUpDate > hoy && l.followUpDate <= finSemana),
    "Más adelante": leads.filter((l) => l.followUpDate > finSemana),
  };

  const posponer = (id, dias) => {
    const siguiente = structuredClone(data);
    const lead = siguiente[ws].leads.find((l) => l.id === id);
    if (lead) lead.followUpDate = sumarDias(dias);
    commit(siguiente);
  };

  return (
    <div>
      <Encabezado titulo="Seguimiento" sub="Tareas por fecha de próximo toque" />
      {Object.entries(grupos).map(([grupo, lista]) => (
        <div key={grupo} className="mb-6">
          <h2
            className={`mb-2 text-sm font-semibold uppercase tracking-wide ${
              grupo === "Vencidas" && lista.length ? "text-red-400" : "text-gris"
            }`}
          >
            {grupo} ({lista.length})
          </h2>
          {lista.map((l) => (
            <div key={l.id} className="tarjeta mb-2 flex items-center justify-between !p-3">
              <div>
                <div className="text-sm">{l.nombre || l.email}</div>
                <div className="text-xs text-gris">
                  {l.etapa} · toca el {l.followUpDate}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="boton-secundario !px-2 !py-1 text-xs" onClick={() => posponer(l.id, 1)}>
                  +1 día
                </button>
                <button className="boton-secundario !px-2 !py-1 text-xs" onClick={() => posponer(l.id, 7)}>
                  +7 días
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Consultas (diagnóstico Atlantis)

function Consultas({ data, commit, ws }) {
  const consultas = data[ws]?.consultas || [];
  const leads = data[ws]?.leads || [];
  const [nueva, setNueva] = useState({ leadId: "", fecha: "" });
  const ESTADOS = ["agendada", "realizada", "no-show", "cancelada"];

  if (ws !== "atlantis")
    return (
      <p className="text-gris">
        Las consultas de diagnóstico viven en el workspace de Atlantis.
      </p>
    );

  const agendar = (e) => {
    e.preventDefault();
    if (!nueva.leadId || !nueva.fecha) return;
    const siguiente = structuredClone(data);
    siguiente[ws].consultas = [
      ...(siguiente[ws].consultas || []),
      { id: uid("con"), ...nueva, estado: "agendada" },
    ];
    commit(siguiente);
    setNueva({ leadId: "", fecha: "" });
  };

  const cambiarEstado = (id, estado) => {
    const siguiente = structuredClone(data);
    const con = siguiente[ws].consultas.find((c) => c.id === id);
    if (con) con.estado = estado;
    commit(siguiente);
  };

  const nombreLead = (id) =>
    leads.find((l) => l.id === id)?.nombre ||
    leads.find((l) => l.id === id)?.email ||
    "(lead)";

  return (
    <div>
      <Encabezado
        titulo="Consultas de diagnóstico"
        sub="La consulta es un diagnóstico, no una venta"
      />
      <form onSubmit={agendar} className="tarjeta mb-6 grid gap-3 sm:grid-cols-3">
        <select
          className="campo"
          value={nueva.leadId}
          onChange={(e) => setNueva({ ...nueva, leadId: e.target.value })}
        >
          <option value="">Selecciona el lead</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre || l.email}
            </option>
          ))}
        </select>
        <input
          className="campo"
          type="datetime-local"
          value={nueva.fecha}
          onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })}
        />
        <button className="boton">Agendar</button>
      </form>

      {consultas.map((c) => (
        <div key={c.id} className="tarjeta mb-2 flex items-center justify-between !p-3">
          <div>
            <div className="text-sm">{nombreLead(c.leadId)}</div>
            <div className="text-xs text-gris">{(c.fecha || "").replace("T", " · ")}</div>
          </div>
          <select
            className="campo !w-36 !py-1 text-xs"
            value={c.estado}
            onChange={(e) => cambiarEstado(c.id, e.target.value)}
          >
            {ESTADOS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      ))}
      {consultas.length === 0 && (
        <p className="text-sm text-gris">Sin consultas agendadas todavía.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Fuentes / UTM

function Fuentes({ data, commit, ws }) {
  const enlaces = data[ws]?.enlacesUTM || [];
  const [nuevo, setNuevo] = useState({ url: "", fuente: "instagram", campana: "" });

  const generar = (e) => {
    e.preventDefault();
    if (!nuevo.url) return;
    const id = uid("utm");
    const enlace = `${nuevo.url}${nuevo.url.includes("?") ? "&" : "?"}utm_source=${
      nuevo.fuente
    }&utm_campaign=${nuevo.campana || id}`;
    const siguiente = structuredClone(data);
    // si se re-agrega uno borrado, la señal 'revivir' levanta la lápida
    siguiente[ws].revivir = { enlacesUTM: [id] };
    siguiente[ws].enlacesUTM = [...enlaces, { id, ...nuevo, enlace }];
    commit(siguiente);
    setNuevo({ url: "", fuente: "instagram", campana: "" });
  };

  const borrar = (id) => {
    // borrar por LÁPIDA, nunca por omisión (autocorreccion #2)
    const siguiente = structuredClone(data);
    const borrados = siguiente[ws].borrados || {};
    borrados.enlacesUTM = [...(borrados.enlacesUTM || []), id];
    siguiente[ws].borrados = borrados;
    siguiente[ws].enlacesUTM = enlaces.filter((u) => u.id !== id);
    commit(siguiente);
  };

  return (
    <div>
      <Encabezado
        titulo="Fuentes / UTM"
        sub="fuente = utm_source (canal real) · type = formulario (valor fijo)"
      />
      <form onSubmit={generar} className="tarjeta mb-6 grid gap-3 sm:grid-cols-4">
        <input
          className="campo sm:col-span-2"
          placeholder="URL destino (https://...)"
          value={nuevo.url}
          onChange={(e) => setNuevo({ ...nuevo, url: e.target.value })}
        />
        <select
          className="campo"
          value={nuevo.fuente}
          onChange={(e) => setNuevo({ ...nuevo, fuente: e.target.value })}
        >
          {(cfg(data, ws).fuentes || []).map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <button className="boton">Generar enlace</button>
      </form>

      {enlaces.map((u) => (
        <div key={u.id} className="tarjeta mb-2 flex items-center justify-between gap-3 !p-3">
          <code className="min-w-0 flex-1 truncate text-xs text-oro">{u.enlace}</code>
          <div className="flex shrink-0 gap-2">
            <button
              className="boton-secundario !px-2 !py-1 text-xs"
              onClick={() => navigator.clipboard?.writeText(u.enlace)}
            >
              Copiar
            </button>
            <button
              className="boton-secundario !border-red-400/40 !px-2 !py-1 text-xs !text-red-400"
              onClick={() => borrar(u.id)}
            >
              Borrar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Compradores (cicloderiqueza)

function Compradores({ data, commit, ws }) {
  const compradores = data[ws]?.compradores || [];
  const config = cfg(data, ws);
  const [nuevo, setNuevo] = useState({ email: "", plataforma: "Hotmart", idioma: "es" });

  const agregar = (e) => {
    e.preventDefault();
    if (!nuevo.email) return;
    const siguiente = structuredClone(data);
    siguiente[ws].compradores = [
      ...compradores,
      {
        id: uid("compra"),
        ...nuevo,
        fecha: hoyISO(),
        accesoApp: true,
        bonos: true,
        reembolsado: false,
      },
    ];
    commit(siguiente);
    setNuevo({ email: "", plataforma: "Hotmart", idioma: "es" });
  };

  const marcarReembolso = (id) => {
    // garantía 7 días: el reembolso revoca app y bonos (regla del producto)
    const siguiente = structuredClone(data);
    const c = siguiente[ws].compradores.find((x) => x.id === id);
    if (c) {
      c.reembolsado = true;
      c.accesoApp = false;
      c.bonos = false;
      const u = (siguiente[ws].app_usuarios || []).find((x) => x.email === c.email);
      if (u) u.revocado = true;
    }
    commit(siguiente);
  };

  return (
    <div>
      <Encabezado
        titulo="Compradores"
        sub={`Producto a ${config.precio || "44 USD"} · garantía de 7 días`}
      />
      <form onSubmit={agregar} className="tarjeta mb-6 grid gap-3 sm:grid-cols-4">
        <input
          className="campo"
          type="email"
          placeholder="Email"
          value={nuevo.email}
          onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
        />
        <select
          className="campo"
          value={nuevo.plataforma}
          onChange={(e) => setNuevo({ ...nuevo, plataforma: e.target.value })}
        >
          {["Hotmart", "ClickBank", "ThriveCart"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          className="campo"
          value={nuevo.idioma}
          onChange={(e) => setNuevo({ ...nuevo, idioma: e.target.value })}
        >
          <option value="es">ES</option>
          <option value="en">EN</option>
        </select>
        <button className="boton">Registrar compra</button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-gris/20 text-left text-gris">
              <th className="p-2">Email</th>
              <th className="p-2">Plataforma</th>
              <th className="p-2">Idioma</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Estado</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {compradores.map((c) => (
              <tr key={c.id} className="border-b border-gris/10">
                <td className="p-2">{c.email}</td>
                <td className="p-2 text-gris">{c.plataforma}</td>
                <td className="p-2 text-gris">{(c.idioma || "es").toUpperCase()}</td>
                <td className="p-2 text-gris">{c.fecha}</td>
                <td className="p-2">
                  {c.reembolsado ? (
                    <span className="text-red-400">Reembolsado · acceso revocado</span>
                  ) : (
                    <span className="text-oro">Activo</span>
                  )}
                </td>
                <td className="p-2">
                  {!c.reembolsado && (
                    <button
                      className="boton-secundario !border-red-400/40 !px-2 !py-1 text-xs !text-red-400"
                      onClick={() => marcarReembolso(c.id)}
                    >
                      Reembolso
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {compradores.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gris">
                  Sin compras registradas. Los webhooks de Hotmart/ClickBank/ThriveCart
                  entrarán por n8n (fase 3).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Afiliados (cicloderiqueza)

function Afiliados({ data, commit, ws }) {
  const afiliados = data[ws]?.afiliados || [];
  const [nuevo, setNuevo] = useState({ canal: "", vertical: "finanzas e inversión" });
  const VERTICALES = [
    "productividad/hábitos",
    "mentalidad",
    "finanzas e inversión",
    "crecimiento personal",
    "crecimiento profesional",
  ];

  const agregar = (e) => {
    e.preventDefault();
    if (!nuevo.canal) return;
    const siguiente = structuredClone(data);
    siguiente[ws].afiliados = [
      ...afiliados,
      { id: uid("afi"), ...nuevo, estado: "prospecto", fitScore: null },
    ];
    commit(siguiente);
    setNuevo({ canal: "", vertical: VERTICALES[2] });
  };

  return (
    <div>
      <Encabezado
        titulo="Afiliados / Embajadores"
        sub="YouTubers de las 5 verticales · comisión se define en la llamada de partners"
      />
      <form onSubmit={agregar} className="tarjeta mb-6 grid gap-3 sm:grid-cols-3">
        <input
          className="campo"
          placeholder="Canal de YouTube (URL o @handle)"
          value={nuevo.canal}
          onChange={(e) => setNuevo({ ...nuevo, canal: e.target.value })}
        />
        <select
          className="campo"
          value={nuevo.vertical}
          onChange={(e) => setNuevo({ ...nuevo, vertical: e.target.value })}
        >
          {VERTICALES.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <button className="boton">Agregar</button>
      </form>

      {afiliados.map((a) => (
        <div key={a.id} className="tarjeta mb-2 flex items-center justify-between !p-3">
          <div>
            <div className="text-sm">{a.canal}</div>
            <div className="text-xs text-gris">
              {a.vertical} · Fit Score: {a.fitScore ?? "por calcular (fase 4)"}
            </div>
          </div>
          <span className="text-xs text-oro">{a.estado}</span>
        </div>
      ))}
      {afiliados.length === 0 && (
        <p className="text-sm text-gris">
          El descubrimiento automático (skill youtube-embajadores) llega en la fase 4.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- App usuarios (Calculadora Pro)

function AppUsuarios({ data, ws }) {
  const usuarios = data[ws]?.app_usuarios || [];
  const limite = cfg(data, ws).appGratisPrimerosN || 0;
  const vitalicios = usuarios.filter((u) => u.vitalicio && !u.revocado).length;

  return (
    <div>
      <Encabezado
        titulo="App · Calculadora Pro"
        sub={`Gratis de por vida para los primeros ${limite} compradores · ${vitalicios} otorgados`}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-gris/20 text-left text-gris">
              <th className="p-2">Email</th>
              <th className="p-2">Vitalicio</th>
              <th className="p-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.email} className="border-b border-gris/10">
                <td className="p-2">{u.email}</td>
                <td className="p-2 text-gris">{u.vitalicio ? "Sí" : "No"}</td>
                <td className="p-2">
                  {u.revocado ? (
                    <span className="text-red-400">Revocado</span>
                  ) : (
                    <span className="text-oro">Activo</span>
                  )}
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-gris">
                  Las credenciales las genera n8n al confirmarse cada compra (fase 3).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Contenido: reemplazado por el Estudio unificado (EstudioUnificado.jsx)

// ---------------------------------------------------------------- Nurturing

function Nurturing({ data, commit, ws, recargar }) {
  const nur = data[ws]?.nurturing || {};
  const cfgNur = nur.config || {};
  const [config, setConfig] = useState({
    persona: cfgNur.persona || "",
    oferta: cfgNur.oferta || "",
    remitente: cfgNur.remitente || "",
    nCorreos: cfgNur.nCorreos || 5,
    cadenciaDias: cfgNur.cadenciaDias || 3,
    topeDiario: cfgNur.topeDiario || 30,
    autoInscribir: cfgNur.autoInscribir ?? true,
  });
  const [estado, setEstado] = useState("");
  const [cargando, setCargando] = useState(false);

  const llamar = async (ruta, body, mensajeOk) => {
    setCargando(true);
    setEstado("");
    try {
      const r = await motorPost(ruta, { ...body, workspace: ws });
      setEstado(mensajeOk(r));
      await recargar();
    } catch (e) {
      setEstado(String(e.message || e));
    } finally {
      setCargando(false);
    }
  };

  const editarCorreo = (i, campo, valor) => {
    const siguiente = structuredClone(data);
    siguiente[ws].nurturing.secuencia[i][campo] = valor;
    commit(siguiente);
  };

  const activos = (nur.inscritos || []).filter((x) => x.estado === "activo").length;
  const metricas = nur.metricas || {};

  return (
    <div>
      <Encabezado
        titulo="Nurturing"
        sub="La IA genera la secuencia desde la config; nada se envía hasta revisar y activar"
      />
      {estado && <p className="mb-4 text-sm text-oro">{estado}</p>}

      <div className="tarjeta mb-6 grid gap-3 sm:grid-cols-2">
        <input className="campo" placeholder="Persona (a quién le escribes)"
          value={config.persona} onChange={(e) => setConfig({ ...config, persona: e.target.value })} />
        <input className="campo" placeholder="Oferta"
          value={config.oferta} onChange={(e) => setConfig({ ...config, oferta: e.target.value })} />
        <input className="campo" placeholder="Remitente (hello@...)"
          value={config.remitente} onChange={(e) => setConfig({ ...config, remitente: e.target.value })} />
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-gris">
            Correos
            <input className="campo mt-1" type="number" min="2" max="9" value={config.nCorreos}
              onChange={(e) => setConfig({ ...config, nCorreos: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-gris">
            Cadencia (días)
            <input className="campo mt-1" type="number" min="1" value={config.cadenciaDias}
              onChange={(e) => setConfig({ ...config, cadenciaDias: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-gris">
            Tope diario
            <input className="campo mt-1" type="number" min="1" value={config.topeDiario}
              onChange={(e) => setConfig({ ...config, topeDiario: Number(e.target.value) })} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-crema/80">
          <input type="checkbox" checked={config.autoInscribir}
            onChange={(e) => setConfig({ ...config, autoInscribir: e.target.checked })} />
          Auto-inscribir leads elegibles
        </label>
        <div className="flex gap-2">
          <button className="boton" disabled={cargando}
            onClick={() => llamar("/nurturing/generar", { config }, (r) => `Secuencia generada: ${r.correos} correos. Revísala abajo.`)}>
            {cargando ? "Generando..." : "Generar secuencia (IA)"}
          </button>
          <button
            className={nur.activo ? "boton-secundario !border-red-400/40 !text-red-400" : "boton-secundario"}
            disabled={cargando}
            onClick={() => llamar("/nurturing/activar", { activo: !nur.activo },
              (r) => (r.activo ? "Nurturing ACTIVO." : "Nurturing pausado."))}
          >
            {nur.activo ? "Pausar" : "Activar"}
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi etiqueta="Inscritos activos" valor={activos} />
        <Kpi etiqueta="Correos enviados" valor={metricas.enviados || 0} />
        <Kpi etiqueta="Aperturas" valor={metricas.aperturas || 0} />
      </div>

      {(nur.secuencia || []).map((correo, i) => (
        <div key={i} className="tarjeta mb-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-gris">
            Correo {i + 1} · {correo.fase}
          </div>
          <input className="campo mb-2" value={correo.asunto || ""}
            onChange={(e) => editarCorreo(i, "asunto", e.target.value)} />
          <textarea className="campo min-h-24" value={correo.cuerpo || ""}
            onChange={(e) => editarCorreo(i, "cuerpo", e.target.value)} />
        </div>
      ))}
      {(!nur.secuencia || nur.secuencia.length === 0) && (
        <p className="text-sm text-gris">
          Sin secuencia todavía. Completa la config y pulsa "Generar secuencia".
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Accesos

function Accesos({ data, commit, ws }) {
  const [nuevaClave, setNuevaClave] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [secretos, setSecretos] = useState({});
  const [valores, setValores] = useState({});
  const [buzones, setBuzones] = useState([]);
  const [buzonNuevo, setBuzonNuevo] = useState({ email: "", password: "" });
  const [estadoBuzon, setEstadoBuzon] = useState("");

  const cargarBuzones = () =>
    motorGet("/buzones").then((r) => setBuzones(r.buzones || [])).catch(() => {});

  useEffect(() => {
    estadoSecretos().then(setSecretos);
    cargarBuzones();
  }, []);

  const guardarBuzon = async () => {
    setEstadoBuzon("");
    try {
      await motorPost("/buzones", buzonNuevo);
      const prueba = await motorPost("/buzones/probar", { email: buzonNuevo.email });
      setEstadoBuzon(prueba.ok ? "Buzón conectado." : `Guardado, pero falló la conexión: ${prueba.error}`);
      setBuzonNuevo({ email: "", password: "" });
      cargarBuzones();
    } catch (e) {
      setEstadoBuzon(String(e.message || e));
    }
  };

  const rotarClave = async (e) => {
    e.preventDefault();
    const ok = await cambiarClave(nuevaClave);
    setMensaje(ok ? "Clave actualizada." : "No se pudo cambiar la clave (mínimo 8 caracteres).");
    if (ok) setNuevaClave("");
  };

  const guardar = async (clave) => {
    const valor = valores[clave];
    if (!valor) return;
    const ok = await guardarSecreto(clave, valor);
    if (ok) {
      setValores({ ...valores, [clave]: "" });
      setSecretos(await estadoSecretos());
    }
  };

  return (
    <div>
      <Encabezado
        titulo="Accesos"
        sub="Los secretos viven en el vault del servidor; aquí solo se escriben, nunca se leen"
      />

      <form onSubmit={rotarClave} className="tarjeta mb-6 max-w-md space-y-3">
        <div className="text-sm font-semibold">Clave del Centro de Mando</div>
        <input
          className="campo"
          type="password"
          placeholder="Nueva clave (mínimo 8 caracteres)"
          value={nuevaClave}
          onChange={(e) => setNuevaClave(e.target.value)}
        />
        <button className="boton" disabled={nuevaClave.length < 8}>
          Rotar clave
        </button>
        {mensaje && <p className="text-xs text-gris">{mensaje}</p>}
        <p className="text-xs text-gris/70">
          Los flujos de n8n usan la CRON_KEY estable: rotar esta clave no los rompe.
        </p>
      </form>

      <div className="tarjeta mb-6 max-w-md space-y-3">
        <div className="text-sm font-semibold">Buzones de correo (SMTP)</div>
        {buzones.map((b) => (
          <div key={b.email} className="text-sm text-gris">
            {b.email} · {b.host}:{b.puerto} {b.tienePassword ? "· conectado" : "· sin contraseña"}
          </div>
        ))}
        <input className="campo" type="email" placeholder="hello@atlantisglobalrealty.com"
          value={buzonNuevo.email}
          onChange={(e) => setBuzonNuevo({ ...buzonNuevo, email: e.target.value })} />
        <input className="campo" type="password" placeholder="Contraseña del webmail"
          autoComplete="off" value={buzonNuevo.password}
          onChange={(e) => setBuzonNuevo({ ...buzonNuevo, password: e.target.value })} />
        <button className="boton" disabled={!buzonNuevo.email || !buzonNuevo.password}
          onClick={guardarBuzon}>
          Guardar y probar conexión
        </button>
        {estadoBuzon && <p className="text-xs text-gris">{estadoBuzon}</p>}
        <p className="text-xs text-gris/70">
          Default Hostinger (smtp.hostinger.com:465). La contraseña va al servidor y
          nunca se vuelve a mostrar.
        </p>
      </div>

      <TarjetaPush />

      <TarjetaPortales data={data} commit={commit} ws={ws} />

      <div className="mb-2 text-sm font-semibold">Claves de API (vault del servidor)</div>
      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(secretos).map(([clave, info]) => (
          <div key={clave} className="tarjeta !p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold">{clave}</span>
              <span className={`text-xs ${info.valido ? "text-oro" : "text-gris/50"}`}>
                {info.valido ? info.mascara : "sin configurar"}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                className="campo !py-1 text-xs"
                type="password"
                placeholder="Pegar valor nuevo"
                value={valores[clave] || ""}
                onChange={(e) => setValores({ ...valores, [clave]: e.target.value })}
                autoComplete="off"
              />
              <button
                className="boton-secundario !px-3 !py-1 text-xs"
                onClick={() => guardar(clave)}
                disabled={!valores[clave]}
              >
                Guardar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
