import React, { useState } from "react";
import { Flame, Youtube, Image as ImageIcon, Scissors, Compass, Wand2, Share2 } from "lucide-react";
import ContenidoView from "./ContenidoView.jsx";
import EstudioContenidoView from "./EstudioContenidoView.jsx";
import VideoEditor from "./VideoEditor.jsx";
import ViralView from "./ViralView.jsx";

const C = {
  panel: "#16171C", line: "rgba(255,255,255,0.08)",
  aether: "#B1A3E1", aether2: "#CBC0EC", aether500: "#8474BE", aetherSoft: "rgba(177,163,225,0.14)",
  aetherLine: "rgba(177,163,225,0.30)", mist: "#C9CAD2",
};
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const TOPS = [
  { id: "identificar", label: "Identificar", icon: Compass },
  { id: "crear", label: "Crear contenido", icon: Wand2 },
  { id: "publicar", label: "Publicar", icon: Share2 },
];

// Módulo unificado en 3 categorías: Identificar (tendencia) → Crear contenido (pieza) → Publicar (redes/historial).
export default function EstudioUnificado({ data, commit, flash, draftExterno, clearDraftExterno }) {
  const [top, setTop] = useState("identificar");
  const [subIdent, setSubIdent] = useState("youtube");
  const [subCrear, setSubCrear] = useState("estudio");
  const [subPublicar, setSubPublicar] = useState("publicar");
  const [pubDraft, setPubDraft] = useState(null);       // medio/texto: estudio/editor → publicar
  const [estudioDraft, setEstudioDraft] = useState(null); // tendencia/contenido → estudio
  const [editorSrc, setEditorSrc] = useState(null);     // video → editor

  // draft que llega de OTRO módulo (ej. Calendario → "Editar/republicar")
  React.useEffect(() => {
    if (!draftExterno) return;
    setPubDraft(draftExterno); setTop("publicar"); setSubPublicar("publicar");
    try { clearDraftExterno && clearDraftExterno(); } catch {}
    // eslint-disable-next-line
  }, [draftExterno]);

  const irAEstudio = (d) => { setEstudioDraft(d); setTop("crear"); setSubCrear("estudio"); };
  const irAPublicar = (d) => { setPubDraft(d); setTop("publicar"); setSubPublicar("publicar"); };
  const irAEditor = (src) => { setEditorSrc(src); setTop("crear"); setSubCrear("editor"); };

  const nPub = (data.siemon?.publicaciones || []).length;
  const nGuard = (data.siemon?.contenidos || []).length;

  const subBar = (items, val, setVal) => (
    <div className="flex flex-wrap gap-2 mb-4">
      {items.map(([id, lb, Ico]) => { const on = id === val; return (
        <button key={id} onClick={() => setVal(id)} style={{ background: on ? C.aetherSoft : C.panel, border: `1px solid ${on ? C.aetherLine : C.line}`, color: on ? C.aether2 : C.mist }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg fs-12 font-medium">{Ico ? <Ico size={13} /> : null}{lb}</button>
      ); })}
    </div>
  );

  // ContenidoView es una sola instancia: sirve el YouTube (dentro de Identificar) y todo Publicar.
  const contenidoVisible = (top === "identificar" && subIdent === "youtube") || top === "publicar";
  const contenidoSubtab = top === "publicar" ? subPublicar : "crear";

  return (
    <div className="p-5 md:p-8" style={{ maxWidth: 1100 }}>
      <div className="mb-4">
        <div style={{ color: C.aether500, fontFamily: MONO, letterSpacing: "0.2em" }} className="fs-10 uppercase mb-2"><span style={{ color: C.aether }}>// </span>Estudio de contenido</div>
        <div className="flex flex-wrap gap-2">
          {TOPS.map((t) => { const on = t.id === top; const Ico = t.icon; return (
            <button key={t.id} onClick={() => setTop(t.id)} style={{ background: on ? C.aetherSoft : C.panel, border: `1px solid ${on ? C.aetherLine : C.line}`, color: on ? C.aether2 : C.mist }} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg fs-13 font-semibold"><Ico size={16} /> {t.label}</button>
          ); })}
        </div>
      </div>

      {/* sub-barra por categoría */}
      {top === "identificar" && subBar([["viral", "Viral", Flame], ["youtube", "YouTube", Youtube]], subIdent, setSubIdent)}
      {top === "crear" && subBar([["estudio", "Imagen · Video · Diseño", ImageIcon], ["editor", "Editor de video", Scissors]], subCrear, setSubCrear)}
      {top === "publicar" && subBar([["publicar", "Publicar en redes", Share2], ["publicaciones", `Publicaciones${nPub ? ` · ${nPub}` : ""}`], ["guardados", `Guardados${nGuard ? ` · ${nGuard}` : ""}`]], subPublicar, setSubPublicar)}

      {/* Identificar · Viral */}
      <div style={{ display: top === "identificar" && subIdent === "viral" ? "block" : "none" }}>
        <ViralView data={data} commit={commit} flash={flash} irAEstudio={irAEstudio} />
      </div>

      {/* ContenidoView (única instancia): YouTube dentro de Identificar + todo Publicar */}
      <div style={{ display: contenidoVisible ? "block" : "none" }}>
        <ContenidoView data={data} commit={commit} flash={flash} pubDraft={pubDraft} clearPubDraft={() => setPubDraft(null)} irAEstudio={irAEstudio} subtab={contenidoSubtab} setSubtab={setSubPublicar} ocultarBarra embedded />
      </div>

      {/* Crear contenido · Imagen/Video/Diseño */}
      <div style={{ display: top === "crear" && subCrear === "estudio" ? "block" : "none" }}>
        <EstudioContenidoView data={data} commit={commit} flash={flash} onPublicar={irAPublicar} estudioDraft={estudioDraft} clearEstudioDraft={() => setEstudioDraft(null)} irAEditor={irAEditor} embedded />
      </div>
      {/* Crear contenido · Editor de video */}
      <div style={{ display: top === "crear" && subCrear === "editor" ? "block" : "none" }}>
        <VideoEditor data={data} commit={commit} flash={flash} editorSrc={editorSrc} onPublicar={irAPublicar} irAPublicar={irAPublicar} activo={top === "crear" && subCrear === "editor"} />
      </div>
    </div>
  );
}
