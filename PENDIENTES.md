# Pendientes · Calculadora de Viabilidad Inmobiliaria Pro

Estado real al cierre de la ronda de **producto en la nube + informes + modularización**.

**Núcleo del método (libro):** proyectos multi‑país, entrada (Lista Cero/En Marcha),
apalancamiento, **TIR real** (timing+costos+margen) y **TIR en USD** por devaluación,
salida (cesión/flip/renta), hipoteca al entregar + **LTV por país** + **penalidad de
prepago**, **5 P**, escenarios + Regla de Oro, NSE con inflación editable, poder de
inversión, **patrimonio multi‑ciclo**, renta + vender/conservar con **escudo por
depreciación**, **vehículos fiscales por país**, cash‑out refi, diversificación
(40‑50% moneda dura) y alerta de Holding.

**Producto:** login real (Supabase Auth), guardado en la nube por usuario, **sync
total** (supuestos/shopping/portafolio/checklist/pestañas), gating por reembolso,
informes **CSV + PDF**, PWA desplegada en Vercel (dominio propio) + GitHub Pages.

Prioridad: 🔴 alta · 🟡 media · 🟢 baja / cosmético.

---

## 1 · Calculadora — método del libro que aún falta

- ✅ **LTV por país** (residente/no residente), tope de hipoteca al entregar + aporte extra. *(Cap. 28/30/53)*
- ✅ **Penalidad de prepago por país** descontada en la estrategia flip. *(Cap. 30/50)*
- ✅ **Inflación editable** (slider 2‑10%, alimenta el NSE) + **umbrales de libertad** (Parcial 70% / Total 125%). *(Cap. 7)*
- ✅ **Depreciación deducible** (2,22%/año s/ 80% del valor) como escudo fiscal. *(Cap. 3/39)*
- ✅ **Renta como input** (rendimiento neto parametrizable por proyecto/mercado, no fijo). *(refinamiento honesto)*
- ✅ **Valorización explosiva parametrizable** (valorización mensual editable por proyecto). *(refinamiento)*
- ✅ **Tracking real vs. plan** en el portafolio en marcha (avalúo/pagado reales, desviación). *(Cap. 18/47)*
- ✅ **Gasto de Libertad por categorías**: desglose editable (vivienda, alimentación, salud, transporte, ocio, otros) cuya suma alimenta el gasto total; el total reescala las categorías. *(Cap. 7)*
- ✅ **Triángulo de Inversiones Inteligentes**: gate de 3 vértices (TIR>20% automático · gestión <2 h/mes · fiducia+constructora verificada) con veredicto en el analizador. *(Cap. 2)*
- ✅ **Salud del desarrollador / señales de alerta**: scorecard de due diligence (5+ entregas, >60% preventa, respaldo fiduciario, penalidad >3% auto, presión 24‑48h) con veredicto en el analizador. *(Cap. 50/52)*
- ✅ **Nº de propiedades por ciclo** (1‑2 → 2‑3 → 4‑5) según poder de inversión: indicador de fase (Escalamiento/Recapitalización/Consolidación) en la pestaña Inversión. *(Cap. 18)*
- 🟢 **Retención transfronteriza / tratados** (>5% participación → 0%; sin CDI hasta 25‑30%). *(Cap. 38)*
- ✅ **Cálculo fiscal del Holding** (DSCR ≥1,25, reinvertir 100%): tarjeta en Conclusiones con ganancia proyectada de la cartera e impuesto diferido reinvirtiendo el 100%. *(Cap. 31/34)*
- ✅ **Reserva de liquidez** (fondo de emergencia 6 meses + reserva de cuotas 3× pico) y **capital mínimo** ($20k) como validaciones en la pestaña Liquidez. *(Cap. 18/19/50)*
- ✅ **Tabla maestra de mercados**: al elegir país/vehículo precarga valorización, renta, LTV, tasa fiscal, diferimiento y penalidad de prepago. *(Cap. 41‑47)*
- ✅ **Ahorro fiscal inmediato 15‑40%** (simulador tipo AFC por ingreso) en la pestaña Fiscal: aporte deducible (30% del ingreso) y ahorro anual según tasa marginal. *(Cap. 25/32)*

## 2 · Producto / producción

- ✅ **Login real (Supabase Auth)** — el modo demo sigue disponible si no hay `config.js`.
- ✅ **Guardar proyectos/escenarios en la nube** (tablas `usuarios` + `proyectos`, RLS por usuario).
- ✅ **Sync total** del estado extra vía columna `snapshot jsonb` en `usuarios`.
- ✅ **Gating de acceso**: revoca la app si `acceso_activo = false` (reembolso).
- ✅ **Informes** CSV (portafolio + shopping) y PDF (impresión del Resumen).
- ✅ **Despliegue**: Vercel + dominio propio (`wealthcycle-app.atlantisglobalrealty.com`) con auto‑deploy por push, y GitHub Pages como espejo.
- ✅ **Flujo de push**: sesión de Claude Code sobre el repo (muestro local → confirmas → pusheo).
- 🟢 **Accesibilidad**: hay foco dorado + labels; falta pasada AA completa + prueba con lector de pantalla.
- 🟢 **Analítica / tracking** de uso (Vercel Analytics o para el CRM) — hoy desactivado.

## 3 · Integración con el ecosistema

- 🟡 **Conectar la app al CRM (Centro de Mando)**: usuarios de la calculadora ↔ compradores/leads.
- 🟡 **Checkout**: enlazar con ThriveCart / Hotmart / ClickBank (altas vía n8n ya cableadas).
- 🟢 **Correos n8n** (templates comprador/embajador ES/EN) que entregan las credenciales.

## 4 · Calidad de código

- ✅ **Modularización de `app.js`**: partido en módulos ES (`util`, `i18n`, `state`, `compute`, `render`, `main`) cargados con `type="module"`.
- 🟡 **Prueba en móvil real** (iOS/Android): el responsive funciona en desktop y <900px (probado en Chromium); conviene validar en dispositivo físico.
- 🟢 **Revisar magnitudes de TIR** con salida corta + valorización agresiva (correcto matemáticamente; conviene nota o tope visual).
- 🟢 **Textos largos EN**: traducción completa; revisar desbordes en pantallas muy estrechas.

---

*Los 🔴 (puente prototipo → producto) están cerrados. Lo que queda son refinamientos
del método (🟡/🟢) e integraciones de ecosistema que suman fidelidad/alcance pero no
bloquean el uso ni el despliegue.*
