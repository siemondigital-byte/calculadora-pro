"""Interfaz comun de un colector. Cada fuente (OSM, Google Maps, directorio,
Instagram, LinkedIn) implementa buscar() y devuelve una lista de Prospecto.
Asi el pipeline es agnostico a la fuente y se enchufan nuevos colectores igual."""
from abc import ABC, abstractmethod
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import Prospecto  # noqa: E402


class Colector(ABC):
    nombre = "base"

    @abstractmethod
    def buscar(self, sector: str, ciudad: str, n: int) -> list:
        """Devuelve hasta n Prospecto del sector en la ciudad."""
        raise NotImplementedError
