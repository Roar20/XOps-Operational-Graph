# XOps Operational Graph · POC v1 — Especificación

Documento de entrada para Claude Code.

---

## 1. Qué es y qué no es

Modela el portafolio de aplicaciones BI y AI/ML como un grafo de relaciones declaradas, no como una lista. Responde qué aplicaciones existen, qué queda expuesto si una plataforma se degrada, quién debe responder, y si los incidentes quedan documentados.

**Fuera de alcance:** acciones automatizadas, ruteo por agente, y escritura hacia ServiceNow. La aplicación informa, no ejecuta.

---

## 2. Stack

Next.js con App Router, TypeScript y Tailwind. Sin backend, sin base de datos, sin autenticación. Los datos son archivos JSON estáticos en `/data`. Gráficas con Recharts.

---

## 3. Datos · siete archivos independientes

Los catálogos y los incidentes son cosas distintas: se refrescan con cadencias distintas, tienen fechas de corte distintas y tienen dueños distintos. Por eso van en archivos separados y no en un solo bundle.

| Archivo | Grano | Filas | Corte | Refresco |
|---|---|---|---|---|
| `meta.json` | contrato del modelo | — | 2026-08-21 | con cambios |
| `catalog_applications.json` | una por aplicación | 504 | 2026-08-21 | mensual |
| `catalog_platforms.json` | una por plataforma | 38 | 2026-08-21 | trimestral |
| `catalog_assignment_groups.json` | una por grupo | 268 | 2026-08-21 | mensual |
| `edges_app_platform.json` | un par app-plataforma | 468 | 2026-08-21 | mensual |
| `edges_app_ag.json` | un par app-grupo | 672 | 2026-08-21 | mensual |
| `incidents_quality.json` | agregados del corpus | — | 2026-08-12 | semanal |

Catálogos, aristas y meta suman 361 KB. Incidentes son 104 KB aparte.

**Consecuencia de diseño:** `incidents_quality.json` se carga solo en la ruta `/quality`. Si ese archivo falta o está desactualizado, las otras cuatro pantallas siguen funcionando y la app lo declara en lugar de fallar.

### Esquemas

`catalog_applications.json` — `app_id, name, apm, category, product_category, scope_status, process, sector, criticality (C1|C2|C3|C-), criticality_raw, dpm, dpm_l3, owner, tech_lead, program, archetype, service_tier, support_window, user_base, financial_impact, technology_raw, declared_reports, is_ai_ml`

`catalog_platforms.json` — `platform_id, name, is_legacy, is_ai_platform`

`catalog_assignment_groups.json` — `ag_id, name, ag_key`

`edges_app_platform.json` — `app_id, platform_id, evidence_tier`

`edges_app_ag.json` — `app_id, ag_id, evidence_tier`

`meta.json` — `rules[], evidence_tiers{}, criticality_scale{}, criticality_weights{}, derivation_warning, files[], coverage[], sources[], ai_ops{}`

**Los catálogos no traen agregados.** Conteos, compuertas, radio de impacto y peso de criticidad se calculan desde las aristas al cargar. Un agregado guardado en el archivo es un número que se desincroniza en silencio.

---

## 4. Reglas de cómputo

**R1. El radio de impacto no es aditivo.** Al seleccionar varias plataformas se calcula la unión deduplicada de `app_id`, nunca la suma de conteos.

**R2. Toda cifra lleva denominador.** Nunca "165 ruteables" sino "165 de 504, 32.7%". Un componente `<Metric resolved universe />` que no permita renderizar el porcentaje solo.

**R3. Lo no resuelto se declara.** Una aplicación sin grupo aparece etiquetada "No ruteable", no se filtra. Un DPM en TBD se muestra como TBD.

**R4. Cada arista lleva su nivel de evidencia.** E1 es CMDB, E2 análisis derivado, E3 hoja de cálculo. Se marca de forma discreta y consistente.

**R5. La derivación no se disfraza de dato.** Las plataformas obtenidas normalizando `technology_raw` se muestran con el texto original disponible.

**R6. Un solo instrumento de calidad.** El scorer canónico es QN v2.4.2. No se mezclan bandas de scorers distintos.

**R7. El color del delta responde a la dirección deseada, no al signo.**

**Compuertas derivadas:** `attributable` = tiene proceso y sector · `routable` = tiene al menos una arista de grupo · `owned` = dpm distinto de vacío y de TBD · `platform_known` = tiene al menos una arista de plataforma.

---

## 5. Pantallas

**`/` Portfolio Health.** Los cuatro eslabones de `meta.coverage` con barra, resuelto sobre universo y dueño del desbloqueo. Tabla de 504 aplicaciones con filtros y tres chips de compuerta. Panel fijo de hueco declarado, calculado desde los datos.

**`/blast-radius`.** Selector multi-plataforma. Aplicaciones afectadas por unión deduplicada, procesos y sectores alcanzados, mezcla de criticidad, radio ponderado, grupos y DPM en la ruta de respuesta, y sección aparte para las afectadas sin ruta declarada.

**`/app/[app_id]`.** Identidad, atribución con `criticality_raw` visible, propiedad, plataformas y **todos** los grupos. 123 aplicaciones tienen más de uno y una llega a 14, por lo tanto la ficha declara que la aplicación por sí sola no determina el destino del ticket.

**`/quality`.** Selector de granularidad semana, mes, trimestre y año. Línea base contra actual con delta. Ranking de 140 grupos. 150 patrones recurrentes, marcando como candidato a SOP los de volumen alto con tasa diagnóstica baja. Regla de elegibilidad y corpus de 242,706 sobre 277,408 visibles junto a toda cifra.

**`/ai-ops`.** Vista filtrada sobre 142 aplicaciones AI/ML. El elemento central es el comparativo de cobertura contra el portafolio completo: 52 ruteables, 81 con DPM y 32 con plataforma.

---

## 6. Criterios de aceptación

1. La unión de dos plataformas nunca es la suma de sus conteos, e indica cuántas se traslapan.
2. Ninguna cifra aparece sin denominador.
3. Una aplicación sin grupo es visible y está etiquetada, no filtrada.
4. Un DPM TBD se muestra como TBD.
5. Las reglas de `meta.rules` son accesibles desde toda la app.
6. Las fechas de corte de cada archivo son visibles.
7. Las aristas E3 están marcadas como baja autoridad.
8. El panel de hueco muestra 192 sin grupo, 121 sin DPM, 131 sin atribución y 264 sin plataforma.
9. Si `incidents_quality.json` no carga, las otras cuatro pantallas siguen funcionando.
10. El color del delta responde a `direccion_deseada`.
11. Ningún agregado está escrito a mano; todos se calculan al cargar.

---

## 7. Extensión prevista

Cuando se confirmen los 30 workspaces de consumo, entran dos archivos más: `catalog_dashboards.json` y `edges_dashboard_app.json`. La app debe absorberlos sin rehacer las pantallas.
