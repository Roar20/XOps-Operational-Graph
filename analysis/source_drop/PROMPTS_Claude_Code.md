# Prompts para Claude Code · XOps Operational Graph POC

Se pegan en orden. Cada prompt asume que el anterior terminó y compiló. No avances si el anterior no pasó su verificación.

**Antes de empezar**, crea la carpeta del proyecto y copia dentro:
- `SPEC_XOps_Operational_Graph_POC.md`
- `xops-operational-graph-data.json`

---

## Prompt 0 · Arranque y contrato

```
Voy a construir una aplicación web llamada XOps Operational Graph.

Lee SPEC_XOps_Operational_Graph_POC.md completo antes de escribir cualquier código. Ese documento
es el contrato: sus reglas R1 a R8 y sus 12 criterios de aceptación no son sugerencias, son
requisitos verificables.

Los datos son siete archivos JSON independientes en /data. Inspecciónalos con jq o un script
corto, sin volcarlos completos a contexto. Los catálogos y aristas suman 361 KB y el archivo de
incidentes son 104 KB aparte.

Cuando termines, dime en no más de quince líneas:
1. Qué entendiste que hace la aplicación y qué explícitamente no hace.
2. Las tres reglas del contrato que más riesgo tienen de violarse por descuido al programar.
3. Por qué los catálogos y los incidentes están en archivos separados.

No escribas código todavía.
```

**Verifica:** que mencione que el blast radius se calcula por unión deduplicada y no por suma, que ninguna cifra va sin denominador, y que el color del delta responde a `direccion_deseada` y no al signo. Si no menciona esas tres, corrige antes de continuar.

---

## Prompt 1 · Andamio y componentes base

```
Crea el proyecto: Next.js con App Router, TypeScript y Tailwind. Sin backend, sin base de datos,
sin autenticación. El JSON va en /data y se importa estáticamente.

Construye en este orden:

1. Tipos TypeScript derivados del JSON, en /types. Que el compilador falle si el JSON cambia de
   forma, no en runtime.

2. Una capa de acceso a datos en /lib/data.ts que carga los catálogos y las aristas, y calcula
   los agregados al arrancar: conteos por plataforma y por grupo, compuertas por aplicación,
   peso de criticidad, y unión deduplicada dado un conjunto de plataformas. Los archivos NO
   traen agregados guardados, por diseño: un agregado en el archivo se desincroniza en silencio.

   incidents_quality.json se carga aparte y solo en la ruta /quality. Si falta o falla, las
   otras cuatro pantallas deben seguir funcionando y la app lo declara en lugar de romperse.
   Toda la lógica de cómputo vive en esta capa, nunca en los componentes.

3. Tres componentes reutilizables:
   - <Metric resolved universe label /> que siempre renderiza "165 de 504 · 32.7%". No debe
     existir manera de renderizar el porcentaje sin el denominador.
   - <EvidenceBadge tier="E1|E2|E3" /> discreto y consistente.
   - <Delta value direction="up_is_good|down_is_good" /> que colorea por dirección deseada.

4. El shell: navegación entre las cuatro rutas, la fecha de corte 2026-08-21 siempre visible,
   y un panel "Cómo leer esto" accesible desde cualquier pantalla que muestre meta.rules y
   meta.evidence_tiers.

Estética: sobria, ejecutiva, densidad de información alta. Paleta PepsiCo: azul #02355A como
dominante, #155798 y #3680CE de apoyo, fondo #F5F4F0. Nada de degradados ni tarjetas
decorativas. Esto se va a proyectar en una sala de juntas.

Aún no construyas las pantallas.
```

**Verifica:** `npm run build` sin errores, y que `<Metric>` no acepte un porcentaje suelto.

---

## Prompt 2 · Portfolio Health

```
Construye la ruta / según la sección 5.1 de la spec.

Encabezado con los cuatro eslabones de coverage[], cada uno con barra, resuelto sobre universo,
porcentaje, owner del desbloqueo y su EvidenceBadge.

Tabla de las 504 aplicaciones con filtros combinables por proceso, sector, criticidad, scope
status, plataforma y estado de compuerta. Columnas: nombre, APM, proceso, sector, criticidad,
DPM, número de plataformas, número de AGs, y tres chips de compuerta.

Panel fijo "Hueco declarado" con las aplicaciones sin AG, sin DPM confirmado y sin atribución
completa. Calcula esos tres números desde los datos. No los escribas a mano: si el JSON cambia,
deben cambiar solos.

Restricciones que no puedes violar:
- Una aplicación sin AG aparece en la lista con etiqueta "No ruteable". No se filtra fuera.
- Un DPM con valor TBD se muestra como TBD, nunca en blanco ni como guion.
- 324 de 504 aplicaciones no tienen criticidad declarada. Esas se muestran como "No declarada",
  no se imputan ni se ocultan.

La tabla debe seguir siendo usable con 504 filas: virtualización o paginación, búsqueda por
nombre y por APM.
```

**Verifica:** que el panel de hueco muestre 192 sin AG, 121 sin DPM confirmado, 131 sin atribución completa y 264 sin plataforma. Si no coinciden, el cálculo está mal.

---

## Prompt 3 · Blast Radius

```
Construye la ruta /blast-radius según la sección 5.2 de la spec.

Selector multi-plataforma sobre las 25 plataformas. Al seleccionar una o más, muestra:

- Aplicaciones afectadas por UNIÓN DEDUPLICADA de app_ids. Nunca suma de blast_radius_direct.
  Cuando hay más de una plataforma seleccionada, indica cuántas aplicaciones se traslapan.
- Procesos de negocio afectados con el número de aplicaciones por proceso. Este es el elemento
  central de la pantalla, dale el peso visual correspondiente.
- Sectores alcanzados.
- Mezcla de criticidad y blast radius ponderado (suma de criticality_weight), presentados junto
  al conteo simple para que se vea la diferencia entre contar y ponderar.
- Ruta de respuesta: Assignment Groups a involucrar y DPMs a notificar, con routable_pct visible.
- Sección separada "Sin ruta de respuesta declarada" con las aplicaciones afectadas que no
  tienen AG.
- Calidad de documentación de los AGs alcanzados, usando quality_ag_keys de la plataforma y
  quality.by_assignment_group. Declara que solo 77 de 237 AGs tienen calidad medida.

Prueba obligatoria: seleccionar TERADATA y SAP_BW juntas debe dar 43 aplicaciones, no 51, e
indicar que 8 se traslapan. Si tu implementación da 51, está sumando en lugar de unir.
```

**Verifica:** Teradata sola da 30 aplicaciones, 6 procesos y 33 AGs. Power BI da 129 aplicaciones y 46 AGs, que es la plataforma de mayor radio del portafolio.

---

## Prompt 4 · Application Resolver

```
Construye la ruta /app/[app_id] según la sección 5.3 de la spec.

Ficha con cuatro bloques: identidad, atribución, propiedad y operación.

En atribución muestra la criticidad normalizada C1/C2/C3 junto a criticality_raw, porque hay dos
vocabularios en circulación (BC1/BC2/BC3 y RP1/RP2/RP3) y el original importa para trazabilidad.

En operación lista TODOS los Assignment Groups de la aplicación, no uno. 113 aplicaciones tienen
más de uno y una llega a 14. Incluye texto explícito de que la aplicación por sí sola no
determina el destino del ticket y que se requiere un discriminador adicional.

Si la aplicación tiene AGs con calidad medida, muestra sus indicadores y etiqueta claramente que
la calidad se mide por grupo y no por aplicación, es decir que es una aproximación.

Agrega buscador global por nombre y APM accesible desde cualquier pantalla, con navegación por
teclado.
```

**Verifica:** abrir AISP AZURE KUBERNETES SERVICE debe listar sus 14 Assignment Groups. Una aplicación con `technology_raw` debe mostrar la cadena original junto a las plataformas derivadas.

---

## Prompt 5 · Work Notes Quality

```
Construye la ruta /quality según la sección 5.4 de la spec, usando el bloque quality del JSON.

Selector de granularidad semana, mes, trimestre y año que conmuta entre las cuatro series de
quality.timeseries sin recargar la página. Son 138 semanas, 50 meses, 17 trimestres y 4 años.

Gráfica de líneas con las tasas y una serie de volumen como referencia secundaria. Usa Recharts.

Panel de línea base contra actual: cada métrica con su valor base, su valor actual, el delta en
puntos porcentuales y el componente <Delta> coloreado por dirección deseada. poor_critical_rate
y reopen_rate mejoran a la baja.

Ranking de los 140 Assignment Groups, ordenable por cualquier indicador.

Tabla de los 150 patrones recurrentes. Marca como "candidato a SOP" los que combinan volumen
alto con tasa diagnóstica baja, y explica el criterio en pantalla.

Distribución de Decálogo con su cobertura de 23.0% visible como denominador.

Obligatorio en esta pantalla: la regla de elegibilidad y el corpus de 242,706 sobre 277,408
aparecen junto a toda cifra de calidad, y la advertencia de instrumento único de
quality.meta.instrument_warning es accesible. Dos scorers distintos producirían un delta que es
artefacto del instrumento.
```

**Verifica:** el delta de tasa diagnóstica muestra +16.8 pp en verde y el de documentación deficiente muestra −8.5 pp también en verde.

---

## Prompt 5b · AI Ops

```
Construye la ruta /ai-ops según la sección 5.5 de la spec.

Vista filtrada sobre las 142 aplicaciones con is_ai_ml verdadero. Reutiliza los componentes de
las otras pantallas, no construyas un modelo aparte.

El elemento central es el comparativo de cobertura del segmento AI/ML contra el portafolio
completo en los cuatro eslabones. De 142 aplicaciones AI/ML solo 52 son ruteables, 81 tienen
DPM y 32 tienen plataforma identificada. Esa brecha es el mensaje de la pantalla, no un defecto
que haya que suavizar.

Incluye la pila tecnológica del segmento derivada de platforms y ai_platforms, y la lista de
aplicaciones AI/ML sin ruta declarada.
```

**Verifica:** el comparativo muestra que la cobertura de ruteo AI/ML es menor que la del portafolio completo.

---

## Prompt 6 · Auditoría contra el contrato

```
Audita la aplicación completa contra los criterios de aceptación de la sección 6 de la spec.

Para cada criterio dime: cumple o no cumple, y dónde está la evidencia en el código. No aceptes
un criterio como cumplido porque "debería" funcionar: verifícalo.

Después busca específicamente estos antipatrones y corrígelos donde aparezcan:
- Cualquier porcentaje renderizado sin su denominador.
- Cualquier suma de conteos entre plataformas.
- Cualquier color de delta que dependa del signo en lugar de la dirección deseada.
- Cualquier registro filtrado fuera de una lista por tener el dato faltante.
- Números escritos a mano que deberían calcularse desde los archivos.
- Agregados guardados en estado que deberían recalcularse desde las aristas.
- Plataformas derivadas de texto libre presentadas con la misma autoridad que las del análisis de Tech Buckets.

Entrégame la lista de hallazgos antes de corregir.
```

---

## Prompt 7 · Despliegue

```
Prepara el despliegue a Vercel.

Build estático, sin variables de entorno ni secretos. Agrega un README corto con el origen de
los datos, la fecha de corte, y una nota de que es una prueba de concepto con cobertura parcial
declarada.

Verifica que la carga inicial solo traiga catálogos y aristas (361 KB) y que el archivo de
incidentes se cargue únicamente al entrar a /quality.
```

---

## Notas de uso

Si Claude Code propone agregar una base de datos, autenticación, o un backend, dile que no. La POC es estática por diseño y esa decisión es lo que la hace desplegable en una sesión.

Si propone imputar los datos faltantes o filtrar los registros incompletos para que la interfaz se vea mejor, eso viola el contrato. La cobertura parcial declarada es el argumento, no el defecto.

Cuando cierres los 30 workspaces de consumo entran dos archivos más, `catalog_dashboards.json` y `edges_dashboard_app.json`. La spec pide que la aplicación los absorba sin rehacer las pantallas, así que verifica esa condición en el prompt 6.
