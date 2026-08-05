# Prompts listos · Automatizacion de Correos (para Claude Code)

De menos a mas. La marca/voz ya viene en `config.json`. Ejecuta con el agente del negocio (ej. Atlantis).

---

## 1. Montar el sistema completo (una sola vez)

Implementa el sistema de automatizacion de correos siguiendo `.claude/skills/automatizacion-correos/SKILL.md`. Léela antes de empezar.
1. Copia `config.example.json` a `config.json` (trae el preset de mi negocio). Ajusta remitente, dominio y secuencias.
2. Entregabilidad PRIMERO: guiame para poner SPF, DKIM y DMARC en el DNS del subdominio de envio, con warm-up. No sigas hasta que mail-tester de buen puntaje.
3. Motor: modelo de campanas + endpoints (generar, procesar, px, r, baja, sincronizar, enviar, leer). Secretos SMTP/IMAP/DKIM en el vault, nunca en el codigo.
4. n8n: cron horario que llama /nurturing/procesar y /nurturing/sincronizar con CRON_KEY.
5. UI en el CRM: Nurturing (campanas, cadencia editable, metricas, inscritos, bajas), Correo en frio, y Enviados/Bandeja.
Trabaja por partes y muestrame cada una antes de seguir. Guardarrailes: baja con un clic siempre, solo permiso, topes/espaciado, voz de marca, sin urgencia agresiva.

---

## 2. Redactar una secuencia de nurturing (en la voz de la marca)

Redacta la secuencia de la campana [[id de la campana, ej. comprador]] en la voz de mi marca (config.marca.voz), respetando su premisa. Para cada paso dame: asunto (corto, sin clickbait), cuerpo (breve, humano, un solo objetivo por correo, una llamada a la accion suave), y donde va el lead magnet. Incluye pixel de apertura, links con redireccion/UTM y enlace de baja. NO inventes datos ni rentabilidades. Dejalo listo para que yo apruebe/edite antes de activar.

---

## 3. Definir la cadencia (tiempos)

Propon la cadencia en HORAS por paso para la campana [[id]], pensada para acompanar sin agobiar (ej. paso 1 inmediato, paso 2 a las 48h, etc.). Dejala editable en el CRM. Ten en cuenta el tope diario y el espaciado de config.entregabilidad.

---

## 4. Secuencia de prospeccion en frio (3 toques)

Escribe una secuencia EN FRIO de 3 toques para [[a quien: ej. propietarios de una zona]]. Cada toque: nombra la oportunidad/problema concreto, aporta valor real y baja la friccion; el 3ro es un cierre suave. Con contexto legitimo (por que le escribo). Para/reduce si abre o responde. Cero spam, cero promesas.

---

## 5. Revisar entregabilidad / por que caigo en spam

Diagnostica mi entregabilidad: revisa SPF, DKIM y DMARC del dominio de envio, el contenido (ratio texto/imagen, links, palabras riesgosas), el warm-up y los volumenes. Dame los arreglos concretos, en orden de impacto, y como verificar con mail-tester.
