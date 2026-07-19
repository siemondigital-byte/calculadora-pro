#!/usr/bin/env bash
# Activa la auto-actualizacion (UNA sola vez). Desde entonces, cada cambio que
# el agente publique en el repo se aplica solo al VPS en menos de 5 minutos.
set -euo pipefail

LINEA="*/5 * * * * /bin/bash /root/atlantis/centro-de-mando/scripts/auto-actualizar.sh >/dev/null 2>&1"
( crontab -l 2>/dev/null | grep -v "auto-actualizar.sh" ; echo "$LINEA" ) | crontab -

echo "Auto-actualizacion ACTIVADA: el VPS revisa el repo cada 5 minutos y"
echo "reconstruye solo lo que cambie (web y/o motor)."
echo "Registro de lo aplicado: /root/atlantis/auto-actualizacion.log"
echo
echo "Nota: cuando cambie la WEB del CRM, recuerda cerrar por completo la"
echo "pestana del Centro de Mando y abrirla una vez para ver lo nuevo."
