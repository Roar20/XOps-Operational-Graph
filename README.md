# XOps Operational Graph — POC v1

Centro de comando operativo del portafolio BI y AI/ML de PepsiCo. Responde tres preguntas:
**qué está roto, a quién le pega, y quién debe responder.**

Corte de datos declarado: **2026-08-21**. Corte del corpus de calidad: **2026-08-12**.

## Alcance

**v1 cubre** impacto por proceso y ruteo, sobre 504 aplicaciones.

**v1 NO cubre**, y la aplicación lo declara en pantalla en lugar de ocultarlo:

- Impacto por audiencia de usuarios.
- Linaje de pipelines.
- El eslabón Dashboard → Aplicación, excluido **por decisión de alcance, no por olvido**.
  De 159 workspaces catalogados, 0 tienen aplicación confirmada.
- RCA Intelligence, Agent Actions y escritura hacia ServiceNow.

La cobertura parcial declarada es el argumento de esta POC, no su defecto. Ningún dato
faltante se imputa y ningún registro incompleto se filtra para que la interfaz se vea mejor.

## Origen de los datos

`data/xops-operational-graph-data.json` **es el extracto real**, proyectado desde la capa
semántica `XOps_Operational_Graph_Semantic_Layer_v3.xlsx` por `scripts/build_data.py`.

```bash
npm run data     # regenera el JSON desde el xlsx y verifica 21 invariantes
```

El script falla si algún invariante deja de cumplirse. No hay datos sintéticos en el
repositorio y ningún módulo de la aplicación lee del generador en tiempo de ejecución.

### Decisiones de proyección que vale la pena conocer

- **El puente es la fuente del eslabón Aplicación → Assignment Group.** La columna
  `assignment_groups` del inventario está topada en 10 entradas y corta el último nombre a
  la mitad; sólo se usa donde no hay fila de puente. De ahí salen las 113 aplicaciones con
  más de un AG y la que llega a 14.
- **Las listas traen su propio separador.** Las plataformas usan coma y los assignment
  groups punto y coma, porque sus nombres contienen comas internas
  (`REAL ESTATE, FACILITIES SUPPORT CGF`).
- **El eslabón Plataforma → Aplicación mezcla dos autoridades.** 91 filas vienen del
  análisis de Tech Buckets (**E2**) y el resto de normalizar el texto libre
  `Technology Stack` (**E3**). No se promedian: se desglosan, y la ficha de aplicación
  muestra `technology_raw` junto a las plataformas derivadas.
- **Consumo no se publica en v1.** Ninguna de las 838 filas de consumo trae
  `app_id_confirmed`, por lo tanto no puede unirse a ninguna aplicación. Se emiten sólo con
  `python3 scripts/build_data.py --with-consumption`.

### Cifras del corte

| | |
|---|---|
| Aplicaciones · plataformas · assignment groups · eslabones | 504 · 38 · 268 · 4 |
| L1 Plataforma → Aplicación | 240 de 504 · hueco 264 |
| L2 Aplicación → Assignment Group | 312 de 504 · hueco 192 |
| L3 Aplicación → DPM sin TBD | 383 de 504 · hueco 121 |
| L4 Aplicación → Proceso y Sector | 373 de 504 · hueco 131 |
| Sin criticidad declarada (`C-`) | 324 de 504 |
| Apps con más de un AG · máximo en una app | 113 · 14 (AISP AZURE KUBERNETES SERVICE) |
| AI/ML: total · ruteables · con DPM · con plataforma | 142 · 52 · 81 · 32 |
| Corpus de calidad: elegibles de crudos | 242 706 de 277 408 |
| Claves de AG unidas al corpus | 79 de 265 |
| Series temporales: semanas · meses · trimestres · años | 138 · 33 · 12 · 4 |

### Diferencias contra las cifras esperadas en la especificación

Se reportan en lugar de ajustarse. El dato manda:

| Cifra | Especificación | Extracto real |
|---|---|---|
| TERADATA + SAP_BW: unión · suma · traslape | 43 · 51 · 8 | **47 · 56 · 9** |
| AGs alcanzables por TERADATA | 33 | **31** |
| AGs alcanzables por POWER_BI | 46 | **42** |
| Join de calidad: AGs unidos | 77 de 237 | **79 de 265** |
| Patrones recurrentes | 150 | **200** |
| Periodos: meses · trimestres | 50 · 17 | **33 · 12** |
| Plataformas en el catálogo | 25 | **38** |

Las cifras de apps directas (TERADATA 30, POWER_BI 129), procesos (6) y todo el bloque
AI/ML (142 · 52 · 81 · 32) sí coinciden. La brecha en conteos de AG es consistente con
**DQ1**: nombres distintos que colapsan a la misma clave normalizada.

### Hallazgos de calidad de dato, declarados y no normalizados

- **DQ1** — claves de AG duplicadas: 268 nombres colapsan a 265 claves normalizadas.
  Por eso el denominador de "claves unidas al corpus" es 265 y no 268.
- **DQ2** — hueco entre el `ag_count` declarado por el inventario y el conteo real del puente.

Ambos viajan en `meta.data_quality_notes` y se muestran en la aplicación.

## Stack

- Next.js 15 (App Router) + TypeScript, desplegable en Vercel sin configuración adicional.
- **Sin backend, sin base de datos, sin autenticación, sin variables de entorno.** Un único
  JSON importado estáticamente. Las 504 fichas de aplicación se prerenderizan en build
  (511 rutas estáticas en total).
- Tailwind, sin librería de componentes.
- Recharts, sólo donde una tabla no basta: serie de calidad, comparativo de cobertura AI/ML
  y distribución del Decálogo.

## Comandos

```bash
npm install
npm run data        # regenera data/*.json desde el xlsx (requiere openpyxl)
npm run dev         # http://localhost:3000
npm run build       # build de producción
npm run typecheck
npm run verify      # criterios de aceptación contra la app corriendo
```

## Pantallas

| Ruta | Pantalla |
|---|---|
| `/` | Portfolio Health — 4 eslabones de cobertura, tabla filtrable de 504 apps, panel fijo de hueco declarado |
| `/blast-radius` | Blast Radius — selector multi-plataforma, unión deduplicada, procesos afectados, ruta de respuesta |
| `/app/[app_id]` | Application Resolver — identidad, atribución, propiedad, operación con **todos** los Assignment Groups |
| `/quality` | Work Notes Quality — corpus y elegibilidad, línea base y delta, series en 4 granularidades, ranking por AG, candidatos a SOP, Decálogo, patrones recurrentes |
| `/ai-ops` | AI Ops — el segmento AI/ML medido con los mismos cuatro eslabones que el resto |

El buscador global (nombre o APM, `⌘K`) y el panel **Cómo leer esto** viven en el layout,
por lo tanto son accesibles desde las cinco pantallas, igual que la fecha de corte.

## Dónde viven las reglas del modelo

Las reglas no son comentarios: cada una está implementada en un solo lugar, de modo que una
pantalla no pueda violarla por descuido.

| Regla | Implementación |
|---|---|
| **R1** la Business Application es la espina dorsal | `types/index.ts` · toda entidad se relaciona con `Application`, nunca entre sí |
| **R2** toda relación es N:M | `platforms[]` y `ags[]` son listas; `agsOf()` / `platformsOf()` nunca devuelven un escalar |
| **R3** ninguna métrica sin su cobertura | `<Metric>` / `<InlineMetric>` exigen `resolved` y `universe`; no existe camino para renderizar un porcentaje suelto. Las tablas de tasas declaran su denominador en `<TableCaption>` |
| **R4** blast radius no aditivo | `computeBlast()` en `lib/data.ts` construye la unión deduplicada; la suma ingenua se conserva sólo para mostrarla tachada junto al traslape |
| **R5** tickets = costo, nunca riesgo | `<SupportLoad>` usa un color neutro único y la etiqueta "eje de costo, no de riesgo" |
| **R6** un solo instrumento de calidad | `/quality` declara QN v2.4.2 y expone la divergencia contra la regla binaria del xlsx sin mezclar bandas |
| **R7** la normalización es derivación declarada | La ficha de aplicación expone `technology_raw` y el tier E2/E3 de la clasificación de plataforma |
| **R8** cada fila de puente lleva evidencia y fuente | `<EvidenceBadge>` con `meta.link_sources` en el punto donde se usa el dato |
| lo no resuelto se declara | `<TbdValue>`, `<NotRoutableTag>`, `<GateChips>`, `computeGaps()`; ningún filtro descarta el hueco |
| elegibilidad como parte de la métrica | `quality.meta.eligibility_rule` y `eligibility_effect` acompañan al corpus 242 706 de 277 408 |
| línea base posterior al quiebre | Ventana 2025-08-01 → 2026-01-31, sombreada en la serie, con el quiebre 2025Q3 escrito |
| dirección del delta | `deltaTone()` en `components/Delta.tsx` es la única función que decide el color de un delta, y lee `direccion_deseada`, nunca el signo |

## Extensión prevista (sección 7), sin rehacer pantallas

- `types/index.ts` ya define `ConsumptionRow` y `GraphData.consumption?` como opcional;
  `Application` admite `audience` como campo nuevo sin romper el contrato.
- `lib/data.ts` expone `consumption` y `hasConsumption`, hoy en `false`.
- `subsetCoverage()` recalcula los cuatro eslabones sobre **cualquier** subconjunto, por lo
  tanto un eslabón nuevo entra sin tocar las pantallas.
- `computeBlast()` aísla el ponderado: incorporar audiencia es agregar un término, no
  rehacer la pantalla. Hoy la pantalla declara que ese factor no existe y no se estima.
- `meta.dashboard_link` ya viaja con el estado del eslabón (159 workspaces, 0 confirmados)
  y se muestra como límite declarado en la ficha de aplicación.

## Verificación

`scripts/verify-acceptance.mjs` comprueba los criterios de la sección 6 y caza los
antipatrones del prompt 6 contra la aplicación corriendo. **Ninguna cifra esperada está
escrita a mano**: todas se derivan del JSON, de modo que si el dato cambia, el verificador
sigue siendo válido y es la interfaz la que tiene que seguirle el paso.

```bash
npm run build
npx next start -p 3100 &
npm i -D playwright --no-save     # sólo para verificar; no es dependencia del proyecto
npm run verify
```

Estado al último corte: **30/30**.

Entre lo que comprueba: que la unión deduplicada aparezca y la suma sólo tachada; que no
exista un porcentaje sin denominador en ninguna de las cinco rutas; que un delta negativo
con `down_is_good` se pinte **verde**; que las aplicaciones sin ruta sigan publicadas; que
la fecha de corte y el panel de reglas estén en las cinco pantallas; y que los ganchos de
la sección 7 sigan en el contrato.

## Paleta

Azul PepsiCo `#02355A` dominante, `#155798` y `#3680CE` de apoyo, fondo `#F5F4F0`. Sobria
y de alta densidad de información: está pensada para proyectarse en sala de juntas.

Los colores de las gráficas están validados como rampa monocroma: extremo claro por encima
del piso de 2:1 de contraste contra el fondo blanco de las tarjetas y separación de
luminosidad ≥ 0.06 en OKLCH entre pasos. Por eso el riel de volumen es `#93AFC9` y la
serie de referencia `#8496A8`, no los azules más pálidos de la paleta de interfaz.

## Despliegue

Vercel, preset Next.js, sin variables de entorno y sin secretos. `npm run build` produce
511 rutas estáticas.

**Tamaño, medido y no estimado.** El JSON pesa 692 KB en disco y **sí viaja al navegador**:
las tres pantallas interactivas (blast radius, calidad, AI Ops) recalculan uniones,
coberturas y ponderados en el cliente, y sin backend no hay dónde más hacerlo. El chunk que
lo contiene son 700 KB sin comprimir, **86 KB con gzip**, compartido por las rutas que lo
necesitan y cacheado tras la primera. Las páginas más pesadas (`/quality` y `/ai-ops`,
315 kB de First Load JS) lo son por Recharts, no por el dato.

Si el extracto creciera un orden de magnitud, la salida sería precomputar por pantalla en
`build_data.py` — no un backend, que sigue estando fuera del diseño de esta POC.
