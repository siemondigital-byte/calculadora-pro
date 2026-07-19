"""CLI del motor de prospeccion. Para usarlo desde la terminal sin el CRM.

Ejemplos:
  python3 cli.py --sector dentista --ciudad Barcelona --servicio automatizacion --n 20
  python3 cli.py --sector gimnasio --ciudad Madrid --servicio marketing --out leads.csv
  python3 cli.py --sector abogado --ciudad Valencia --fuentes osm google_maps
"""
import argparse
import csv
import json
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipeline import prospectar  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description="Prospeccion Siemon")
    ap.add_argument("--sector", required=True)
    ap.add_argument("--ciudad", required=True)
    ap.add_argument("--servicio", default="automatizacion",
                    help="web | seo | marketing | automatizacion")
    ap.add_argument("--n", type=int, default=25)
    ap.add_argument("--fuentes", nargs="+", default=["osm"],
                    help="osm google_maps")
    ap.add_argument("--idioma", default="es")
    ap.add_argument("--out", default="", help="archivo .json o .csv de salida")
    a = ap.parse_args()

    res = prospectar(a.sector, a.ciudad, a.servicio, a.n, a.fuentes, a.idioma)
    ps = res["prospectos"]

    print(f"\n{res['total']} negocios | {res['encajan']} encajan con tu ICP "
          f"({a.sector} en {a.ciudad}, servicio: {a.servicio})\n")
    print(f"{'SCORE':<6}{'NEGOCIO':<30}{'WEB':<34}{'TEL':<16}PROBLEMA")
    print("-" * 100)
    for p in ps:
        print(f"{p['score']:<6}{p['nombre'][:28]:<30}{(p['web'] or '-')[:32]:<34}"
              f"{(p['telefono'] or '-')[:14]:<16}{(p['problemas'][0] if p['problemas'] else '')[:34]}")

    if a.out.endswith(".json"):
        with open(a.out, "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False, indent=2)
        print(f"\nGuardado: {a.out}")
    elif a.out.endswith(".csv"):
        cols = ["score", "encaja", "nombre", "categoria", "ciudad", "web", "telefono",
                "email", "direccion", "nivel_digital", "problemas", "mensaje"]
        with open(a.out, "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow(cols)
            for p in ps:
                w.writerow([p.get(c) if not isinstance(p.get(c), list)
                            else " | ".join(map(str, p.get(c))) for c in cols])
        print(f"\nGuardado: {a.out}")


if __name__ == "__main__":
    main()
