# XOps Operational Graph — POC v1

Centro de comando operativo del portafolio BI y AI/ML. Responde tres preguntas:
**qué está roto, a quién le pega, y quién debe responder.**

Corte de datos declarado: **2026-08-21**.

## Alcance

**v1 cubre** impacto por proceso y por ruteo, sobre 504 aplicaciones.

**v1 NO cubre**, y la aplicación lo declara en pantalla en lugar de ocultarlo:

- Impacto por audiencia de usuarios.
- Linaje de pipelines.
- El eslabón Dashboard → Aplicación, excluido por decisión de alcance, no por olvido.
- RCA Intelligence, Agent Actions y escritura hacia ServiceNow.

## Stack

- Next.js 15 (App Router) + TypeScript, desplegable en Vercel sin configuración adicional.
- Sin backend ni base de datos. Un único `data/xops-operational-graph-data.json` importado
  estáticamente. Las 504 fichas de aplicación se prerenderizan en build.
- Tailwind, sin librería de componentes.
- Recharts, sólo donde una tabla no basta: series de calidad, comparativo de cobertura AI/ML
  y distribución de Decálogo.

## Comandos

```bash
npm install
npm run seed        # regenera el dataset semilla y verifica 23 invariantes
npm run dev         # http://localhost:3000
npm run build       # build de producción
npm run typecheck
```

## Estado de los datos

> **El repositorio no incluye el extracto real.** `data/xops-operational-graph-data.json`
> lo genera `scripts/generate-seed-data.mjs`: son **datos sintéticos** que respetan el
> contrato de la sección 3 de la especificación y **reproducen exactamente los agregados
> declarados** al corte. Sirven para que la aplicación sea ejecutable y para que los
> criterios de aceptación se puedan verificar en pantalla.

El generador falla si algún invariante deja de cumplirse. Los 23 que verifica:

| Invariante | Valor |
|---|---|
| Aplicaciones / plataformas / assignment groups / eslabones | 504 / 38 / 268 / 4 |
| Sin AG · sin DPM confirmado · sin atribución completa | 339 · 221 · 279 |
| Ruteables · con plataforma | 165 · 240 |
| C1 · C3 | 43 · 32 |
| Apps con más de un AG · máximo de AGs en una app | 113 · 14 |
| AI/ML: total · ruteables · con DPM · con plataforma | 142 · 52 · 81 · 32 |
| Plataformas marcadas `is_ai_platform` | 6 |
| Teradata directo · SAP BW directo · **unión** | 28 · 23 · **43** (la suma daría 51) |
| AGs con corpus de calidad · patrones recurrentes | 140 · 150 |

**Para usar el extracto real:** reemplazar `data/xops-operational-graph-data.json`
conservando el esquema de `lib/types.ts`. Ningún módulo lee del generador en tiempo de
ejecución, y ninguna cifra de la interfaz está escrita a mano: todo el panel de hueco,
las uniones de blast radius y las coberturas por subconjunto se calculan desde el JSON.

## Pantallas

| Ruta | Pantalla |
|---|---|
| `/` | Portfolio Health — 4 eslabones de cobertura, tabla filtrable de 504 apps, panel fijo de hueco declarado |
| `/blast-radius` | Blast Radius — selector multi-plataforma, unión deduplicada, procesos afectados, ruta de respuesta |
| `/app/[app_id]` | Application Resolver — ficha completa y **todos** los Assignment Groups |
| `/quality` | Work Notes Quality — línea base y delta, series por 4 granularidades, ranking por AG, patrones recurrentes, Decálogo |
| `/ai-ops` | AI Ops — vista filtrada del segmento AI/ML con narrativa propia |

El buscador global (nombre o APM, `⌘K`) y el panel **Cómo leer esto** están en el layout,
por lo tanto son accesibles desde las cinco pantallas.

## Dónde viven las reglas del modelo

Las reglas no son comentarios: están implementadas en un solo lugar cada una, de modo que
una pantalla no pueda violarlas por descuido.

| Regla | Implementación |
|---|---|
| **R1** blast radius no aditivo | `computeBlast()` en `lib/selectors.ts` construye la unión deduplicada; la suma ingenua se conserva sólo para mostrarla tachada |
| **R2** toda cifra con denominador | `<Metric>` / `<InlineMetric>` exigen `resolved` y `universe`; son el único camino para presentar una proporción |
| **R3** tickets = costo, no riesgo | `<SupportLoad>` usa un color neutro fijo y la etiqueta "carga de soporte"; ordena en su propia columna |
| **R4** lo no resuelto se declara | `<TbdValue>`, `<NotRoutableTag>`, `<GateChips>` y `computeGaps()`; ningún filtro descarta el hueco |
| **R5** nivel de evidencia | `<EvidenceBadge>`, con E3 marcado como baja autoridad en cada tarjeta y cada cifra derivada |
| **R6** un solo instrumento | La pantalla de calidad declara QN v2.4.2 y muestra la divergencia contra la regla binaria sin mezclar bandas |
| **R7** denominador de elegibilidad | `CorpusStamp` acompaña cada sección de calidad con 242.706 de 277.408 y los close codes excluidos |
| **R8** base posterior al quiebre | Ventana base 2025-08-01…2026-01-31, sombreada en la serie, con el quiebre 2025Q3 marcado |
| **R9** derivación visible | La ficha de aplicación expone `technology_raw` y el tier de evidencia de la clasificación de plataforma |
| **dirección del delta** | `deltaTone()` en `components/DeltaMetric.tsx` es la única función que decide el color de un delta, y lee `direccion_deseada`, nunca el signo |

## Extensión prevista (sección 7), sin rehacer pantallas

El contrato ya declara los ganchos y el código los trata como opcionales:

- `lib/types.ts` define `Dashboard` y `Audience`, y `GraphData.dashboards?` / `Application.audience?`.
- `lib/data.ts` expone `hasDashboardLink` y `hasAudience`, hoy en `false`.
- `subsetCoverage()` recalcula cobertura sobre cualquier subconjunto, por lo tanto admite
  eslabones nuevos sin tocar las pantallas existentes.
- El blast radius ponderado está aislado en `computeBlast()`: incorporar audiencia es
  agregar un término, no rehacer la pantalla. La pantalla ya declara que hoy ese factor
  no existe y no se estima.

## Nota de modelado: registro no es ruteo

El eslabón declarado L4 mide presencia en ServiceNow CMDB (373 de 504). La compuerta
**Ruteable** exige al menos un Assignment Group declarado en el alcance (165 de 504).
Son dos medidas distintas y la aplicación muestra ambas por separado, en `/` y en
`/ai-ops`, en lugar de promediarlas u ocultar la diferencia.

## Verificación de los criterios de aceptación

`scripts/verify-acceptance.mjs` comprueba los 12 criterios de la sección 6 contra la
aplicación corriendo (14 aserciones, algunas cubren un criterio en dos partes). Falla
con código 1 si alguno deja de cumplirse.

```bash
npm run build
npx next start -p 3100 &
npm i -D playwright --no-save     # sólo para verificar; no es dependencia del proyecto
npm run verify
```

Estado al último corte: **14/14**.

| Criterio | Cómo se verifica |
|---|---|
| 1 · unión, nunca suma | Selecciona Teradata + SAP BW y exige 43, la suma 51 tachada y el traslape 8 |
| 2 · toda cifra con denominador | Exige `240 de 504` y `47.6%` en las tarjetas de cobertura |
| 3 · app sin AG visible y etiquetada | Abre una app sin AG y busca "No ruteable"; comprueba 339 / 221 / 279 en el panel de hueco |
| 4 · DPM TBD como TBD | Busca el chip TBD en el campo DPM |
| 5 · panel de reglas accesible | Lo abre en las 5 rutas y exige R1…R9 |
| 6 · corte permanente | Exige `2026-08-21` en las 5 rutas |
| 7 · E3 marcados | Exige al menos 3 marcas "baja autoridad" |
| 8 · tickets sin semáforo | Comprueba que la columna use un único estilo en todas las filas |
| 9 · delta por dirección deseada | Exige que `-5.2 pp` de Poor en críticos venga en verde y con la palabra "mejora" |
| 10 · corpus y elegibilidad visibles | Exige `242,706 de 277,408` repetido y los umbrales 36.6% → 41.8% |
| 11 · granularidad sin recargar | Conmuta las 4 series y exige 4 conteos de periodo distintos con la misma navegación |
| 12 · candidato a SOP | Exige la etiqueta en la tabla y la lectura explícita en pantalla |
