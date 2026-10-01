# Coordinación móvil/backend — validación local

Estado efectivo: `bridge`, mínimo 1.0.0, registro por correo flujo 2 y cliente nuevo 2.0.0. No se activó un corte global ni se publicaron binarios.

- API de autenticación/compatibilidad: 15/15 casos; comprobación posterior de compatibilidad y rollout: 7/7.
- React Native ejecutado en web: 21/21 casos, incluidos servidor anterior sin flujo 2 y pantalla de actualización con alternativas.
- Política, guard y controles de release: 6/6 pruebas de lógica.
- Typecheck de todos los proyectos, build backend, imagen Docker, contrato y git diff --check: aprobados.
- YAML y actionlint para deploy.yml/mobile.yml: aprobados. No se ejecutaron workflows en GitHub/EAS/Coolify.
- Preflight real contra localhost: bridge y flujo 2 confirmados.
- Intento de preflight enforced: rechazado por falta de actualización Android publicada suficiente, como se esperaba. No se cambió la configuración del servidor para este test.

Artefactos: rollout-preflight.json, rollout-cut-blocked.txt, rollout-backend-results.json, rollout-backend-final-results.json, rollout-mobile-results.json y mobile-rollout-unit.tap.

La confirmación MOBILE_RELEASE_READY_VERSION es del operador tras validar disponibilidad y adopción; no representa una métrica automática. Sigue pendiente publicar/verificar los binarios reales y configurar los mismos valores de rollout en GitHub y Coolify antes del corte.
