import Link from "next/link";
import { notFound } from "next/navigation";
import {
  applications, getApp, meta, agsOf, platformsOf, qualityOfAgs,
  multiAgApps, maxAgCount, UNIVERSE, quality, isTbd, computeGaps,
} from "@/lib/data";
import { AiTag, ApproxTag, CriticalityChip, GateChips, NotRoutableTag, SupportLoad, TbdValue } from "@/components/Chips";
import { InlineMetric, Metric } from "@/components/Metric";
import { Note, SectionHeader, TableCaption } from "@/components/SectionHeader";
import { EvidenceBadge } from "@/components/EvidenceBadge";

/** Los huecos se recalculan del dato; ninguna cifra de esta pantalla esta escrita a mano. */
const GAPS = computeGaps();

export function generateStaticParams() {
  return applications.map((a) => ({ app_id: a.app_id }));
}

export async function generateMetadata({ params }: { params: Promise<{ app_id: string }> }) {
  const { app_id } = await params;
  const app = getApp(app_id);
  return { title: app ? `${app.name} · XOps Operational Graph` : "Aplicación no encontrada" };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{children}</dd>
      {hint ? <p className="subtle mt-0.5">{hint}</p> : null}
    </div>
  );
}

/** Los campos del inventario que llegan vacios se muestran vacios, no se rellenan. */
function Raw({ value }: { value: string | null | undefined }) {
  if (!value || !value.trim()) return <span className="subtle italic">sin capturar</span>;
  return <span>{value}</span>;
}

export default async function AppResolverPage({ params }: { params: Promise<{ app_id: string }> }) {
  const { app_id } = await params;
  const app = getApp(app_id);
  if (!app) notFound();

  const ags = agsOf(app);
  const plats = platformsOf(app);
  const q = qualityOfAgs(app.ags);
  const sectors = app.sector.split(",").map((s) => s.trim()).filter(Boolean);
  const agSourceLabel = app.ag_source_kind === "bridge"
    ? "puente Aplicación → Assignment Group (lista completa)"
    : app.ag_source_kind === "inventory"
      ? "columna Assignment Group del inventario (tope de 10 entradas)"
      : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="subtle hover:text-pep-900">← Portfolio Health</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-pep-900">{app.name}</h1>
          {app.is_ai_ml ? <AiTag /> : null}
          <CriticalityChip value={app.criticality} withLabel />
          {app.ags.length === 0 ? <NotRoutableTag /> : null}
        </div>
        <p className="num subtle mt-1">{app.apm} · {app.app_id} · {app.scope_status || "sin scope status"}</p>
      </div>

      {/* ---------------- 1 identidad · 2 atribucion · 3 propiedad ---------------- */}
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad">
          <SectionHeader title="Identidad" kicker="Bloque 1" />
          <dl className="space-y-3">
            <Field label="Nombre">{app.name}</Field>
            <Field label="APM"><span className="num">{app.apm}</span></Field>
            <Field label="Categoría"><Raw value={app.category} /></Field>
            <Field label="Scope status"><Raw value={app.scope_status} /></Field>
            <Field label="Programa"><Raw value={app.program} /></Field>
            <Field label="Arquetipo"><Raw value={app.archetype} /></Field>
            <Field label="Segmento AI/ML">{app.is_ai_ml ? "Sí" : "No"}</Field>
          </dl>
        </section>

        <section className="card card-pad">
          <SectionHeader title="Atribución" kicker="Bloque 2" />
          <dl className="space-y-3">
            <Field label="Proceso de negocio"><TbdValue value={app.process} /></Field>
            <Field label="Sector">
              {sectors.length === 0 ? <TbdValue value={null} /> : (
                <span className="flex flex-wrap gap-1">
                  {sectors.map((s) => (
                    <span key={s} className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[11px]">{s}</span>
                  ))}
                </span>
              )}
            </Field>
            <Field label="Criticidad normalizada"><CriticalityChip value={app.criticality} withLabel /></Field>
            {/* R9 · la normalizacion no borra el vocabulario de origen: los dos siguen en circulacion. */}
            <Field
              label="Criticidad de origen (criticality_raw)"
              hint="Los vocabularios BC1–BC3 y RP1–RP3 siguen en circulación; la normalización a C1–C3 es derivada."
            >
              {app.criticality_raw?.trim()
                ? <span className="num rounded border border-ink-300 bg-ink-50 px-1.5 py-0.5 text-xs">{app.criticality_raw}</span>
                : <TbdValue value={null} />}
            </Field>
            <Field label="Peso de criticidad" hint={meta.criticality_scale[app.criticality] ?? undefined}>
              <span className="num">{app.criticality_weight}</span>
            </Field>
            <Field label="Compuertas"><GateChips gates={app.gates} /></Field>
          </dl>
        </section>

        <section className="card card-pad">
          <SectionHeader title="Propiedad" kicker="Bloque 3" />
          <dl className="space-y-3">
            <Field label="DPM"><TbdValue value={app.dpm} /></Field>
            <Field label="DPM L3"><TbdValue value={app.dpm_l3} /></Field>
            <Field label="Owner"><TbdValue value={app.owner} /></Field>
            <Field label="Tech lead"><TbdValue value={app.tech_lead} /></Field>
            <Field label="Service tier"><Raw value={app.service_tier} /></Field>
            <Field label="Ventana de soporte"><Raw value={app.support_window} /></Field>
            {/* R3 · los tickets son eje de costo, jamas eje de riesgo: un solo color. */}
            <Field label="Carga de soporte (tickets 2024)" hint="Eje de costo. No es señal de riesgo y no se colorea como tal.">
              {app.tickets_2024 === null
                ? <TbdValue value={null} />
                : <SupportLoad value={app.tickets_2024} showLabel />}
            </Field>
            <Field label="Reportes declarados">
              {app.declared_reports === null ? <TbdValue value={null} /> : <span className="num">{app.declared_reports}</span>}
            </Field>
          </dl>
        </section>
      </div>

      {/* ---------------- plataformas: derivacion visible ---------------- */}
      <section className="card card-pad">
        <SectionHeader
          kicker={`${plats.length} plataforma${plats.length === 1 ? "" : "s"}`}
          title="Plataformas sobre las que corre"
        >
          {app.platform_evidence_tier ? <EvidenceBadge tier={app.platform_evidence_tier} showAuthority /> : null}
        </SectionHeader>

        {plats.length === 0 ? (
          <Note tone="warn">
            Sin plataforma identificada. El eslabón Plataforma → Aplicación no está resuelto para esta
            aplicación, por lo tanto no aparece en ningún blast radius. Se queda en la lista y cuenta en el
            hueco: <InlineMetric resolved={GAPS.withoutPlatform} universe={GAPS.universe} /> de las aplicaciones
            están en la misma situación.
          </Note>
        ) : (
          <>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {plats.map((p) => (
                <li key={p.platform_id} className="rounded border border-ink-200 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/blast-radius?p=${encodeURIComponent(p.name)}`} className="text-sm font-medium text-pep-700 hover:underline">
                      {p.name}
                    </Link>
                    {p.is_ai_platform ? <AiTag /> : null}
                    {p.is_legacy ? <span className="rounded border border-ink-300 bg-ink-50 px-1 py-0.5 text-[10px] text-ink-500">legacy</span> : null}
                  </div>
                  <div className="subtle num">
                    tier {p.tier} · {p.blast_radius_direct} apps directas · {p.routable_pct.toFixed(1)}% ruteables
                  </div>
                </li>
              ))}
            </ul>

            {/* R9 · la derivacion no se disfraza de dato. */}
            <div className="mt-3 rounded-md border border-ink-200 bg-ink-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="label">Origen de la clasificación</span>
                {app.platform_evidence_tier ? <EvidenceBadge tier={app.platform_evidence_tier} /> : null}
                <span className="text-xs text-ink-700">
                  {app.platform_evidence_tier ? meta.link_sources.platform[app.platform_evidence_tier] : null}
                </span>
              </div>
              {app.platform_evidence_tier === "E3" ? (
                <p className="mt-1 text-xs text-ink-600">
                  Esta asignación se derivó normalizando texto libre. No tiene la misma autoridad que las
                  plataformas provenientes del análisis de Tech Buckets (E2). La cadena original se conserva abajo.
                </p>
              ) : (
                <p className="mt-1 text-xs text-ink-600">
                  Proviene del análisis de Tech Buckets, no de normalización de texto libre.
                </p>
              )}
              {app.technology_raw ? (
                <>
                  <div className="label mt-2">technology_raw · cadena original sin transformar</div>
                  <pre className="num mt-1 overflow-x-auto whitespace-pre-wrap rounded border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-800">{app.technology_raw}</pre>
                </>
              ) : (
                <p className="subtle mt-2">Sin <span className="num">technology_raw</span>: el inventario no capturó Technology Stack para esta aplicación.</p>
              )}
            </div>
          </>
        )}
      </section>

      {/* ---------------- 4 operacion · el punto de la pantalla ---------------- */}
      <section className="card card-pad">
        <SectionHeader
          kicker={`Bloque 4 · ${ags.length} assignment group${ags.length === 1 ? "" : "s"}`}
          title="Operación — todos los Assignment Groups"
        >
          {app.ag_evidence_tier ? <EvidenceBadge tier={app.ag_evidence_tier} showAuthority /> : null}
        </SectionHeader>

        <Note tone={ags.length === 0 ? "warn" : "neutral"}>
          {ags.length === 0 ? (
            <>
              Esta aplicación <strong>no tiene Assignment Group declarado</strong>. Un incidente sobre ella no
              encuentra destino. Se conserva en el inventario y cuenta en el hueco de ruteo:{" "}
              <InlineMetric resolved={GAPS.withoutAg} universe={GAPS.universe} /> de las aplicaciones están en la
              misma situación.
            </>
          ) : (
            <>
              La aplicación por sí sola <strong>no determina el destino del ticket</strong>. Corre sobre{" "}
              <span className="num font-semibold">{ags.length}</span> grupo{ags.length === 1 ? "" : "s"} de asignación
              y se listan <strong>todos</strong>, sin elegir uno como “el” responsable: para resolver el destino se
              requiere un discriminador adicional (subservicio, síntoma o CI), que no está en este modelo.
              En el portafolio, <InlineMetric resolved={multiAgApps} universe={UNIVERSE} /> tienen más de uno y una
              llega a <span className="num font-semibold">{maxAgCount}</span>.
            </>
          )}
        </Note>

        {ags.length > 0 ? (
          <>
            <div className="mt-3 scroll-thin overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-ink-200 bg-ink-50">
                  <tr>
                    <th className="th w-8">#</th>
                    <th className="th">Assignment Group</th>
                    <th className="th">Clave</th>
                    <th className="th text-right">Apps del grupo</th>
                    <th className="th">Procesos que cubre</th>
                    <th className="th">DPMs</th>
                    <th className="th">Corpus de calidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {ags.map((g, i) => (
                    <tr key={g.ag_id} className="row-hover align-top">
                      <td className="num td text-ink-400">{i + 1}</td>
                      <td className="td font-medium">{g.name}</td>
                      <td className="num td text-xs text-ink-500">{g.ag_key}</td>
                      <td className="num td text-right">{g.app_count}</td>
                      <td className="td max-w-[260px] text-xs text-ink-600">
                        {g.processes.length ? g.processes.join(", ") : <TbdValue value={null} />}
                      </td>
                      <td className="td max-w-[200px] text-xs text-ink-600">
                        {g.dpms.length ? g.dpms.join(", ") : <TbdValue value={null} />}
                      </td>
                      <td className="td text-xs">
                        {g.has_quality
                          ? <span className="text-good">medido</span>
                          : <span className="text-ink-400">sin corpus elegible</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {agSourceLabel ? (
              <p className="subtle mt-2">
                Lista tomada de: {agSourceLabel}. {app.ag_evidence_tier ? meta.link_sources.assignment_group[app.ag_evidence_tier] : null}
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      {/* ---------------- calidad: aproximacion declarada, nunca atribuida a la app ---------------- */}
      {ags.length > 0 ? (
        <section className="card card-pad">
          <SectionHeader kicker="Calidad de work notes" title="Calidad de los grupos que atienden esta aplicación">
            <ApproxTag>se mide por AG, no por aplicación</ApproxTag>
          </SectionHeader>

          <Note tone="warn">
            Estas cifras describen a los <strong>grupos</strong>, no a esta aplicación. Un AG atiende muchas
            aplicaciones, así que su tasa diagnóstica no es atribuible a ninguna en particular. Además solo se
            miden los grupos con corpus elegible:{" "}
            <InlineMetric resolved={q.measured} universe={q.total} /> de los AGs de esta aplicación tienen medición,
            y en todo el modelo solo{" "}
            <InlineMetric resolved={quality.meta.join_coverage.ags_matched} universe={quality.meta.join_coverage.ags_bridge} />{" "}
            de las claves de grupo se pudieron unir al corpus.
          </Note>

          {q.measured === 0 ? (
            <p className="mt-3 text-sm text-ink-600">
              Ninguno de los {q.total} grupos de esta aplicación alcanza el umbral de elegibilidad
              ({quality.meta.eligibility_rule}). No hay medición que mostrar y no se sustituye por un promedio del portafolio.
            </p>
          ) : (
            <>
              <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Metric compact label="AGs con medición" resolved={q.measured} universe={q.total} unitLabel="de los AGs de esta app" />
                <div>
                  <div className="label">Tasa diagnóstica ponderada</div>
                  <div className="num text-lg font-semibold text-pep-900">{q.diagnostic_rate?.toFixed(1)}%</div>
                  <div className="subtle num mt-0.5">sobre {q.incidents.toLocaleString("es-MX")} incidentes de esos AGs</div>
                </div>
                <div>
                  <div className="label">Con causa raíz</div>
                  <div className="num text-lg font-semibold text-pep-900">{q.has_root_rate?.toFixed(1)}%</div>
                  <div className="subtle num mt-0.5">sobre {q.incidents.toLocaleString("es-MX")} incidentes</div>
                </div>
                <div>
                  <div className="label">Documentación pobre</div>
                  <div className="num text-lg font-semibold text-pep-900">{q.poor_rate?.toFixed(1)}%</div>
                  <div className="subtle num mt-0.5">sobre {q.incidents.toLocaleString("es-MX")} incidentes</div>
                </div>
              </div>

              <div className="mt-3 scroll-thin overflow-x-auto">
                <table className="w-full border-collapse">
                  <TableCaption>
                    Cada tasa se calcula sobre la columna <span className="num">Incidentes</span> de su fila, que
                    son los incidentes de ese grupo — no los de esta aplicación.
                  </TableCaption>
                  <thead className="border-b border-ink-200 bg-ink-50">
                    <tr>
                      <th className="th">Grupo medido</th>
                      <th className="th text-right">Incidentes</th>
                      <th className="th text-right">Tasa diagnóstica</th>
                      <th className="th text-right">Con causa raíz</th>
                      <th className="th text-right">Score QN v2.4.2</th>
                      <th className="th text-right">Doc. pobre</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {q.rows.map((r) => (
                      <tr key={r.ag_key} className="row-hover">
                        <td className="td font-medium">{r.name}</td>
                        <td className="num td text-right">{r.incidents.toLocaleString("es-MX")}</td>
                        <td className="num td text-right">{r.diagnostic_rate.toFixed(1)}%</td>
                        <td className="num td text-right">{r.has_root_rate.toFixed(1)}%</td>
                        <td className="num td text-right">{r.avg_score.toFixed(2)}</td>
                        <td className="num td text-right">{r.poor_rate.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : null}

      {/* ---------------- lo que esta ficha no puede responder ---------------- */}
      <section className="card card-pad">
        <SectionHeader kicker="Límite declarado" title="Lo que esta ficha no responde" />
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
          <li>
            <strong>Cuántos usuarios dependen de esta aplicación.</strong> El eslabón Aplicación → Audiencia
            no está capturado en v1. Es decisión de alcance, no descuido.
          </li>
          <li>
            <strong>Qué dashboards se caen con ella.</strong> El eslabón Dashboard → Aplicación tiene{" "}
            <InlineMetric resolved={meta.dashboard_link.confirmed} universe={meta.dashboard_link.workspaces} />{" "}
            workspaces confirmados. Queda fuera de v1.
          </li>
          <li>
            <strong>A qué grupo va un ticket concreto.</strong> Se listan todos los AGs porque el modelo no
            contiene el discriminador que elige entre ellos.
          </li>
          {isTbd(app.dpm) ? (
            <li>
              <strong>Quién responde a nivel DPM.</strong> El DPM de esta aplicación está en TBD y no se imputa
              desde el DPM L3 ni desde el owner.
            </li>
          ) : null}
        </ul>
        <p className="subtle mt-3">Corte de datos {meta.as_of}. Fuente: {meta.source_file}.</p>
      </section>
    </div>
  );
}
