# Motor de prospeccion · Siemon

Encuentra negocios de un sector + ciudad, analiza su presencia digital, los puntua
segun tu ICP/servicio y devuelve los que encajan (con datos de contacto y, opcional,
un mensaje de outreach escrito por Claude). Es el motor detras del modulo de
Prospeccion del CRM; tambien se usa por CLI.

## Lo importante primero
- **El nucleo corre en tu Python 3.9 actual** (fuente OpenStreetMap, gratis y legitima).
  Ya puedes prospectar hoy, sin instalar nada mas que 3 librerias.
- **Google Maps** (fuente mas rica) necesita **Python 3.10+** y Scrapling. Es opcional
  y se activa cuando quieras; el resto funciona igual sin el.

## Instalar

### Rapido (nucleo, Python 3.9+)
```bash
cd crm-siemon/motor-prospeccion
pip3 install --user fastapi "uvicorn[standard]" requests beautifulsoup4
```
O con entorno aislado:
```bash
./setup.sh            # crea .venv e instala
source .venv/bin/activate
```

### Para Google Maps (opcional, Python 3.10+)
No tienes 3.10+ ni Homebrew. Instala Python 3.11 desde el instalador oficial:
https://www.python.org/downloads/macos/ (descarga el .pkg, doble clic). Luego:
```bash
PYTHON=python3.11 ./setup.sh     # instala tambien Scrapling + navegadores
```

## Usar

### CLI (terminal)
```bash
python3 cli.py --sector dentista --ciudad "Barcelona, España" --servicio automatizacion --n 20
python3 cli.py --sector gimnasio --ciudad "Madrid, España"    --servicio marketing --out leads.csv
python3 cli.py --sector abogado  --ciudad "Valencia, España"  --fuentes osm google_maps
```
**Tip:** pon siempre el pais en la ciudad ("Valencia, España") para evitar homonimos.

Servicios (`--servicio`): `web` · `seo` · `marketing` · `automatizacion`.
Afectan como se puntua (si vendes webs, sin web = maxima oportunidad; si vendes
automatizacion, sin chatbot/reservas = oportunidad; etc.).

### API (lo que llama el CRM)
```bash
uvicorn app:app --port 8010
curl -X POST localhost:8010/prospectar -H 'content-type: application/json' \
  -d '{"sector":"dentista","ciudad":"Barcelona, España","servicio":"automatizacion","n":15}'
```

### Mensaje de outreach con Claude (opcional)
Copia `.env.example` a `.env` y pon tu `ANTHROPIC_API_KEY`. Con eso, cada prospecto
que encaja trae un `mensaje` personalizado listo para enviar. Sin la key, todo lo
demas funciona igual.

## Como funciona (pipeline)
```
Colectores  ->  Resolver web  ->  Enriquecer  ->  Puntuar (+mensaje)  ->  Ordenar
 osm            (DuckDuckGo,      (HTTPS, SEO,     (0-100 segun            por
 google_maps     si OSM no         responsive,      servicio)              oportunidad
 (+ futuros)     trae la web)      redes, email,
                                   chatbot, reservas)
```
- **models.py** — el tipo `Prospecto` (compartido por todo).
- **config.py** — servicios, mapeo sector->OSM, senales, umbral del ICP. **Ajustable.**
- **collectors/** — `osm.py` (fiable, funciona ya), `google_maps.py` (Scrapling, afinar en vivo).
- **resolver.py** — encuentra la web cuando la fuente no la trae.
- **enrich.py** — analiza la web del negocio.
- **scoring.py** — puntua la oportunidad + (opcional) redacta el mensaje con Claude.
- **pipeline.py / app.py / cli.py** — orquestacion, API, terminal.

## Anadir fuentes (Instagram, LinkedIn, directorios)
Crea `collectors/<fuente>.py` con una clase que herede de `Colector` e implemente
`buscar(sector, ciudad, n) -> [Prospecto]`. Registrala en `pipeline.COLECTORES` (o en
el bloque de import diferido si es pesada). El resto del pipeline no cambia.

## Notas
- **ToS**: OSM es API oficial (sin problema). Google Maps/Instagram/LinkedIn van contra
  sus terminos; usar a ritmo prudente con el stealth de Scrapling, o las APIs oficiales
  para 100% limpio. LinkedIn es el de mayor riesgo (no loguear tu cuenta).
- El `resolver` es heuristico: a veces cae en un directorio en vez de la web propia.
  Se afina ampliando la lista `EXCLUIR`.
- El colector de Google Maps trae selectores de partida; hay que afinarlos contra el
  HTML real la primera vez (Maps cambia su markup).

## Pendiente (siguientes fases)
- **Fase 2**: modulo "Prospeccion" dentro del CRM (`centro-de-mando-siemon.jsx`):
  formulario -> tabla -> "importar al pipeline" (leads con Fuente=Prospeccion).
- **Fase 3**: colectores Instagram y LinkedIn; deploy del API al VPS (junto a n8n).
