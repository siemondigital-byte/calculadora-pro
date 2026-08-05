// Módulos portados del núcleo Siemon: Proyectos, Presupuestos, Facturación,
// Clientes y Agente de redes 24/7. Mismo lenguaje visual del panel (tarjeta/campo/boton).
import React, { useEffect, useState } from "react";
import { guardarSecreto, motorGet, motorPost } from "./db.js";

const hoyISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

function Cab({ titulo, sub }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold">{titulo}</h1>
      {sub && <p className="mt-1 text-sm text-gris">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Proyectos

export function Proyectos({ data, commit, ws, recargar }) {
  const proyectos = data.atlantis?.proyectos || [];
  const [link, setLink] = useState("");
  const [estado, setEstado] = useState("");
  const [busy, setBusy] = useState("");
  const ESTADOS = ["borrador", "en revisión", "publicado", "en venta", "cerrado"];

  const llamar = async (etq, ruta, body, okMsg) => {
    setBusy(etq);
    setEstado("");
    try {
      const r = await motorPost(ruta, body);
      setEstado(okMsg(r));
      await recargar();
    } catch (e) {
      setEstado(String(e.message || e));
    } finally {
      setBusy("");
    }
  };

  const subirPdf = (ev) => {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    const lector = new FileReader();
    lector.onload = () =>
      llamar("pdf", "/proyectos/extraer_pdf", { pdf_b64: lector.result, nombre: f.name },
        (r) => `Ficha creada: ${r.slug} (borrador). Revísala abajo.`);
    lector.readAsDataURL(f);
  };

  const actualizar = (slug, campos) =>
    llamar("act-" + slug, "/proyectos/actualizar", { slug, ...campos }, () => "Guardado.");

  if (ws !== "atlantis")
    return <p className="text-gris">Los proyectos inmobiliarios viven en el workspace de Atlantis.</p>;

  return (
    <div>
      <Cab titulo="Proyectos" sub="Sube la presentación del constructor o pega el link: la ficha se arma sola, le haces seguimiento y publicas su landing conectada a la web" />

      <div className="tarjeta mb-4 grid gap-3 sm:grid-cols-3">
        <input className="campo sm:col-span-2" placeholder="Link del proyecto (https://... del constructor)"
          value={link} onChange={(e) => setLink(e.target.value)} />
        <button className="boton" disabled={!!busy || !link.trim()}
          onClick={() => llamar("link", "/proyectos/extraer_link", { url: link.trim() },
            (r) => { setLink(""); return `Ficha creada: ${r.slug} (borrador).`; })}>
          {busy === "link" ? "Leyendo…" : "Extraer del link"}
        </button>
        <label className="boton-secundario cursor-pointer text-center sm:col-span-3">
          {busy === "pdf" ? "Leyendo el PDF…" : "📄 Subir presentación (PDF)"}
          <input type="file" accept="application/pdf" className="hidden" onChange={subirPdf} />
        </label>
      </div>

      {estado && <p className="mb-4 text-sm text-oro">{estado}</p>}

      {proyectos.map((p) => (
        <div key={p.slug} className="tarjeta mb-3 !p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">{p.es?.nombre || p.slug}</div>
              <div className="text-xs text-gris">
                {p.ciudad} · {p.pais} · {p.constructora} · Entrega {p.entrega} · {p.precioDesde}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="campo !w-auto !py-1 text-xs" value={p.estado || "borrador"}
                onChange={(e) => actualizar(p.slug, { estado: e.target.value })}>
                {ESTADOS.map((s) => <option key={s}>{s}</option>)}
              </select>
              <input type="date" className="campo !w-auto !py-1 text-xs" value={p.seguimientoFecha || ""}
                title="Próximo seguimiento"
                onChange={(e) => actualizar(p.slug, { seguimientoFecha: e.target.value })} />
              <button className="boton-secundario !px-2 !py-1 text-xs" disabled={!!busy}
                onClick={() => llamar("pub-" + p.slug, "/proyectos/publicar_landing", { slug: p.slug },
                  (r) => `Landing publicada y conectada al índice: ${r.url}`)}>
                {busy === "pub-" + p.slug ? "Publicando…" : p.landingUrl ? "Republicar landing" : "Publicar landing"}
              </button>
              {p.landingUrl && (
                <a href={p.landingUrl} target="_blank" rel="noreferrer" className="text-xs text-oro hover:underline">
                  ver landing ↗
                </a>
              )}
            </div>
          </div>
          <textarea className="campo mt-2 min-h-16 text-xs" placeholder="Notas de seguimiento del proyecto…"
            defaultValue={p.notas || ""} onBlur={(e) => { if (e.target.value !== (p.notas || "")) actualizar(p.slug, { notas: e.target.value }); }} />
          <textarea className="campo mt-2 min-h-12 text-xs"
            placeholder="Imágenes del proyecto (una URL https por línea; la primera es la portada)"
            defaultValue={(p.imagenes || []).join("\n")}
            onBlur={(e) => {
              const urls = e.target.value.split("\n").map((x) => x.trim()).filter((x) => x.startsWith("http"));
              if (urls.join() !== (p.imagenes || []).join()) actualizar(p.slug, { imagenes: urls });
            }} />
        </div>
      ))}
      {proyectos.length === 0 && (
        <p className="text-sm text-gris">Sin proyectos todavía. Sube la presentación del constructor (PDF) o pega el link de arriba.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Presupuestos

export function Presupuestos({ data, commit, ws, recargar }) {
  const presus = data[ws]?.presupuestos || [];
  const leads = data[ws]?.leads || [];
  const proyectos = data.atlantis?.proyectos || [];
  const prototipos = data[ws]?.prototipos || [];
  const [leadId, setLeadId] = useState("");
  const [sel, setSel] = useState([]);
  const [proto, setProto] = useState("");
  const [estado, setEstado] = useState("");
  const [busy, setBusy] = useState("");

  const generar = async () => {
    if (!leadId) return setEstado("Elige primero el lead.");
    setBusy("gen");
    setEstado("");
    try {
      const r = await motorPost("/presupuestos/generar",
        { workspace: ws, leadId, proyectos: sel, prototipo: proto.trim() });
      setEstado(`Propuesta ${r.presupuesto.folio} lista (borrador). Publícala abajo.`);
      setSel([]); setProto("");
      await recargar();
    } catch (e) { setEstado(String(e.message || e)); }
    finally { setBusy(""); }
  };

  const publicar = async (folio) => {
    setBusy(folio);
    try {
      const r = await motorPost("/presupuestos/publicar", { folio });
      setEstado(`Página publicada: ${r.url}`);
      await recargar();
    } catch (e) { setEstado(String(e.message || e)); }
    finally { setBusy(""); }
  };

  const enviar = async (p) => {
    if (!p.email) return setEstado("Ese lead no tiene correo.");
    if (!p.url) return setEstado("Publica la página primero.");
    setBusy("env" + p.folio);
    try {
      const cuerpo = `<p>Hola ${p.nombre || ""},</p><p>Preparé una propuesta pensada para tu caso, con el detalle de ${(p.proyectos || []).length > 1 ? "los proyectos" : "el proyecto"} que te ${(p.proyectos || []).length > 1 ? "interesan" : "interesa"}:</p><p><a href="${p.url}">${p.url}</a></p><p>Cuando la veas, me cuentas y agendamos el diagnóstico para revisar los números juntos.</p><p>Un saludo,<br>Atlantis Global Realty</p>`;
      await motorPost("/enviar_correo", { para: p.email, asunto: p.titulo || `Tu propuesta ${p.folio}`, cuerpo, workspace: ws });
      setEstado(`Propuesta enviada a ${p.email}.`);
      await recargar();
    } catch (e) { setEstado(String(e.message || e)); }
    finally { setBusy(""); }
  };

  return (
    <div>
      <Cab titulo="Presupuestos" sub="Propuesta personalizada según el perfil del lead + su(s) proyecto(s) de interés, con página de marca publicable y enviable" />

      <div className="tarjeta mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <select className="campo" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">Lead…</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.nombre || l.email}</option>)}
          </select>
          <select className="campo" value={proto} onChange={(e) => setProto(e.target.value)}>
            <option value="">Prototipo vinculado (opcional)…</option>
            {prototipos.map((pt) => (pt.url || pt.publicUrl) && (
              <option key={pt.id || pt.slug} value={pt.url || pt.publicUrl}>{pt.nombre || pt.slug}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {proyectos.map((p) => {
            const on = sel.includes(p.slug);
            return (
              <button key={p.slug}
                className={`boton-secundario !px-2 !py-1 text-xs ${on ? "!border-oro !text-oro" : ""}`}
                onClick={() => setSel(on ? sel.filter((s) => s !== p.slug) : [...sel, p.slug])}>
                {on ? "✓ " : ""}{p.es?.nombre || p.slug}
              </button>
            );
          })}
          {proyectos.length === 0 && <span className="text-xs text-gris">Sin proyectos aún (créalos en Proyectos).</span>}
        </div>
        <button className="boton mt-3" disabled={busy === "gen"} onClick={generar}>
          {busy === "gen" ? "Armando la propuesta…" : "Generar propuesta con IA"}
        </button>
      </div>

      {estado && <p className="mb-4 text-sm text-oro">{estado}</p>}

      {presus.map((p) => (
        <div key={p.folio} className="tarjeta mb-3 !p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">{p.folio} · {p.nombre || p.email}</div>
              <div className="text-xs text-gris">
                {(p.proyectos || []).join(", ") || "sin proyecto"} · estado: <b className={p.estado === "aceptado" ? "text-oro" : ""}>{p.estado}</b>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="boton-secundario !px-2 !py-1 text-xs" disabled={busy === p.folio}
                onClick={() => publicar(p.folio)}>
                {busy === p.folio ? "Publicando…" : p.url ? "Republicar página" : "Publicar página"}
              </button>
              {p.url && (<>
                <a href={p.url} target="_blank" rel="noreferrer" className="boton-secundario !px-2 !py-1 text-xs">ver ↗</a>
                <button className="boton-secundario !px-2 !py-1 text-xs"
                  onClick={() => { navigator.clipboard?.writeText(p.url); setEstado("Link copiado."); }}>copiar link</button>
                <button className="boton-secundario !px-2 !py-1 text-xs" disabled={busy === "env" + p.folio}
                  onClick={() => enviar(p)}>{busy === "env" + p.folio ? "Enviando…" : "Enviar por correo"}</button>
              </>)}
            </div>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gris">{p.intro}</p>
        </div>
      ))}
      {presus.length === 0 && <p className="text-sm text-gris">Sin presupuestos todavía.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Facturación

export function Facturacion({ data, commit, ws }) {
  const facturas = data[ws]?.facturas || [];
  const presus = data[ws]?.presupuestos || [];
  const moneda = data[ws]?.config?.moneda || "USD";
  const [nueva, setNueva] = useState({ nombre: "", concepto: "", monto: "", vence: "" });
  const ESTADOS = ["borrador", "enviada", "pagada", "vencida"];

  const patch = (facts) => commit({ ...data, [ws]: { ...data[ws], facturas: facts } });
  const crear = (campos) => {
    const folio = `F-${new Date().getFullYear()}-${String(facturas.length + 1).padStart(3, "0")}`;
    patch([{ id: uid(), folio, estado: "borrador", fecha: hoyISO(), moneda, ...campos }, ...facturas]);
  };

  const tot = (est) => facturas.filter((f) => f.estado === est)
    .reduce((s, f) => s + (Number(f.monto) || 0), 0);
  const porCobrar = facturas.filter((f) => ["enviada", "vencida", "borrador"].includes(f.estado))
    .reduce((s, f) => s + (Number(f.monto) || 0), 0);
  const aceptadosSinFactura = presus.filter((p) => p.estado === "aceptado"
    && !facturas.some((f) => f.presupuesto === p.folio));

  return (
    <div>
      <Cab titulo="Facturación" sub="Facturas del negocio: crea, cambia el estado y mira lo cobrado vs por cobrar" />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="tarjeta !p-4"><div className="text-xs uppercase text-gris">Pagado</div>
          <div className="text-2xl font-semibold text-oro">{tot("pagada").toLocaleString()} {moneda}</div></div>
        <div className="tarjeta !p-4"><div className="text-xs uppercase text-gris">Por cobrar</div>
          <div className="text-2xl font-semibold">{porCobrar.toLocaleString()} {moneda}</div></div>
        <div className="tarjeta !p-4"><div className="text-xs uppercase text-gris">Vencido</div>
          <div className="text-2xl font-semibold text-red-400">{tot("vencida").toLocaleString()} {moneda}</div></div>
      </div>

      {aceptadosSinFactura.length > 0 && (
        <div className="tarjeta mb-4 !p-4">
          <div className="mb-2 text-xs uppercase text-gris">Propuestas aceptadas sin factura</div>
          {aceptadosSinFactura.map((p) => (
            <div key={p.folio} className="mb-1 flex items-center justify-between text-sm">
              <span>{p.folio} · {p.nombre || p.email}</span>
              <button className="boton-secundario !px-2 !py-1 text-xs"
                onClick={() => crear({ nombre: p.nombre || p.email, concepto: p.titulo || `Propuesta ${p.folio}`, monto: 0, presupuesto: p.folio })}>
                Facturar
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="tarjeta mb-4 grid gap-3 sm:grid-cols-5">
        <input className="campo" placeholder="Cliente" value={nueva.nombre}
          onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
        <input className="campo" placeholder="Concepto" value={nueva.concepto}
          onChange={(e) => setNueva({ ...nueva, concepto: e.target.value })} />
        <input className="campo" type="number" placeholder={`Monto (${moneda})`} value={nueva.monto}
          onChange={(e) => setNueva({ ...nueva, monto: e.target.value })} />
        <input className="campo" type="date" value={nueva.vence}
          onChange={(e) => setNueva({ ...nueva, vence: e.target.value })} />
        <button className="boton" disabled={!nueva.nombre || !nueva.monto}
          onClick={() => { crear({ ...nueva, monto: Number(nueva.monto) }); setNueva({ nombre: "", concepto: "", monto: "", vence: "" }); }}>
          Crear factura
        </button>
      </div>

      {facturas.map((f) => (
        <div key={f.id} className="tarjeta mb-2 flex flex-wrap items-center justify-between gap-2 !p-3">
          <div>
            <div className="text-sm">{f.folio} · {f.nombre} <span className="text-gris">· {f.concepto}</span></div>
            <div className="text-xs text-gris">{f.fecha}{f.vence ? ` · vence ${f.vence}` : ""}{f.presupuesto ? ` · de ${f.presupuesto}` : ""}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{Number(f.monto || 0).toLocaleString()} {f.moneda || moneda}</span>
            <select className="campo !w-auto !py-1 text-xs" value={f.estado}
              onChange={(e) => patch(facturas.map((x) => x.id === f.id ? { ...x, estado: e.target.value } : x))}>
              {ESTADOS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      ))}
      {facturas.length === 0 && <p className="text-sm text-gris">Sin facturas todavía.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Clientes

export function Clientes({ data, commit, ws }) {
  const ETAPAS_CLIENTE = ["Cliente", "Comprador", "En proyecto"];
  const leads = (data[ws]?.leads || []).filter((l) => ETAPAS_CLIENTE.includes(l.etapa));
  const compradores = ws === "cicloderiqueza" ? (data[ws]?.compradores || []) : [];

  const tocar = (id) => {
    const sig = structuredClone(data);
    const l = sig[ws].leads.find((x) => x.id === id);
    if (!l) return;
    l.ultimoContacto = hoyISO();
    const d = new Date(); d.setDate(d.getDate() + 30);
    l.followUpDate = d.toISOString().slice(0, 10);
    commit(sig);
  };

  return (
    <div>
      <Cab titulo="Clientes" sub="Quiénes ya son clientes o compradores, su check-in y el próximo toque" />
      {leads.map((l) => (
        <div key={l.id} className="tarjeta mb-2 flex flex-wrap items-center justify-between gap-2 !p-3">
          <div>
            <div className="text-sm">{l.nombre || l.email} <span className="text-xs text-gris">· {l.etapa}</span></div>
            <div className="text-xs text-gris">
              {l.email}{l.ultimoContacto ? ` · último toque ${l.ultimoContacto}` : " · sin toque registrado"}
              {l.followUpDate ? ` · próximo ${l.followUpDate}` : ""}
            </div>
          </div>
          <button className="boton-secundario !px-2 !py-1 text-xs" onClick={() => tocar(l.id)}>
            ✓ Registrar toque (+30 días)
          </button>
        </div>
      ))}
      {leads.length === 0 && <p className="mb-4 text-sm text-gris">Aún no hay leads en etapa Cliente/Comprador/En proyecto.</p>}
      {compradores.length > 0 && (
        <div className="tarjeta mt-4 !p-4">
          <div className="mb-2 text-xs uppercase text-gris">Compradores del producto ({compradores.length})</div>
          {compradores.slice(0, 30).map((c, i) => (
            <div key={i} className="text-sm text-crema/90">{c.nombre || c.email} <span className="text-xs text-gris">· {c.email}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------- Conversaciones del proyecto (Claude)

export function Conversaciones() {
  const [lista, setLista] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const cargar = () => motorGet("/conversaciones/lista").then((r) => setLista(r.conversaciones || [])).catch(() => {});
  useEffect(() => { cargar(); }, []);

  const subir = (ev) => {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    setBusy(true);
    const lector = new FileReader();
    lector.onload = async () => {
      try {
        await motorPost("/conversaciones/subir", { nombre: f.name, texto: String(lector.result || "") });
        setMsg(`Guardada: ${f.name}. El RAG la está aprendiendo.`);
        cargar();
      } catch (e) { setMsg(String(e.message || e)); }
      finally { setBusy(false); }
    };
    lector.readAsText(f);
  };

  const descargar = async (nombre) => {
    try {
      const r = await motorGet(`/conversaciones/leer/${encodeURIComponent(nombre)}`);
      const blob = new Blob([r.texto], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { setMsg(String(e.message || e)); }
  };

  const borrar = async (nombre) => {
    if (!window.confirm(`¿Borrar ${nombre} del servidor?`)) return;
    await motorPost("/conversaciones/borrar", { nombre });
    cargar();
  };

  return (
    <div>
      <Cab titulo="Conversaciones del proyecto" sub="Sube aquí las conversaciones exportadas de Claude sobre Atlantis: quedan guardadas en el servidor, descargables y el RAG aprende de ellas" />
      <div className="tarjeta mb-4 !p-4">
        <label className="boton cursor-pointer">
          {busy ? "Subiendo…" : "⬆ Subir conversación (.md / .txt / .json)"}
          <input type="file" accept=".md,.txt,.json" className="hidden" onChange={subir} />
        </label>
        {msg && <p className="mt-2 text-xs text-oro">{msg}</p>}
      </div>
      {lista.map((c) => (
        <div key={c.nombre} className="tarjeta mb-2 flex items-center justify-between !p-3">
          <div>
            <div className="text-sm">{c.nombre}</div>
            <div className="text-xs text-gris">{c.fecha} · {c.kb} KB</div>
          </div>
          <div className="flex gap-2">
            <button className="boton-secundario !px-2 !py-1 text-xs" onClick={() => descargar(c.nombre)}>⬇ descargar</button>
            <button className="boton-secundario !border-red-400/40 !px-2 !py-1 text-xs !text-red-400" onClick={() => borrar(c.nombre)}>✕</button>
          </div>
        </div>
      ))}
      {lista.length === 0 && <p className="text-sm text-gris">Aún no hay conversaciones guardadas.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Agente de redes 24/7

export function AgenteRedes({ data, ws, recargar }) {
  const inbound = (data.atlantis?.inbound || []).filter((m) => ["comentario", "dm"].includes(m.socialTipo));
  const [st, setSt] = useState(null);
  const [cfgLocal, setCfgLocal] = useState(null);
  const [estado, setEstado] = useState("");
  const [busy, setBusy] = useState("");
  const [conVals, setConVals] = useState({ META_PAGE_TOKEN: "", META_VERIFY_TOKEN: "", META_PAGE_ID: "", META_IG_ID: "" });
  const [borradores, setBorradores] = useState({});

  const cargar = async () => {
    try { const r = await motorGet("/social/estado"); setSt(r); setCfgLocal(r.config); } catch {}
  };
  useEffect(() => { cargar(); }, []);

  const guardarCfg = async (cambios) => {
    try {
      const r = await motorPost("/social/config", { ...cfgLocal, ...cambios });
      setCfgLocal(r.config);
      setEstado("Configuración guardada.");
    } catch (e) { setEstado(String(e.message || e)); }
  };

  const conectar = async () => {
    setBusy("con");
    let n = 0;
    for (const [k, v] of Object.entries(conVals)) {
      if (v.trim()) { await guardarSecreto(k, v.trim()); n++; }
    }
    setConVals({ META_PAGE_TOKEN: "", META_VERIFY_TOKEN: "", META_PAGE_ID: "", META_IG_ID: "" });
    setBusy("");
    setEstado(n ? "Credenciales de Meta guardadas en el vault." : "Nada que guardar.");
    cargar();
  };

  const redactar = async (m) => {
    setBusy(m.id);
    try {
      const r = await motorPost("/social/responder", { id: m.id });
      setBorradores((b) => ({ ...b, [m.id]: r.borrador }));
    } catch (e) { setEstado(String(e.message || e)); }
    finally { setBusy(""); }
  };

  const enviarresp = async (m) => {
    const texto = (borradores[m.id] ?? m.borrador ?? "").trim();
    if (!texto) return setEstado("Escribe o redacta la respuesta primero.");
    setBusy("env" + m.id);
    try {
      const r = await motorPost("/social/enviar", { id: m.id, texto });
      if (r.ok) { setEstado("Respuesta enviada ✓"); await recargar(); }
      else setEstado(r.nota || r.error || "No se pudo enviar.");
    } catch (e) { setEstado(String(e.message || e)); }
    finally { setBusy(""); }
  };

  return (
    <div>
      <Cab titulo="Agente de redes 24/7" sub="Vigila comentarios y DMs de Instagram/Facebook y responde en la voz de Atlantis (tú apruebas, o solo en modo auto)" />

      {cfgLocal && (
        <div className="tarjeta mb-4 !p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold">
              {cfgLocal.activo ? "🟢 Agente encendido" : "⚪ Agente en pausa"}
            </div>
            <button className="boton" onClick={() => guardarCfg({ activo: !cfgLocal.activo })}>
              {cfgLocal.activo ? "Apagar" : "Encender"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {["borrador", "auto"].map((m) => (
              <button key={m} className={`boton-secundario !px-3 !py-1 text-xs ${cfgLocal.modo === m ? "!border-oro !text-oro" : ""}`}
                onClick={() => guardarCfg({ modo: m })}>
                {m === "borrador" ? "📝 Borrador (yo apruebo)" : "⚡ Responde solo (auto)"}
              </button>
            ))}
            <label className="flex items-center gap-1 text-xs text-gris">
              <input type="checkbox" checked={cfgLocal.responder_comentarios}
                onChange={(e) => guardarCfg({ responder_comentarios: e.target.checked })} /> Comentarios
            </label>
            <label className="flex items-center gap-1 text-xs text-gris">
              <input type="checkbox" checked={cfgLocal.responder_dms}
                onChange={(e) => guardarCfg({ responder_dms: e.target.checked })} /> Mensajes directos
            </label>
          </div>
          <textarea className="campo mt-3 min-h-14 text-xs"
            placeholder="Matiz extra (opcional): ej. invita siempre al diagnóstico gratuito; nunca hables de retornos"
            defaultValue={cfgLocal.instruccion}
            onBlur={(e) => e.target.value !== cfgLocal.instruccion && guardarCfg({ instruccion: e.target.value })} />
        </div>
      )}

      {estado && <p className="mb-4 text-sm text-oro">{estado}</p>}

      {inbound.map((m) => (
        <div key={m.id} className="tarjeta mb-2 !p-4">
          <div className="text-xs text-gris">{m.canal} · {m.socialTipo} · {m.autor} · {m.fecha}
            {m.atendido && <span className="ml-2 text-oro">✓ respondido{m.respondidoAuto ? " (auto)" : ""}</span>}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{m.mensaje}</p>
          {!m.atendido && (
            <div className="mt-2">
              <textarea className="campo min-h-14 text-xs" placeholder="Respuesta (redáctala con IA o escríbela)"
                value={borradores[m.id] ?? m.borrador ?? ""}
                onChange={(e) => setBorradores((b) => ({ ...b, [m.id]: e.target.value }))} />
              <div className="mt-2 flex gap-2">
                <button className="boton-secundario !px-2 !py-1 text-xs" disabled={busy === m.id}
                  onClick={() => redactar(m)}>{busy === m.id ? "Redactando…" : "Redactar con IA"}</button>
                <button className="boton !px-3 !py-1 text-xs" disabled={busy === "env" + m.id}
                  onClick={() => enviarresp(m)}>{busy === "env" + m.id ? "Enviando…" : "Enviar"}</button>
              </div>
            </div>
          )}
        </div>
      ))}
      {inbound.length === 0 && (
        <p className="mb-4 text-sm text-gris">Aún no llegan comentarios ni mensajes. Conecta Meta abajo y aparecerán aquí.</p>
      )}

      <div className="tarjeta mt-4 !p-4">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-sm font-semibold">Conexión con Meta (Instagram / Facebook)</div>
          <span className="text-xs text-gris">{st?.conectado ? "🟢 conectada" : "⚪ sin conectar"}</span>
        </div>
        <p className="mb-2 text-xs leading-relaxed text-gris">
          Un paso de una sola vez en Meta: crear la app, suscribir la página y pegar aquí los datos
          (van al vault cifrado). Webhook: <code className="text-oro">{st?.webhook || "…"}</code>
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.keys(conVals).map((k) => (
            <input key={k} className="campo text-xs" type="password" placeholder={k}
              value={conVals[k]} onChange={(e) => setConVals({ ...conVals, [k]: e.target.value })} />
          ))}
        </div>
        <button className="boton-secundario mt-2 !px-3 !py-1 text-xs" disabled={busy === "con"} onClick={conectar}>
          Guardar conexión
        </button>
      </div>
    </div>
  );
}
