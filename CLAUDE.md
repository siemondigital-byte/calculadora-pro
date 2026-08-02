# CLAUDE.md — CRM / Centro de Mando · Ciclo de Riqueza Inmobiliaria

> **Para el agente que desarrolla y opera este CRM.** Antes de escribir cualquier
> línea de código, procesar un lead o generar contenido, lee este archivo completo.
> Define **qué es el producto**, **quién es Atlantis**, **el tono innegociable** y
> **cómo aplicar tus skills en función de este producto** (no en abstracto).
>
> Regla de oro: tú ya tienes las skills (`prospeccion`, `youtube-embajadores`,
> `youtube-studio`, `contenido-viral`, `ads`, etc.). Este documento **las
> parametriza** para el ecosistema Ciclo de Riqueza / WealthCycle. Cuando una skill
> pida "config del producto", la config es **este archivo**.

---

## 0 · Qué administra este CRM

El **Centro de Mando** es el CRM que administra todo el negocio del producto
**Ciclo de Riqueza Inmobiliaria** (ES) / **The Real Estate Wealth Cycle** (EN) y su
ecosistema comercial. Sus funciones:

1. **Leads y compradores** — captación, nurturing, compras (Hotmart/ClickBank/ThriveCart), acceso al área de miembros y a la app.
2. **Afiliados / embajadores** — reclutamiento (incl. YouTubers), tracking, comisiones, materiales.
3. **Prospección** — extracción y calificación de prospectos → `prospectos` → `leads`.
4. **Contenido** — motor de contenido (YouTube, Reels/TikTok/Shorts, LinkedIn) en la voz de marca.
5. **Pauta (ads)** — adquisición pagada (Meta Ads + lookalikes) y su embudo.
6. **Automatizaciones** — correos transaccionales y de nurturing (n8n / MailerLite).
7. **La app Calculadora Pro** — gestión de usuarios/acceso del aplicativo (bono del producto).
8. **Sitio de Atlantis** — **el CRM también mantiene y actualiza la web principal de Atlantis Global Realty** (ver §2 y §7). Trátalo como un canal más que este sistema alimenta.

---

## 1 · El producto: Ciclo de Riqueza Inmobiliaria

- **Qué es:** un **libro-método** (ebook premium en PDF) que enseña a construir
  patrimonio inmobiliario global con proyectos **sobre planos (preventa)**,
  **apalancamiento con la constructora**, **diferimiento fiscal** y **rotación por
  ciclos**. No es un curso por días; son 8 partes / 56 capítulos.
- **Incluye:**
  - El libro-método completo.
  - **La Calculadora de Viabilidad Inmobiliaria Pro** (el aplicativo — repo aparte,
    `calculadora-pro`): mide TIR real, capacidad de endeudamiento con hipoteca al
    entregar, escenarios, Número de Seguridad Económica, patrimonio multi-ciclo,
    las 5 P y comparativa de proyectos. Es el activo que **de-riesga la compra**.
  - **Dos bonos:** *Bono 01 · Sin Hipoteca a 30 años* (apalancamiento inteligente)
    y *Bono 02 · Patrimonio sin Fronteras* (diversificación geográfica).
  - **Consulta de diagnóstico gratuita** (~60 min) con el equipo de Atlantis.
- **Precio:** oferta de lanzamiento **44 USD** (precio regular **99 USD**). La
  Calculadora es **gratis de por vida para los primeros compradores** (después se
  vende aparte, ~89 USD/año). Garantía de **7 días** (pedir devolución revoca el
  acceso vitalicio a la app y los bonos).
- **Idiomas:** español neutro latinoamericano (base) e inglés.
- **Rutas de tráfico (el embudo funciona para las dos):**
  1. **Upsell post-compra** de otro producto del ecosistema (tráfico caliente).
  2. **Captación** por afiliados de YouTube (5 verticales: productividad/hábitos,
     mentalidad, finanzas e inversión, crecimiento personal, crecimiento
     profesional) + Meta Ads (públicos lookalike). Nivel de conciencia Schwartz
     **1–2**: hay que **despertar el problema**, no asumir que ya quiere invertir.

### El método, en breve (para que entiendas el dominio)
- **Sistema de los Cuatro Planos**: A ingresos activos · **B portafolio
  inmobiliario (lo que trabaja el producto)** · C ingresos por pasión · D fuentes
  estructuradas.
- **El Ciclo**: entrar en preventa → dejar valorizar pagando cuotas sin intereses →
  rotar (cesión de derechos / flip / estabilizar para renta) → **reinvertir el 100%
  difiriendo impuestos** → repetir. ~3x de capital por ciclo (24–36 meses).
- **Métricas reales del método**: **TIR sobre capital propio > 20% ("Atlantis
  Standard")**, capacidad de endeudamiento (35% del ingreso − deudas), **Número de
  Seguridad Económica**, vivir del flujo sin tocar el capital.
- **Mercados de referencia**: Colombia, México, Rep. Dominicana, Panamá, Dubái,
  Costa Rica (y otros). **No es un producto atado a una sola geografía.**

---

## 2 · Quién es Atlantis Global Realty (de los capítulos finales del libro)

Atlantis es el **aliado estratégico** que aporta la metodología y el acceso a
proyectos sobre planos de constructoras verificadas. Del libro (Cap. 55–56):

> *"No somos una agencia de real estate. Somos arquitectos de patrimonio."*
> *"Las agencias venden propiedades. Nosotros implementamos un sistema:
> diseñamos, estructuramos y acompañamos la construcción de riqueza inmobiliaria
> real."*
> *"No buscamos clientes. Buscamos personas comprometidas con la construcción de
> su propio legado. Ese es el único perfil con el que trabajamos."*

**Reglas duras sobre Atlantis (compliance):**
- Atlantis **opera por comisión** sobre venta y conexión; **NO capta dinero de
  inversionistas** ni es un vehículo de inversión. Nunca lo presentes como fondo.
- La consulta es un **diagnóstico, no una venta**.
- **Honestidad como principio**: el método tiene riesgos reales (cambiario, due
  diligence de constructora, restricciones legales) y el libro los nombra de
  frente. Nunca escondas los riesgos ni prometas retornos.

**Nota de arquitectura de marca (realidad de producción):** el producto se sirve
bajo dominios de Atlantis (§7). El CRM mantiene tanto las páginas del producto como
**la web corporativa de Atlantis** (atlantisglobalrealty.com). Cuando actualices el
sitio de Atlantis, respeta esta identidad: *arquitectos de patrimonio*, banca
privada sobria, cero lenguaje de gurú.

---

## 3 · Avatar / público objetivo

- Profesionales de **25 a 52 años** que ganan bien pero **no invierten** (sin ahorro
  ni plan patrimonial). Muchos **no son conscientes del problema**.
- Subsegmento clave: **mujer de 30 a 50, ambiciosa**, con ingresos y sin plan.
- Mercado: LATAM, España y población hispana en EE. UU. (EN para mercado anglo).
- Dolores (derivados del método, **sin cifras inventadas**): "todo depende de que yo
  siga produciendo"; "junto dinero sin saber qué hacer con él"; "creo que invertir
  en inmuebles es solo para quien ya tiene mucho capital".

---

## 4 · Voz de marca y NO-NEGOCIABLES

Aplica esto a **todo** lo que el CRM genere: correos, contenido, anuncios, copy de
web, mensajes a afiliados, respuestas a leads.

- **Tuteo neutro latinoamericano.** Nada de voseo ni españolismos. Frases cortas.
- **Anti-gurú y anti-decreto.** Empoderamiento por **estructura**, no por "manifiesta
  y llegará". Nada de "transforma tu vida", "premium", "get started".
- **Ningún nombre propio de persona.** Firma institucional. Sin fundadora, sin bio,
  sin foto de persona. La autoridad la sostienen el método y Atlantis.
- **Precio siempre "44 USD"** (cifra + USD a la derecha), nunca "$44" ni "44€".
- **Disclaimer educativo visible**: *"Contenido educativo. No es asesoría
  financiera, legal ni tributaria."* Nunca prometas retornos; los rendimientos
  proyectados son del constructor.
- **Cero estadísticas inventadas** (toda cifra de mercado con fuente/URL/año) y
  **cero testimonios ficticios** (solo casos reales, verificables, con
  consentimiento; si no hay, usa bloques de principio del método).
- **Sin escasez artificial** ni descuentos tachados falsos (99→44 sí es real).
- **Inglés solo para nombres propios de marca** en piezas en español.

### Estética (para web, assets y cualquier UI)

> **ALCANCE (Andrea, 2026-08-01): esta estética es la del INFOPRODUCTO (Ciclo de
> Riqueza / Wealth Cycle y su Calculadora Pro): dorado sobrio sobre navy y negro,
> líneas finas, iconos de línea, cero emojis en controles. La INMOBILIARIA
> (Atlantis Global Realty) tiene branding propio TODAVÍA NO registrado: prohibido
> asumir que es este; para cualquier pieza de la inmobiliaria, pregunta a Andrea
> su identidad antes de generar. Ver `alcance:infoproducto-vs-inmobiliaria` en el
> RAG del negocio.**

Lujo oscuro editorial (banca privada, no "curso edtech" ni "coach"):
- Paleta: negro `#0A0A0C` · navy `#0F1B2D` · oro champagne `#E6C788` · crema
  `#F4EFE6` · gris `#D7D7D9`. Sin neón, sin morado/rosa de coach.
- Tipografía: **Bodoni Moda** (display serif) + **Instrument Sans** (cuerpo).
- Los números mandan (44 USD, TIR, NSE como elementos dominantes). Motivo gráfico
  firma: una **línea de oro que orbita/se cierra sobre sí misma** (el ciclo).
- Accesibilidad AA, foco visible, alt text en assets.

---

## 5 · Cómo aplicar tus skills a ESTE producto

Tú ya tienes las skills. Este archivo es su **config**. Al invocarlas, opéralas así:

| Skill | Aplicación en función del producto |
|---|---|
| **`prospeccion`** | Extraer contactos públicos de negocios/perfiles que encajen con el avatar (§3); calificar por *fit* con el método; volcarlos a `prospectos` → promover a `leads` con `lead_source='Prospección'`. Respeta guardarraíles legales/éticos de scraping. |
| **`youtube-embajadores`** | Descubrir YouTubers de las 5 verticales (§1) como **embajadores/afiliados** del programa WealthCycle; puntuar "Ambassador Fit Score"; extraer contacto público; volcarlos como `lead_source='Prospección YouTube'`. Encaja con el **programa de afiliación** (§7). |
| **`youtube-studio`** | Operar el canal como "super canal": blueprint (Ikigai) con la **voz de marca §4**, ideas con detección de outliers **sobre los dolores del avatar**, guiones anti-gurú, calendario, repurpose multicanal. Producto: infoproducto (44 USD) + consulta Atlantis. |
| **`contenido-viral`** | Reels/TikTok/Shorts que **despiertan el problema** (Schwartz 1–2) y venden con CTA al DM/landing. Estructura viral-que-vende + niveles de conciencia. Sin promesas de ingresos. Producto-agnostic config = §1–§4. |
| **`ads`** | Pauta Meta + lookalikes sobre el contenido que funcione. Embudo atención → nutrición → venta. Precio 44 USD, garantía 7 días, disclaimer educativo. |

**Principio transversal:** cualquier skill que pida "config", "producto", "avatar",
"oferta" o "voz" toma los valores de §1–§4 de este archivo. Si una skill trae
defaults genéricos, **sobrescríbelos con estos**.

---

## 6 · Entidades del CRM (modelo sugerido)

Diseña el CRM alrededor de estas entidades (ajusta a tu stack — el usuario ya opera
con este patrón):

- **`leads`** — origen (upsell / YouTube / Meta / prospección), estado del embudo, idioma, conciencia.
- **`compradores`** — compra (plataforma: Hotmart/ClickBank/ThriveCart), acceso a área de miembros, acceso a la app, bonos, garantía/reembolso.
- **`afiliados` / `embajadores`** — perfil (canal YouTube, audiencia), estado, comisión (se define en la llamada de partners), materiales, tracking de referidos.
- **`prospectos`** — salida de `prospeccion`/`youtube-embajadores`, score, contacto, promoción a lead.
- **`consultas`** — agendamiento del diagnóstico con Atlantis (link/QR), estado.
- **`app_usuarios`** — usuarios de la Calculadora Pro (credenciales generadas por n8n; gating "gratis de por vida para los primeros N"; revocación si hay reembolso).
- **`contenido`** / **`campañas`** — piezas, canal, métricas, estado.

### Correos (n8n) ya definidos en el ecosistema
Variables usadas por los templates: `{{ $json.nombre }}`, `email`, `password`,
`membersUrl`, `appUrl`, `downloadsUrl`, `webUrl`. Dos flujos: **comprador** (área de
miembros vía Hotmart/ClickBank + acceso a la app) y **embajador** (acceso de
cortesía con login universal al área de miembros + acceso a la app).

---

## 7 · Ecosistema · URLs canónicas

Verifica siempre contra estas fuentes vivas (son la verdad de producción):

- **Empresa:** https://atlantisglobalrealty.com/  *(el CRM también actualiza este sitio)*
- **Producto ES:** https://cicloderiqueza.atlantisglobalrealty.com/
- **Producto EN:** https://wealthcycle.atlantisglobalrealty.com/
- **Afiliados ES:** https://cicloderiqueza.atlantisglobalrealty.com/afiliados
- **Afiliados EN:** https://wealthcycle.atlantisglobalrealty.com/affiliates/

Convención bilingüe: **`cicloderiqueza`** = español, **`wealthcycle`** = inglés,
ambos bajo `atlantisglobalrealty.com`.

### Remitentes de correo (convención)

- **Producto** (Ciclo de Riqueza / Calculadora Pro: credenciales, reset,
  bienvenida, nurturing del infoproducto): ES →
  `cicloderiqueza@atlantisglobalrealty.com` · EN →
  `wealthcycle@atlantisglobalrealty.com`.
- **Agencia Atlantis** (agendar llamada de diagnóstico, clientes interesados en
  invertir, asesoría): `contact@atlantisglobalrealty.com`.
- El único buzón real es `andrea@atlantisglobalrealty.com`; los demás son alias
  de Hostinger. El envío sale por Gmail (`atlantisglobalrealty@gmail.com`) con
  cada alias verificado como "Send mail as" (SMTP `smtp.hostinger.com:465` SSL,
  autenticando como `andrea@`). No uses `hola@` ni `hello@`: no existen.

---

## 8 · Guardarraíles (no los cruces nunca)

1. Sin nombres propios de persona en piezas públicas. Firma institucional.
2. Nunca prometas retornos ni presentes a Atlantis como vehículo de inversión / fondo.
3. Disclaimer educativo visible en toda pieza con cifras de método.
4. Cero datos, cifras de mercado o testimonios inventados; toda cifra citada con fuente.
5. Precio "44 USD"; sin escasez artificial.
6. Español neutro latinoamericano, tuteo, anti-gurú (§4).
7. Los riesgos del método (cambiario, due diligence, legal) se nombran, no se esconden.
8. Datos personales de leads/compradores: manéjalos con la política de privacidad
   del producto; consentimiento para cualquier caso/testimonio.

---

*Este archivo es la fuente de verdad del dominio para el CRM. Si algo aquí choca con
un default de una skill, este archivo gana. Ante duda sobre cifras o estado del
producto, verifica contra las URLs de §7 o pregunta al usuario — no inventes.*
