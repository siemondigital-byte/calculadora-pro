import React, { useMemo } from "react";

// Campo con opciones predefinidas + escritura libre (datalist nativo).
// Las opciones nuevas que uses se guardan en data.siemon.opciones[clave] (ver guardarOpcion).
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

// Mezcla presets + las opciones personalizadas guardadas para esa clave.
export function opcionesDe(data, clave, presets = []) {
  const propias = ((data?.siemon?.opciones || {})[clave]) || [];
  return [...presets, ...propias.filter((x) => !presets.includes(x))];
}

// Devuelve el dict `opciones` con el valor nuevo incluido (para meterlo en el MISMO commit
// que el resto de cambios y no pisar datos). Si ya existe, devuelve el actual.
export function opcionesConNueva(data, clave, valor, presets = []) {
  const opciones = data.siemon.opciones || {};
  const v = (valor || "").trim();
  if (!v) return opciones;
  const propias = opciones[clave] || [];
  if (presets.includes(v) || propias.includes(v)) return opciones;
  return { ...opciones, [clave]: [...propias, v].slice(-30) };
}

// Versión encadenable: recibe y devuelve el dict opciones directamente.
export function conNueva(opciones, clave, valor, presets = []) {
  const v = (valor || "").trim();
  if (!v) return opciones || {};
  const propias = (opciones || {})[clave] || [];
  if (presets.includes(v) || propias.includes(v)) return opciones || {};
  return { ...(opciones || {}), [clave]: [...propias, v].slice(-30) };
}

// Para flujos SIN otro commit simultáneo (ej. tras generar contenido).
export function guardarOpcion(data, commit, clave, valor, presets = []) {
  const nuevas = opcionesConNueva(data, clave, valor, presets);
  if (nuevas !== (data.siemon.opciones || {})) commit({ ...data, siemon: { ...data.siemon, opciones: nuevas } });
}
