#!/usr/bin/env sh
# ─────────────────────────────────────────────────────────────
#  Copia los datos del volumen de PostgreSQL 16 al de PostgreSQL 18.
#
#  Solo hace falta si ya tenías datos con la versión anterior del
#  docker-compose (volumen `<proyecto>_postgres-data`). El volumen viejo no se
#  toca: cuando compruebes que todo está bien lo puedes borrar con
#  `docker volume rm listadecompras_postgres-data`.
#
#  Uso (desde la raíz del repositorio):  sh infra/postgres/upgrade-16-to-18.sh
# ─────────────────────────────────────────────────────────────
set -eu

PROJECT="${COMPOSE_PROJECT_NAME:-listadecompras}"
OLD_VOLUME="${PROJECT}_postgres-data"
DB="${POSTGRES_DB:-listadecompras}"
DB_USER="${POSTGRES_USER:-lista}"
DUMP="pg16-dump-$(date +%Y%m%d%H%M%S).sql"
EXPORTER="lc-pg16-export"

if ! docker volume inspect "$OLD_VOLUME" >/dev/null 2>&1; then
  echo "No existe el volumen $OLD_VOLUME: no hay datos de la 16 que migrar."
  exit 0
fi

echo "→ Deteniendo el backend para que nadie escriba durante la copia"
docker compose stop backend >/dev/null 2>&1 || true

echo "→ Levantando un PostgreSQL 16 temporal sobre el volumen viejo"
docker rm -f "$EXPORTER" >/dev/null 2>&1 || true
docker run -d --name "$EXPORTER" -e POSTGRES_PASSWORD=unused \
  -v "$OLD_VOLUME":/var/lib/postgresql/data postgres:16-alpine >/dev/null
until docker exec "$EXPORTER" pg_isready -U "$DB_USER" -d "$DB" >/dev/null 2>&1; do sleep 1; done

echo "→ Exportando $DB a $DUMP"
docker exec "$EXPORTER" pg_dump -U "$DB_USER" -d "$DB" --clean --if-exists --no-owner > "$DUMP"
docker rm -f "$EXPORTER" >/dev/null

echo "→ Arrancando PostgreSQL 18 y restaurando"
docker compose up -d --wait postgres
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB" < "$DUMP" >/dev/null

echo "→ Levantando el resto de la pila"
docker compose up -d
echo "Listo. Copia de seguridad del volcado: $DUMP"
