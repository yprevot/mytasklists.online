#!/bin/sh
# Genera los archivos de asociación con la app móvil a partir de variables de entorno.
# Sin valor no se crea el archivo y el gateway responde 404.
#   IOS_APP_ID                 <TEAM_ID>.<bundle id>, p. ej. ABCDE12345.com.listadecompras.app
#   ANDROID_PACKAGE            nombre del paquete (por defecto com.listadecompras.app)
#   ANDROID_CERT_FINGERPRINTS  huellas SHA-256 separadas por comas, sin comillas
# Solo comparten credenciales (autocompletar la contraseña del login). Los applinks
# (abrir enlaces del dominio en la app) exigen antes que la app maneje esas rutas.
set -eu

dir=/usr/share/nginx/well-known/.well-known
mkdir -p "$dir"
rm -f "$dir/apple-app-site-association" "$dir/assetlinks.json"

if [ -n "${IOS_APP_ID:-}" ]; then
  printf '{"webcredentials":{"apps":["%s"]}}\n' "$IOS_APP_ID" > "$dir/apple-app-site-association"
fi

if [ -n "${ANDROID_CERT_FINGERPRINTS:-}" ]; then
  fingerprints=$(printf '%s' "$ANDROID_CERT_FINGERPRINTS" | tr -d ' "' | sed 's/,/","/g')
  printf '[{"relation":["delegate_permission/common.get_login_creds"],"target":{"namespace":"android_app","package_name":"%s","sha256_cert_fingerprints":["%s"]}}]\n' \
    "${ANDROID_PACKAGE:-com.listadecompras.app}" "$fingerprints" > "$dir/assetlinks.json"
fi
