import React, { useMemo } from "react";

// Campo con opciones predefinidas + escritura libre (datalist nativo).
// Las opciones nuevas se guardan en data.<workspace-activo>.opciones[clave].
const wsDe = (data) => (data?.workspace === "cicloderiqueza" ? "cicloderiqueza" : "atlantis");

export default function Combo({ value, onChange, opciones = [], listaId, placeholder, style, className, disabled }) {
  const ops = useMemo(() => Array.from(new Set(opciones.filter(Boolean))), [opciones]);
  return (
    <>
      <input
        list={listaId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={style}
        className={className}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
      />
      <datalist id={listaId}>
        {ops.map((o) => <option key={o} value={o} />)}
      </datalist>
    </>
  );
}

export function opcionesDe(data, clave, presets = []) {
  const ws = wsDe(data);
  const propias = ((data?.[ws]?.opciones || {})[clave]) || [];
  return [...presets, ...propias.filter((x) => !presets.includes(x))];
}

export function opcionesConNueva(data, clave, valor, presets = []) {
  const ws = wsDe(data);
  const opciones = data[ws].opciones || {};
  const v = (valor || "").trim();
  if (!v) return opciones;
  const propias = opciones[clave] || [];
  if (presets.includes(v) || propias.includes(v)) return opciones;
  return { ...opciones, [clave]: [...propias, v].slice(-30) };
}

export function conNueva(opciones, clave, valor, presets = []) {
  const v = (valor || "").trim();
  if (!v) return opciones || {};
  const propias = (opciones || {})[clave] || [];
  if (presets.includes(v) || propias.includes(v)) return opciones || {};
  return { ...(opciones || {}), [clave]: [...propias, v].slice(-30) };
}

export function guardarOpcion(data, commit, clave, valor, presets = []) {
  const ws = wsDe(data);
  const nuevas = opcionesConNueva(data, clave, valor, presets);
  if (nuevas !== (data[ws].opciones || {})) commit({ ...data, [ws]: { ...data[ws], opciones: nuevas } });
}
