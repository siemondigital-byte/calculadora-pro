# Pendientes · Calculadora de Viabilidad Inmobiliaria Pro

Estado al cierre de esta ronda. **Hecho:** el núcleo del modelo de negocio del libro
(Tandas 2–6 + refinamiento portafolio). La app cubre: proyectos multi‑país, entrada
(Lista Cero/En Marcha), apalancamiento, **TIR real** (timing+costos+margen) y **TIR
en USD** por devaluación, salida (cesión/flip/renta), hipoteca al entregar, **5 P**,
escenarios + Regla de Oro, NSE, poder de inversión, **patrimonio multi‑ciclo**,
renta + vender/conservar, **vehículos fiscales por país**, cash‑out refi,
diversificación (40‑50% moneda dura) y alerta de Holding.

Prioridad: 🔴 alta · 🟡 media · 🟢 baja / cosmético.

---

## 1 · Calculadora — método del libro que aún falta

- ✅ **LTV por país** (residente/no residente): la hipoteca al entregar se topa al LTV máximo del mercado (preset por vehículo: CO 60%, MX 50%, Dubái 70%, RD/CR/Panamá 70%, US 75%); si el saldo adeudado supera el LTV, se muestra el **aporte extra al entregar**. Editable con slider. *(Cap. 28/30/53)*
- ✅ **Penalidad de prepago por país**: se descuenta de la utilidad de salida en la estrategia **flip** (preset por vehículo: US 4%, RD 2%, Dubái/Panamá/CR 1%, CO/MX 0%). *(Cap. 30/50)*
- 🟡 **Gasto de Libertad por categorías** *(pendiente el desglose por categorías)* — ✅ **inflación editable por el usuario** (slider 2‑10%, alimenta el NSE) + ✅ **umbrales de libertad** (Parcial 70% / Total 125% del gasto) ya mostrados en la tarjeta NSE. *(Cap. 7)*
- ✅ **Depreciación deducible** (2,22%/año sobre el 80% del valor) como **escudo fiscal** en la tarjeta de Renta. *(Cap. 3/39)*
- 🟡 **Triángulo de Inversiones Inteligentes**: gate de 3 checks (TIR>20% ✓ ya · <2 h/mes de gestión · fiduciaria+constructora verificada). *(Cap. 2)*
- 🟡 **Salud del desarrollador / señales de alerta**: scorecard de due diligence (5+ proyectos entregados, >60% preventa, penalidad >3%, presión 24‑48h, fiduciaria propia). *(Cap. 50/52)*
- 🟢 **Nº de propiedades por ciclo** (1‑2 → 2‑3 → 4‑5) según poder de inversión. *(Cap. 18)*
- 🟢 **Retención transfronteriza / tratados** (>5% participación → 0%; sin CDI hasta 25‑30%). *(Cap. 38)*
- 🟢 **Cálculo fiscal del Holding** (DSCR ≥1,25, reinvertir 100% sin distribuir): hoy solo hay la *alerta* de salto a Holding. *(Cap. 31/34)*
- 🟢 **6 tipos de apalancamiento** (checklist de preparación). *(Cap. 14)*
- 🟢 **Reserva de liquidez** (3 meses de cuotas / fondo emergencia 6 meses) y **capital mínimo** ($20‑50k) como validaciones. *(Cap. 18/19/50)*
- 🟢 **Método 50/30/20** (slider de gasto discrecional que ajusta el flujo invertible). *(Cap. 19)*
- 🟢 **Portafolio 70/30** (valorización/renta) + **3 fases** (Escalamiento/Recapitalización/Consolidación) + **asignación 50/30/20** objetivo. *(Cap. 18/47)*
- 🟢 **Tabla maestra de mercados** que precargue un proyecto al elegir país (valorización, renta, vehículo fiscal, LTV, costos). *(Cap. 41‑47)*
- 🟢 **Ahorro fiscal inmediato 15‑40%** (simulador AFC por salario). *(Cap. 25/32)*

## 2 · Producto / producción (para desplegar de verdad)

- 🔴 **Login real (autenticación)**: hoy cualquier dato entra (demo). Conectar a backend real. → **Supabase Auth** (recomendado cuando montemos backend).
- 🔴 **Guardar proyectos/escenarios en la nube**: hoy persisten en `localStorage` (por navegador, no sincroniza). → tabla `proyectos` por usuario en Supabase.
- 🔴 **Gating de acceso**: "gratis de por vida para los primeros N" + **revocar acceso si hay reembolso** (atado a la compra activa). Lógica de negocio del producto.
- 🟡 **Despliegue**: hoy en GitHub Pages (`siemondigital-byte.github.io/calculadora-pro`). Evaluar **Vercel + dominio propio** (`app.cicloderiqueza…`) con auto‑deploy por push.
- 🟡 **Flujo de push**: abrir sesión de Claude Code sobre el repo para trabajar con *muestro local → confirmas → pusheo* (pendiente que montemos, como quedamos).
- 🟢 **Accesibilidad**: ya hay foco dorado y labels; falta pasada AA completa y prueba con lector de pantalla.
- 🟢 **Analítica / tracking** de uso de la calculadora (para el CRM).

## 3 · Integración con el ecosistema

- 🟡 **Conectar la app al CRM (Centro de Mando)**: usuarios de la calculadora ↔ compradores/leads. Ver el `CLAUDE.md` del CRM.
- 🟡 **Checkout**: enlazar la app/producto con ThriveCart / Hotmart / ClickBank.
- 🟢 **Correos n8n** (ya existen los templates comprador/embajador ES/EN) que entregan las credenciales de la app.

## 4 · QA / verificación

- 🟡 **Prueba en móvil real** (iOS/Android): el layout responsive ya funciona en desktop y <900px, pero conviene validar en dispositivo.
- 🟢 **Revisar magnitudes de TIR** con inputs conservadores: con salida corta (cesión/flip) + valorización anual agresiva, la TIR anualizada se dispara (matemáticamente correcto, pero conviene una nota o un tope visual).
- 🟢 **Textos largos EN**: la traducción está completa; revisar que nada se desborde en pantallas estrechas.

---

## Bonos (aparte de la calculadora)

- ✅ **Bono 02 · Patrimonio sin Fronteras → "Borderless Wealth" (EN)**: guía completa en inglés, redactada desde el método del libro (Cap. 10 · Riesgo Cambiario + diferimiento transfronterizo / hub dolarizado), en la identidad de marca. Archivo: `project/bonos/Borderless-Wealth-EN.html`. *(Bono 01 · Sin Hipoteca a 30 años ya tenía versión clara.)*
  - *Nota:* no existía un archivo fuente en español del Bono 02 en el repo (solo la portada PNG y la ficha en la landing), por eso la guía EN se autoría desde el libro. Si aparece el documento ES original, conviene alinear ambos.

---

*Nota: los ítems 🔴 de la sección 2 requieren backend (Supabase) y son el puente de
"prototipo" a "producto". El resto de la sección 1 son refinamientos del método que
suman fidelidad pero no bloquean el uso.*
