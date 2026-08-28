# XOps Operational Graph · POC v1 — Handoff

Documento de continuidad. Pegar / abrir esto al inicio de una sesión nueva.

**Repo:** `Roar20/XOps-Operational-Graph`
**Rama de trabajo:** `claude/handoff-qn-data-setup-pi5neu`
**Último commit:** `c4c0058` — *Agrega HANDOFF.md con el estado de la POC y el alcance del corpus QN v2.4.2*

> Nota de rama: este documento nombraba `claude/xops-operational-graph-poc-2ycnay`
> como única rama autorizada. La sesión que escribió la paleta recibió instrucción
> explícita de desarrollar en `claude/handoff-qn-data-setup-pi5neu`, y ahí quedó.
> Las dos ramas existen; decidir cuál es la de verdad antes de seguir.

---

## 1. Qué es esto

Centro de mando operativo del portafolio de BI y AI/ML de PepsiCo. Responde tres
preguntas: **qué está roto, a quién golpea, y quién tiene que responder.**

Corte de datos declarado: **2026-08-21**.

### Contrato inviolable — no reabrir sin decisión explícita del usuario

| # | Regla |
|---|---|
| — | **La POC es estática por diseño.** No proponer base de datos, autenticación ni backend. |
| — | **No imputar datos faltantes ni filtrar registros incompletos** para que la interfaz se vea mejor. La cobertura parcial declarada es el argumento, no el defecto. |
| R1 | Nada se publica sin origen declarado |
| R2 | Toda derivación se marca como derivación (`technology_raw`, `criticality_raw` expuestos) |
| R3 | **Ninguna cifra sin denominador** (verificado automáticamente) |
| R4 | Blast radius se **deduplica por unión, nunca se suma** |
| R5 | Los tickets son eje de **costo**, nunca eje de riesgo |
| R6 | Lo no resuelto se declara, no se esconde |
| R7 | Un solo scorer canónico: **QN v2.4.2** |
| R8 | La elegibilidad es parte de la métrica |
| R9 | Línea base después del corte de práctica 2025Q3 |
| §7 | La app debe absorber `dashboards[]` y `audience` sin reconstruir pantallas |

**Git:** desarrollar, commitear y pushear **sólo** a `claude/xops-operational-graph-poc-2ycnay`.
No crear pull request salvo pedido explícito.

---

## 2. Estado verificado

- **46/46** aserciones de aceptación (`npm run verify`) — ninguna hardcodeada, todas derivadas del JSON
- **28** invariantes de build en `scripts/build_data.py` (el build falla si alguna rompe)
- typecheck limpio, **514** rutas estáticas (504 de `/app/[app_id]`)
- Paleta validada contra el piso de contraste 2:1 del skill `dataviz`

### Paleta PepsiCo · rampa completa (hecho)

La paleta pasó de cinco tonos sueltos a la rampa completa. Vive en tres lugares
que salen de los mismos hex: `tailwind.config.ts` (clases), `:root` de
`app/globals.css` (variables CSS, para SVG a mano, draw.io y exportables) y
`lib/palette.ts` (constantes TS).

> **Por qué `lib/palette.ts` y no las variables CSS en todo:** los atributos de
> presentación de SVG no resuelven `var()`. `fill="var(--pep-900)"` se pinta
> negro. Recharts escribe `fill` y `stroke` como atributos, así que todo lo que
> pinta desde JavaScript importa de `lib/palette.ts`.

Los 11 ratios de contraste que declara la especificación de paleta se
reprodujeron uno por uno contra `#FFFFFF` y contra `#F5F4F0`: **los 11 coinciden**.

Tres cosas se corrigieron al aplicarla, todas medidas:

| Qué | Antes | Ahora |
|---|---|---|
| `ink-800`, `ink-600`, `ink-50` usados en **53 lugares** pero nunca definidos en el config. Tailwind no generaba la clase, así que el color **no se aplicaba** | clase muerta | definidos (interpolados sobre las anclas vecinas) |
| Nodo con foco del grafo de vecindad: texto blanco fijo. Sobre el relleno de AG medía **2.56:1**, debajo del piso AA de 4.5 | 2.56:1 | `onFill()` elige por contraste medido → **6.46:1** |
| Sankey: relleno de hueco (`ink-400`) contra relleno de ruta separaban **ΔE 7.9** a visión normal. La distinción que el código quería hacer no se veía | ΔE 7.9 | `neutral`, el token que la paleta reserva para *sin dato* → **ΔE > 14** |

**Orden de series categóricas.** El que trae la especificación
(`pep-900 → acc-teal → pep-500 → acc-indigo → pep-300 → acc-cyan`) deja
`acc-indigo` adyacente a `pep-500`: ese par separa **ΔE 14.8** a visión normal,
debajo del piso duro de 15. `lib/palette.ts` publica las mismas seis tintas en
otro orden — `pep-900 → pep-500 → pep-300 → acc-teal → acc-cyan → acc-indigo` —
que sube el peor par adyacente a **ΔE 15.9** normal y **14.7** con deficiencia de
color. Además respeta lo que la propia especificación dice de los acentos: entran
cuando la gráfica pasa de tres series.

**Lo que no se resolvió, y por qué no se puede aquí:**

- `pep-900` queda fuera de la banda de luminosidad del validador y bajo el piso
  de croma, igual que `acc-teal` y `pep-300`. Son anclas de marca o derivados
  directos: cambiarlas es decisión del equipo de marca, no de la app.
- `pep-900` ↔ `pep-700` separan **ΔE 14.0**, apenas debajo de 15. Son las dos
  anclas azules oficiales. En el Sankey las separa además la posición y el rótulo.
- `warn` / `ev-e2` `#B26A00` mide **4.24:1** contra blanco, debajo de AA (4.5)
  para texto normal. Hay **5 usos como texto** a 10–11px (`text-ev-e2` en
  `Chips`, `ImpactChip`, `EvidenceBadge`, `Trace`). Los otros 24 usos son fondo
  o borde y no les aplica. Se dejó el hex tal como lo declara la especificación:
  oscurecerlo es cambio de paleta, no de código. Si se decide moverlo,
  `#9A5C00` mide **5.38:1** contra blanco y **4.89:1** contra el canvas, que es
  el primer paso del mismo tono que pasa AA contra los dos fondos.

### Comandos

```bash
npm run data        # python3 scripts/build_data.py — reproyecta el xlsx a JSON
npm run typecheck
npm run build
npm run verify      # 46 aserciones de aceptación
npm run dev
```

> Al reconstruir, **matar y relanzar** el server de Next: un server viejo sirve un build
> viejo y produce fallos fantasma en el verificador.

### Estructura

```
scripts/build_data.py         proyector único xlsx → JSON (28 invariantes)
scripts/verify-acceptance.mjs 46 aserciones Playwright
data/xops-operational-graph-data.json   (879 KB, se embarca al cliente ~86 KB gzip)
lib/palette.ts                paleta PepsiCo para el código que pinta SVG,
                              más contrast() y onFill() (elección de texto por
                              contraste medido, no por color fijo)
lib/data.ts                   toda la computación: computeBlast, computeGaps,
                              computeSankey, neighbourhood, computeSectorReach,
                              impactProfile, impactRouteCrossing, measureById/LIVE
types/index.ts                contrato de tipos
components/Trace.tsx          drawer de trazabilidad (fórmula, denominador, evidencia,
                              valor vivo vs. lo que la hoja afirma, divergencia visible)
components/Overview.tsx       capa de entrada de negocio (ruta `/`)
```

Rutas: `/` (Overview) · `/portfolio` · `/blast-radius` · `/quality` · `/ai-ops`
· `/graph` (Sankey + grafo) · `/sectors` · `/app/[app_id]`

**La interfaz está en inglés.** Este documento y el README están en español.

---

## 3. Modelo actual (capa semántica v3)

Fuente: `7773fc71-XOps_Operational_Graph_Semantic_Layer_v3.xlsx` (287 KB).

- 504 aplicaciones · 268 nombres de AG que colapsan en **265 claves canónicas**
- Normalizador de AG: `re.sub(r"[^A-Z0-9]", "", name.upper())`
- Join de calidad: **79 de 265** claves · **65.2%** de cobertura de incidentes
- 140 AGs en el catálogo de calidad (catálogo distinto, no anidado en el modelo)
- Instrumento: `QN v2.4.2 scorer · canonical` · cobertura de decálogo 23%
- Divergencia por banda (QN v2.4.2 vs. regla binaria de la hoja):
  Alta 84.5/88.5 · Media 63.2/44.3 · **Baja 40.7/3.1** ← los instrumentos no están calibrados
- `meta.incident_link.available = false` (no hay grano de incidente en esta capa)

### Deudas de datos publicadas (no corregidas — declaradas)

| ID | Qué |
|---|---|
| DQ1 | 268 nombres de AG → 265 claves (colapso por normalización) |
| DQ3 | La hoja escribe el mismo no-valor de tres formas (TBD / Por confirmar / not stated). Las tres se leen como *sin resolver* (30 apps). El gate `attributable` se deja **exactamente como la hoja lo declara**, y se muestra el desacuerdo (18 apps). |
| DQ4 | 73 apps traen IDs de servicio de ServiceNow en la columna de sector → **en cuarentena y publicadas**, no limpiadas |

### Hallazgos que la app expone

- Partición impacto × ruta: **100 / 0 / 212 / 192 = 504**. Las 192 aplicaciones sin ruta
  tampoco tienen impacto de negocio declarado → **el hueco de ruteo no se puede costear**.
- Sankey: la unidad es el **enlace plataforma–aplicación** (468 enlaces / 240 apps
  distintas / sobreconteo 228), declarado en pantalla, porque un Sankey suma por construcción y eso choca con R4.

### Discrepancias reportadas contra las cifras del spec (no reconciliadas en silencio)

| Métrica | Spec | Dato real |
|---|---|---|
| Teradata + SAP_BW | 43/51/8 | **47/56/9** |
| AGs Teradata | 31 | **33** |
| AGs Power BI | 42 | **46** |
| Join de calidad | 77 de 237 | **79 de 265** |
| Patrones | 150 | **200** |
| Meses / trimestres | 50 / 17 | **33 / 12** |
| Plataformas | 25 | **38** |

---

## 4. Workstream abierto: corpus QN v2.4.2 (segundo proyector)

### 🚫 BLOQUEO ACTUAL

Los dos archivos **no están en disco**. `data/` sólo contiene
`xops-operational-graph-data.json`. Reverificado en la sesión de la paleta: no
están en `data/`, ni en el working tree, ni en ningún otro punto del contenedor.
Aparecieron sólo pegados en un chat, y un chat nuevo no hereda esa conversación,
así que **hay que subirlos al repo desde una máquina que los tenga**. Nadie los
puede reconstruir desde aquí: son medición, no derivación, y el contrato del
proyecto prohíbe inventar columnas o conteos.

Antes de escribir una línea de código hay que colocar:

```
data/QN_v242_contract.json     (24 KB)   manifiesto medido contra el archivo real
data/QN_v242_aggregates.json   (911 KB)  9 hojas agregadas, 3,473 filas, dato real
```

**Leerlos antes de programar.** No inventar columnas ni conteos: si no está en el
contrato, no está en el archivo.

### El corpus

`QN_p120826_FULL_2_4_2_RO_270826.xlsx` — 103 MB, 12 hojas, **719,946** números de
incidente, cero duplicados. `sha256 = eee590e9…b08ea`. Corte del dato: **2026-08-12**.

- `User_Detail` 277,408 × 37 — el núcleo
- `Alert_Detail` 442,538 × 17 — el hallazgo operativo
- Las dos hojas de detalle **particionan el universo**: intersección cero (QN05)
- `User_By_Agent` 4,463 — **fuera del proyector** (decisión 4)

### Decisiones cerradas — no reabrir

1. Los dos corpus **conviven**. El cargado no reemplaza al publicado.
2. Cada métrica lleva **bandera de comparabilidad entre cortes**. Verde donde el
   instrumento no cambió; `Blocked` con la razón escrita donde cambió. La serie de
   decálogo va **Blocked**: v1 y v2 coinciden en el código primario en **6.5%** y
   D01 se mueve **+640.2%**.
3. **Agregados en build** (repo, verificados, con corte). **Detalle en runtime**
   (Web Worker + IndexedDB, índice por `Number` y por clave canónica de AG).
4. `User_By_Agent` queda **fuera del proyector**, no sólo sin publicar. Medir personal
   nominal del vendor exige decisión de RRHH y Legal *antes* de cargar el dato.
5. **MTTR va al registro de métricas en estado `Blocked`.** No existe `opened_at` en
   ninguna hoja (invariante QN13). **Nunca derivarlo de `Closed At`.**
6. El eslabón incidente → aplicación pasa por **Assignment Group**, no por Service
   Offering: SO empata con nombre de aplicación en **4.7%** de los tickets y con APM
   en **0%**. Es aproximación y se rotula como tal.
7. El join se mide sobre **clave canónica**, no sobre nombre crudo. En `User_Detail`
   987 nombres producen 987 claves: el colapso por normalización es cero, así que
   **22.6% de grupos** y **61.8% de volumen** ya están bien medidos.

### Condición añadida (acordada en la sesión anterior, parte del alcance de A)

Las ocho pantallas estampan `data cut-off` como afirmación respaldada por invariantes
que corren en build. Si alguien arrastra un archivo y la app renderiza lo que ese
archivo diga, el sello pasa a ser una afirmación sobre un archivo que nadie verificó.
Por eso **A es un portero, no un adorno**: el proyector de build emite el manifiesto,
y el cargador valida el archivo subido contra él **antes de publicar una sola cifra**.

### Qué construir, en este orden

**A. Validador de manifiesto.** Corre ANTES de publicar cualquier cifra. Compara el
archivo subido contra `data/QN_v242_contract.json`: hojas presentes, contrato de
columnas por hoja, y las **13 invariantes** (QN01–QN13). Si algo no cuadra, la app
declara *"corpus sin verificar"* y **se niega a estampar la fecha de corte**. Reporte
legible: qué hoja, qué columna, cuántas filas se descartaron y por qué.

**B. Proyector de agregados en build.** Consume `data/QN_v242_aggregates.json` y lo
integra al contrato de `types/index.ts`. **Extender el tipo, no reemplazarlo.**

**C. Ingesta de detalle en runtime.** Web Worker con progreso visible, SheetJS,
escritura a IndexedDB. **Nada de 719,946 filas en estado de React.**

**D. Ficha de ticket en `/ticket/[number]`**, tres bloques:
- identidad y calidad, desde este corpus, evidencia alta
- contexto de negocio (aplicación, proceso, sector, DPM, impacto), derivado por
  Assignment Group desde la capa semántica, **rotulado como derivado**
- lo que **no** se puede responder para ESE ticket: tiempo de resolución *siempre*,
  y aplicación confirmada cuando el AG no une al modelo

Respetar **R3** en todo. **No rehacer el proyector de la capa semántica**, que sigue
vigente: esto es un segundo proyector que convive con él.

### Métricas bloqueadas del corpus QN

| ID | Razón |
|---|---|
| `MTTR` | No hay `opened_at`. Sólo `Closed At`. Publicar como Blocked; nunca derivar de `Closed At` menos el corte. |
| `REASSIGNMENT` | No hay conteo de reasignación ni de transferencia. El ping-pong L1/L2 no es medible. |
| `INCIDENT_TO_APPLICATION` | Service Offering empata 4.7% / 0%. El enlace va por AG y es aproximación rotulada. |

### Comparabilidad entre cortes

**Seguras:** distribución de Label · `compliance_class` / tasa diagnóstica ·
Ops Classification · tasa Auto-Resolved · volumen por Assignment Group ·
tasa de población de Close-Notes.

**Bloqueada:** serie de decálogo (v1 vs v2 — ver decisión 2).

### Hallazgos operativos del corpus (a verificar contra el contrato al construir)

- Volumen creciente: 2024 **207,725** → 2025 **302,396** → 2026 parcial a 08-12 **193,968**
- 61.5% del universo son alertas · **62,046** *Activity Without Documentation*
- `Host name.....peplap05531` aparece **18,690** veces; top diez ≈ 103,000 (23% del corpus)
  → si se confirma, es un monitor mal configurado, no un problema de documentación
- El KPI de cumplimiento está saturado: **96.1% / 98.0% contra objetivo de 30%** →
  retirarlo a favor del eje diagnóstico en **25.7%** (`Dual_Axis`: 50.7% de los
  incidentes *Poor* son `FORMAL_ONLY`)

---

## 5. Seguimientos pendientes (ofrecidos, sin cerrar)

- Conseguir un extracto a grano de incidente para encender `IncidentRow` en la capa
  semántica *(parcialmente resuelto por el corpus QN)*
- Arreglar **DQ4** en el inventario de origen (IDs de ServiceNow en la columna de sector)
- Reconciliar las discrepancias spec-vs-dato con quien produjo las cifras originales
