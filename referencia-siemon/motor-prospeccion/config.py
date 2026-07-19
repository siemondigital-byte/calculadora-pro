"""Configuracion del motor: servicios que vende Siemon, mapeo de sectores a
categorias OSM, y umbral del ICP. Ajustable sin tocar el codigo del pipeline."""

# Servicios que ofreces (afectan como se puntua la oportunidad).
# clave -> foco del scoring
SERVICIOS = {
    "web": "web",                       # vendes webs/diseno -> sin web o web vieja = oportunidad
    "seo": "seo",                       # vendes SEO -> sin meta tags = oportunidad
    "marketing": "marketing",           # vendes marketing/redes -> sin redes activas = oportunidad
    "automatizacion": "automatizacion", # vendes IA/automatizacion -> sin chatbot/reservas = oportunidad
    "chatbot": "automatizacion",
    "reservas": "automatizacion",
}
SERVICIO_DEFAULT = "automatizacion"

# Umbral: score minimo para marcar "encaja" con el ICP.
UMBRAL_ENCAJE = 55

# --- Canales de prospeccion (las 3 skills, una por canal) ---
# directorios -> negocios via OpenStreetMap + analisis de web (skill kit-prospeccion).
# scrapling   -> negocios via busqueda web con Scrapling (skill prospeccion/Scrapling).
# youtube     -> creadores/embajadores via YouTube Data API v3 (skill youtube-embajadores).
CANALES = {
    "directorios": {"tipo": "negocio", "lead_source": "Prospección"},
    "scrapling":   {"tipo": "negocio", "lead_source": "Prospección"},
    "youtube":     {"tipo": "creador", "lead_source": "Prospección YouTube"},
    "instagram":   {"tipo": "creador", "lead_source": "Prospección Instagram"},
    "linkedin":    {"tipo": "negocio", "lead_source": "Prospección LinkedIn"},
    # alias hacia atras
    "osm":         {"tipo": "negocio", "lead_source": "Prospección"},
    "google_maps": {"tipo": "negocio", "lead_source": "Prospección"},
}
CANAL_DEFAULT = "directorios"

# --- YouTube (canal embajadores) ---
# Banda de tamano preferida para embajadores (subs). Fuera de la banda baja el fit.
YT_BANDA_MIN = 2000
YT_BANDA_MAX = 50000
YT_BANDA_TECHO = 200000
# Palabras que delatan afinidad con los infoproductos de Siemon (nicho fit).
YT_NICHO_KEYWORDS = [
    "finanzas", "dinero", "invertir", "inversion", "libertad financiera", "ahorro",
    "mentalidad", "productividad", "habitos", "emprend", "negocio", "marca personal",
    "ia", "inteligencia artificial", "automatiz", "marketing", "ventas", "mindset",
    "money", "wealth", "invest", "finance", "business", "entrepreneur", "productivity",
]
YT_UMBRAL_FIT = 60  # fit minimo para marcar "encaja"

# Mapeo de sector (lo que escribe el usuario) -> filtros OSM (Overpass).
# Cada entrada es una lista de tags "clave=valor". Si el sector no esta aqui,
# se cae a una busqueda por nombre (name~"sector").
SECTOR_A_OSM = {
    "dentista": ["amenity=dentist", "healthcare=dentist"],
    "clinica dental": ["amenity=dentist"],
    "clinica": ["amenity=clinic", "healthcare=clinic"],
    "medico": ["amenity=doctors", "healthcare=doctor"],
    "fisioterapia": ["healthcare=physiotherapist"],
    "restaurante": ["amenity=restaurant"],
    "cafe": ["amenity=cafe"],
    "bar": ["amenity=bar"],
    "gimnasio": ["leisure=fitness_centre", "leisure=sports_centre"],
    "peluqueria": ["shop=hairdresser"],
    "belleza": ["shop=beauty", "shop=hairdresser"],
    "spa": ["leisure=spa"],
    "abogado": ["office=lawyer"],
    "asesoria": ["office=accountant", "office=financial", "office=tax_advisor"],
    "inmobiliaria": ["office=estate_agent"],
    "arquitecto": ["office=architect"],
    "agencia": ["office=advertising_agency", "office=it"],
    "tienda": ["shop=*"],
    "hotel": ["tourism=hotel"],
    "veterinaria": ["amenity=veterinary"],
    "optica": ["shop=optician"],
    "farmacia": ["amenity=pharmacy"],
    "autoescuela": ["office=driving_school"],
    "escuela": ["amenity=school", "amenity=language_school"],
    "taller": ["shop=car_repair", "craft=car_repair"],
}

# Palabras/tecnologias que delatan cada senal (se buscan en el HTML de la web).
SENALES = {
    "chatbot": ["intercom", "tawk.to", "drift", "crisp.chat", "livechat", "zendesk",
                "wa.me", "api.whatsapp", "hubspot", "manychat", "chatbot"],
    "reservas": ["calendly", "cal.com", "acuityscheduling", "bookingpage", "reservafacil",
                 "simplybook", "koalendar", "reserva online", "book now", "agendar cita"],
    "ecommerce": ["shopify", "woocommerce", "prestashop", "magento", "add to cart",
                  "anadir al carrito", "checkout"],
    "blog": ["/blog", "/noticias", "/articulos", "wp-content"],
}

# Redes a detectar en la web.
REDES = {
    "instagram": ["instagram.com"],
    "facebook": ["facebook.com", "fb.com"],
    "linkedin": ["linkedin.com"],
    "youtube": ["youtube.com", "youtu.be"],
    "tiktok": ["tiktok.com"],
    "twitter": ["twitter.com", "x.com"],
}
