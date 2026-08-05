// Iconos de contacto clicables (web, email, teléfono, ubicación/Maps, redes).
// Compartido por la vista Prospección (tarjetas) y la ficha del lead (LeadDrawer),
// para que un prospecto se vea igual de completo en todo el CRM.
import React from "react";
import { Globe, Mail, Phone, MapPin, Instagram, Facebook, Linkedin, Youtube, Music2 } from "lucide-react";

const C = {
  aether2: "#CBC0EC", mist: "#C9CAD2", ash: "#8B8D98", line: "rgba(255,255,255,0.08)",
};

// Link a Google Maps: usa maps_url si viene, si no arma uno con coords o dirección.
export function mapsLink(p) {
  if (!p) return "";
  if (p.maps_url) return p.maps_url;
  if (p.lat && p.lng) return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
  const q = [p.direccion, p.ciudad].filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : "";
}

// Redes con su URL, para pintar iconos que abren el perfil.
export function redesDe(p) {
  const r = (p && p.redes) || {};
  const items = [];
  if (r.instagram) items.push({ tipo: "instagram", url: r.instagram, txt: r.instagram_handle || "Instagram" });
  if (r.tiktok) items.push({ tipo: "tiktok", url: r.tiktok, txt: r.tiktok_handle || "TikTok" });
  if (r.facebook) items.push({ tipo: "facebook", url: r.facebook, txt: "Facebook" });
  if (r.linkedin) items.push({ tipo: "linkedin", url: r.linkedin, txt: "LinkedIn" });
  if (r.youtube) items.push({ tipo: "youtube", url: r.youtube, txt: "YouTube" });
  return items;
}

export function IconoRed({ tipo, size = 13 }) {
  if (tipo === "instagram") return <Instagram size={size} />;
  if (tipo === "facebook") return <Facebook size={size} />;
  if (tipo === "linkedin") return <Linkedin size={size} />;
  if (tipo === "youtube") return <Youtube size={size} />;
  if (tipo === "tiktok") return <Music2 size={size} />;
  return <Globe size={size} />;
}

export function tieneContacto(p) {
  if (!p) return false;
  return !!(p.web || p.email || p.telefono || mapsLink(p) || redesDe(p).length || (p.enlaces && p.enlaces.length));
}

// Fila de iconos clicables con toda la info de contacto del prospecto.
export default function ContactoIconos({ p }) {
  if (!p) return null;
  const redes = redesDe(p);
  const maps = mapsLink(p);
  const chip = "inline-flex items-center gap-1 fs-11";
  return (
    <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap">
      {p.web && <a href={p.web} target="_blank" rel="noreferrer" style={{ color: C.aether2 }} className={chip}><Globe size={12} />{p.web.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 34)}</a>}
      {p.email && <a href={"mailto:" + p.email} style={{ color: C.mist }} className={chip}><Mail size={12} />{p.email}</a>}
      {p.telefono && <a href={"tel:" + p.telefono} style={{ color: C.mist }} className={chip}><Phone size={12} />{p.telefono}</a>}
      {(p.direccion || maps) && <a href={maps || undefined} target="_blank" rel="noreferrer" style={{ color: maps ? C.aether2 : C.ash }} className={chip}><MapPin size={12} />{[p.direccion, p.ciudad].filter(Boolean).join(", ").slice(0, 40) || "Ver en Maps"}</a>}
      {redes.map((rr, j) => (
        <a key={j} href={rr.url} target="_blank" rel="noreferrer" style={{ color: C.aether2 }} className={chip} title={rr.txt}><IconoRed tipo={rr.tipo} />{rr.txt}</a>
      ))}
      {(p.enlaces || []).slice(0, 4).map((u, k) => (
        <a key={"e" + k} href={u} target="_blank" rel="noreferrer" style={{ color: C.aether2 }} className={chip} title={u}><Globe size={12} />{u.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 24)}</a>
      ))}
    </div>
  );
}
