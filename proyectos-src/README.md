# Proyectos inmobiliarios · pipeline presentación → CRM → landing

Circuito completo para publicar un proyecto a partir de la presentación del
constructor, con su ficha en el Centro de Mando y su landing bilingüe.

## Cómo se monta un proyecto nuevo (flujo operativo)

1. **Tú**: sube a Drive una carpeta `proyectos/<nombre-del-proyecto>/` con la
   presentación del constructor (PDF o PPT) y los renders, y avísale al agente.
2. **El agente (IA)**: lee la presentación desde Drive, extrae todos los datos
   disponibles (ubicación, constructora, entrega, precios, tipologías,
   amenidades, plan de pagos) y arma `proyectos-src/<slug>/proyecto.json` +
   descarga los renders a `imagenes/`. **Regla dura: solo datos que estén en la
   presentación; lo que falte queda vacío, nunca se inventa.**
3. **Generar y registrar** (en el VPS o lo hace el agente):
   ```bash
   python3 centro-de-mando/scripts/generar-landing-proyecto.py   # landing + indice
   bash centro-de-mando/scripts/registrar-proyectos-crm.sh       # ficha en el CRM
   ```
4. **Aprobación**: el agente te muestra la landing en captura; ajustas lo que
   quieras. Mientras `"publicar": false`, nada sube al sitio.
5. **Publicar**: cambia `"publicar": true` en el JSON y corre
   `bash centro-de-mando/scripts/publicar-web-atlantis.sh` → la landing queda en
   `/proyectos/<slug>/` y entra al índice `/proyectos/`.

En el CRM, cada lead del formulario "Recibe el dossier" llega con
`type: proyecto-<slug>` — atribución por proyecto — y la ficha del proyecto
queda consultable en `GET /proyectos` (estado borrador/publicado).

## Voz y encuadre (innegociable)

La comunicación de cada landing orbita el modelo del método **sin nombrarlo**:
entrada en preventa por etapa, cuotas sin intereses con la constructora,
valorización durante la obra, salida diseñada antes de firmar (renta o cesión),
acompañamiento y verificación. Nada de lenguaje de gurú, cero promesas de
retorno: los precios, fechas y rendimientos proyectados son del constructor y
así se dice. La consulta siempre es un diagnóstico.

## Estructura de una carpeta de proyecto

```
proyectos-src/<slug>/
  proyecto.json      # ver _ejemplo (slug con "_" = borrador, nunca publica)
  imagenes/          # hero + galería (renders del constructor)
```
