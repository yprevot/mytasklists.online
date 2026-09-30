# Scripts de inicialización de PostgreSQL

Todo lo que se coloque aquí con extensión `.sql` o `.sh` lo ejecuta la imagen oficial de
PostgreSQL **la primera vez** que se crea el volumen de datos.

El esquema de la aplicación **no** se crea aquí: lo gestiona la migración de TypeORM
(`apps/backend/src/database/migrations/`), que se ejecuta al arrancar el backend cuando
`RUN_MIGRATIONS=true`. Esta carpeta queda para extensiones, roles o ajustes previos.
