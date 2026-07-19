"""Modelo de datos de un prospecto. Un solo tipo compartido por colectores,
enriquecimiento, scoring y la API. asdict() lo vuelve JSON para el CRM."""
from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class Prospecto:
    # --- identidad (lo trae el colector) ---
    nombre: str = ""
    fuente: str = ""            # osm | google_maps | directorio | instagram | linkedin
    categoria: str = ""
    ciudad: str = ""
    web: str = ""
    telefono: str = ""
    email: str = ""
    direccion: str = ""
    maps_url: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    redes: dict = field(default_factory=dict)   # {instagram: url, facebook: url, ...}

    # --- enriquecimiento (lo llena enrich.py) ---
    tiene_web: bool = False
    https: bool = False
    responsive: bool = False
    seo: dict = field(default_factory=dict)      # {title, meta_description, h1}
    señales: dict = field(default_factory=dict)  # {chatbot, reservas, ecommerce, blog, moderno}
    nivel_digital: str = ""                       # bajo | medio | alto

    # --- scoring (lo llena scoring.py) ---
    score: int = 0                                # 0-100 oportunidad segun el servicio
    problemas: list = field(default_factory=list)
    encaja: bool = False                          # pasa el umbral del ICP
    mensaje: str = ""                             # outreach personalizado (opcional, Claude)
    motivo: str = ""                              # por que encaja / por que no

    # --- canal / tipo ---
    canal: str = "directorios"                    # directorios | scrapling | youtube
    tipo: str = "negocio"                         # negocio | creador

    # --- solo canal YouTube (creadores/embajadores) ---
    subs: int = 0                                 # suscriptores del canal
    outlier: int = 0                              # (vistas video / promedio canal) * 100
    fit: int = 0                                  # Ambassador Fit Score 0-100

    # --- info pública visible (perfiles sociales / creadores) ---
    bio: str = ""                                 # descripcion/bio publica
    seguidores: int = 0                           # seguidores/suscriptores publicos
    pais: str = ""                                # pais publico del perfil
    enlaces: list = field(default_factory=list)   # links publicos (linktree, web, otras redes)
    ultima_pub: str = ""                          # fecha de la ultima publicacion (actividad)

    def clave(self) -> str:
        """Clave para deduplicar entre fuentes."""
        base = (self.web or self.telefono or self.nombre).lower().strip()
        return base.replace("https://", "").replace("http://", "").rstrip("/")

    def json(self) -> dict:
        return asdict(self)
