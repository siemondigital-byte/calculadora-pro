import React, { useState } from "react";
import { motorPost } from "./db.js";

// Estudio de mercado · pestaña Salud de tu web (auditoria SEO real + soluciones IA).
// Competencia y Analisis de negocio llegan en la siguiente ronda de porteo.
export default function MercadoView({ data, ws, recargar }) {
  const config = data[ws]?.config || {};
  const [url, setUrl] = useState(config.dominio || "https://atlantisglobalrealty.com/");
  const [keyword, setKeyword] = useState("");
  const [auditoria, setAuditoria] = useState(null);
  const [estado, setEstado] = useState("");
  const [busy, setBusy] = useState("");

  const historial = data[ws]?.saludHistorial || [];
  const saludWeb = data[ws]?.saludWeb;

  const auditar = async () => {
    setBusy("aud");
    setEstado("");
    try {
      const r = await motorPost("/seo/auditar", { url, keyword, workspace: ws });
      if (!r.ok) throw new Error(r.error);
      setAuditoria(r);
      await recargar();
    } catch (e) {
      setEstado(String(e.message || e));
    } finally {
      setBusy("");
    }
  };

  const generarSoluciones = async () => {
    setBusy("sol");
    setEstado("");
    try {
      const r = await motorPost("/seo/soluciones", { url, keyword, workspace: ws });
      if (!r.ok) throw new Error(r.error);
      setEstado(
        "Soluciones generadas y guardadas. Ve al Maquetador para aplicarlas a la home con un clic."
      );
      await recargar();
    } catch (e) {
      setEstado(String(e.message || e));
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-crema">Estudio de mercado</h1>
        <p className="text-sm text-gris">
          Salud de tu web: auditoría SEO real (8 categorías) + soluciones listas para aplicar
        </p>
      </div>

      <div className="tarjeta mb-4 grid gap-3 sm:grid-cols-4">
        <input className="campo sm:col-span-2" value={url}
          onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        <input className="campo" value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Keyword objetivo (opcional)" />
        <div className="flex gap-2">
          <button className="boton flex-1" disabled={!!busy} onClick={auditar}>
            {busy === "aud" ? "Auditando…" : "Auditar"}
          </button>
        </div>
      </div>

      {estado && <p className="mb-4 text-sm text-oro">{estado}</p>}

      {auditoria && (
        <div className="tarjeta mb-4">
          <div className="flex items-baseline justify-between">
            <div className="font-display text-4xl text-oro">{auditoria.global}/100</div>
            {auditoria.competidor && (
              <div className="text-sm text-gris">
                Competidor: {auditoria.competidor.global}/100
              </div>
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(auditoria.categorias || []).map((c) => (
              <div key={c.nombre} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-xs text-gris">{c.nombre}</span>
                <div className="h-2 flex-1 rounded-full bg-navy">
                  <div className="h-2 rounded-full bg-oro"
                    style={{ width: `${Math.round((c.puntos / (c.max || 20)) * 100)}%` }} />
                </div>
                <span className="w-10 text-right text-xs text-crema">
                  {c.puntos}/{c.max || ""}
                </span>
              </div>
            ))}
          </div>
          {(auditoria.top_fixes || []).length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs uppercase tracking-wide text-gris">
                Hallazgos principales
              </div>
              {(auditoria.top_fixes || []).slice(0, 8).map((f, i) => (
                <div key={i} className="border-b border-gris/10 py-1.5 text-sm last:border-0">
                  <span className="text-crema/90">{f.txt}</span>
                  <span className="ml-2 text-xs text-gris">→ {f.fix}</span>
                </div>
              ))}
              <button className="boton mt-3" disabled={!!busy} onClick={generarSoluciones}>
                {busy === "sol" ? "Generando…" : "Generar soluciones con IA"}
              </button>
            </div>
          )}
        </div>
      )}

      {saludWeb?.soluciones && (
        <div className="tarjeta mb-4">
          <div className="mb-2 text-sm font-semibold">
            Soluciones vigentes ({saludWeb.soluciones.fecha})
          </div>
          {saludWeb.soluciones.title_propuesto && (
            <p className="text-sm"><span className="text-gris">Title:</span>{" "}
              <span className="text-oro">{saludWeb.soluciones.title_propuesto}</span></p>
          )}
          {saludWeb.soluciones.description_propuesta && (
            <p className="mt-1 text-sm"><span className="text-gris">Description:</span>{" "}
              {saludWeb.soluciones.description_propuesta}</p>
          )}
          {(saludWeb.soluciones.alts || []).length > 0 && (
            <p className="mt-1 text-xs text-gris">
              + {(saludWeb.soluciones.alts || []).length} alt(s) de imagen propuestos
            </p>
          )}
          <p className="mt-2 text-xs text-oro">
            Aplícalas desde el Maquetador (vista previa antes de escribir).
          </p>
        </div>
      )}

      {historial.length > 0 && (
        <div className="tarjeta">
          <div className="mb-2 text-sm font-semibold">Histórico de salud</div>
          <div className="flex items-end gap-1" style={{ height: 60 }}>
            {historial.slice(-24).map((h, i) => (
              <div key={i} title={`${h.fecha}: ${h.global}/100`}
                className="flex-1 rounded-t bg-oro/60"
                style={{ height: `${h.global}%`, minWidth: 6 }} />
            ))}
          </div>
          <div className="mt-1 text-xs text-gris">
            {historial[historial.length - 1].fecha} · último: {historial[historial.length - 1].global}/100
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-gris/60">
        Competencia (descubrir, precalificar, monitorear) y Análisis de negocio: siguiente
        ronda de porteo desde el código de referencia.
      </p>
    </div>
  );
}
