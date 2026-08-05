# Configuración por negocio — cómo adaptar el Centro de Mando a CUALQUIER empresa

El Centro de Mando NO es un producto enlatado. Es una estructura viva que se replica, ajusta y adapta a cada negocio. Este archivo describe el paso de configuración que debes hacer ANTES de tocar código, y cómo cada módulo se parametriza a partir de esa config.

Filosofía (no negociable): **nada se hardcodea.** Meta de facturación, precios, cadencias, voz, nicho, canales, moneda: todo se lee de una config editable por la usuaria. Si encuentras un valor fijo en el flujo (ver autocorrección #10), cámbialo por la config real.

---

## 1. El brief de configuración (llénalo con el dueño del negocio)

Antes de montar nada, recoge y guarda estos parámetros. En el CRM viven en `data.<workspace>.config` (o `perfilNegocio`) y en los `config.json` de las skills satélite.

### Identidad y posicionamiento
- **Nombre y dominio** de la marca.
- **A quién sirve (ICP):** defínelo por el **PROBLEMA / cuello de botella**, no por tamaño ni rubro. (En Siemon: "donde haya un cuello de botella que frena el crecimiento"; prohibido encasillar.)
- **Qué ofrece:** los frentes reales de la oferta. NO reducir a un solo producto (Siemon: automatización de procesos, IA a la medida, software propio, gestión documental — no "solo chatbots").
- **Diferencial humano:** qué acompañamiento/transformación vende, más allá de la herramienta.
- **Oferta gratuita / lead magnet:** la guía, diagnóstico, auditoría gratis, etc. (Siemon: guía IA + llamada de diagnóstico gratuita.) Define el `type`/`source` fijo del formulario (ej. `guia-ia`).
- **CTA principal:** a dónde llevas el lead (ej. `/book-call/`).

### Voz de marca (crítico — impregna TODO el contenido)
- La **historia real** del fundador y su porqué.
- **Tono** (Siemon: cercano, humano, real; autoridad serena sin imponer; desde la oportunidad).
- **Reglas duras de estilo.** En Siemon: SIEMPRE afirmativo, CERO comparaciones (no definir por lo que NO es, no contrastar con competidores); cero em dashes (`—`) en todo el texto que sale.
- **Léxico propio** y cosmovisión.
- Esta voz se inyecta como system prompt/contexto en TODOS los generadores: prospección, correo frío, nurturing, blog, viral, ads, chatbot, propuestas, home.

### Negocio y metas
- **Moneda** y formato.
- **Meta de facturación** mensual — ADAPTABLE, la pone la usuaria mes a mes (`data.<ws>.metas[YYYY-MM]`), nunca fija.
- **Numeración de facturas** (prefijo, ej. `SD-año-NNN`), IVA/retención por defecto.
- **Precios / rúbrica:** cómo se calculan (tamaño + complejidad + horas + alcance + urgencia). El agente calcula, el formulario solo recoge materia prima.

### Canales e integraciones
- **Canales de prospección** activos (directorios/OSM, YouTube, Instagram, LinkedIn, manual…).
- **Buzones** de correo (SMTP/IMAP del proveedor; Siemon usa Hostinger).
- **Remitente de nurturing** (ej. `hello@<dominio>`).
- **Redes** conectadas (Postiz: qué integraciones).
- **Analítica** (Umami website id).
- **Ads** (pixel, CAPI token).
- Ver `integraciones.md` para el detalle de claves y setup 1-vez.

### Región e idioma
- **País/ciudad** para prospección (OSM/Nominatim: "Ciudad, País") y keywords.
- **Idiomas** del contenido y la web (Siemon: ES + EN, nombres nativos por idioma).

---

## 2. Cómo se parametriza cada módulo

| Módulo | Qué lee de la config | Qué NO debe estar hardcodeado |
|---|---|---|
| **Panel** | meta del mes (`metas[YYYY-MM]`), moneda, KPIs objetivo | la meta (la pone la usuaria, no $10k fijo) |
| **Prospección** | ICP (problema), país/ciudad, canales activos, scoring por servicio | el nicho, la rúbrica de score |
| **Correo en frío** | buzones, voz de marca, `campana` (oferta parametrizable), cadencia de seguimiento | días de follow-up (leer de config, no constante) |
| **Nurturing** | persona + oferta, remitente, nº de correos y cadencia (días), tope diario, autoInscribir | la secuencia (la genera IA desde la config; no plantilla fija) |
| **Leads / Pipeline** | etapas (STAGES), fuentes (LEAD_SOURCES), canales, probabilidad por etapa | las etapas si el negocio usa otras |
| **Seguimiento** | cadencia de toques, tipos de acción (llamada/agenda/WhatsApp/referido) | el nº de días entre toques |
| **Facturación** | prefijo, moneda, IVA/ret, logo, presets de gastos | numeración, impuestos |
| **Ofertas / Propuesta** | frentes de servicio, rúbrica de precios, deck personalizable (placeholders `[ ]`), WhatsApp del responsable | precios, entregables (los calcula/genera el agente) |
| **Fuentes / Canales** | UTM por superficie e idioma, mapeo `fuente`=utm_source | — |
| **Estudio de mercado / SEO** | dominio propio, competidores, país para keywords | competidores, keywords objetivo |
| **Contenido / Viral** | pilares de tendencia, voz, nicho, contexto de mercado | los ejemplos (variar, no reducir a un molde) |
| **Blog y SEO** | keywords curadas (★objetivo), GSC del sitio, cabecera del blog | keywords, frase de cabecera |
| **Maquetador** | copia canónica de la web, checklist de fixes del estudio | rutas de archivos publicables |
| **Analítica** | Umami website id | — |
| **Ads / CAPI** | plan por presupuesto, pixel, CAPI token | presupuestos, creativos (los genera IA) |
| **Chatbot / Asistente** | voz, reglas de seguridad (no precios, no datos internos), oferta | el guion (consultivo, parametrizado por config) |

---

## 3. Los dos workspaces (multi-negocio en una instancia)

El shell soporta varios **workspaces** (en Siemon: `siemon` = agencia, `academia` = infoproductos), con nav propio y datos separados dentro del mismo `crm.json` (`{siemon, workspace, academia}`). Para un negocio nuevo:
- Un solo workspace basta al inicio. Añade otro solo si el negocio tiene una segunda línea con módulos distintos (ej. cursos/comunidad).
- Cada workspace tiene su `config`, su nav, y su slice de datos. El switch (`WorkspaceSwitch`) resetea la vista al panel.

---

## 4. "Sistema vivo" — cómo se auto-ajusta

El sistema no es estático: se mueve solo y se corrige con el uso. Estos son los mecanismos vivos que debes preservar al replicarlo:

- **Crons que trabajan de fondo (n8n):** leer bandeja cada 15 min (clasifica respuestas con IA, actualiza estados), nurturing diario (9am, inscribe leads elegibles y envía lo que toca), monitoreo de competencia semanal (re-audita SEO propio + competidores), recordatorios push diarios, respaldo externo cifrado semanal.
- **Nurturing que se auto-regula:** saca a la gente de la serie automáticamente al **responder o agendar** (hook en `/crm/lead` + escaneo IMAP de respuestas), al darse de baja, o al volverse Cliente. Tope diario configurable + espaciado entre envíos para deliverability.
- **Seguimientos parametrizables:** al mover una etapa en Pipeline, se fija `followUpDate` según la cadencia de la config (no una constante). Seguimiento agrupa Vencidas/Hoy/Semana/Después.
- **Atribución que se cierra sola:** publicaciones generan enlace UTM (`utm_campaign=pub_<id>`); el lead entrante deriva `fuente` del `utm_source`; Umami mide visitas por enlace.
- **Estudio de mercado que retroalimenta:** los insights del mercado (dolor, ángulos, objeciones, huecos) se pasan como contexto a los generadores de viral, blog y ads — el contenido se ancla en datos reales, no en supuestos.
- **Keywords que alimentan todo:** el SEO automático (Search Console + ATP + DataForSEO + lista curada ★objetivo) es el motor del que salen ideas de blog, de viral y de correos.
- **Auto-checklist del maquetador:** los fixes y quick-wins del estudio SEO se vuelven un checklist persistente con barra de progreso; los auto-aplicables (⚡) se pueden ejecutar con empalmes quirúrgicos.
- **Respaldos automáticos:** diario a `/data/backups` (últimos 10) + externo cifrado por FTP semanal.
- **Asistente que EJECUTA:** el asistente flotante no solo responde; crea leads, mueve pipeline, publica, prospecta (pasa por el mismo merge seguro).

Al montar un negocio nuevo, activa estos crons con los parámetros de SU config, no con los de Siemon.
