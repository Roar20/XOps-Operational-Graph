import Link from "next/link";
import { notFound } from "next/navigation";
import { applications, appById, meta, agById, platformById } from "@/lib/data";
import { multiAgCount, maxAgCount, UNIVERSE } from "@/lib/selectors";
import { AiTag, CriticalityChip, GateChips, NotRoutableTag, SupportLoad, TbdValue } from "@/components/Chips";
import { InlineMetric } from "@/components/Metric";
import { ReadingNote, SectionHeader } from "@/components/SectionHeader";
import { EvidenceBadge } from "@/components/EvidenceBadge";

export function generateStaticParams() {
  return applications.map((a) => ({ app_id: a.app_id }));
}

export async function generateMetadata({ params }: { params: Promise<{ app_id: string }> }) {
  const { app_id } = await params;
  const app = appById.get(app_id);
  return { title: app ? `${app.name} · XOps Operational Graph` : "Aplicacion no encontrada" };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{children}</dd>
    </div>
  );
}

export default async function AppResolverPage({ params }: { params: Promise<{ app_id: string }> }) {
  const { app_id } = await params;
  const app = appById.get(app_id);
  if (!app) notFound();

  const ags = app.ags.map((id) => agById.get(id)).filter(Boolean);
  const plats = app.platforms.map((id) => platformById.get(id)).filter(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="subtle hover:text-ink-900">← Portfolio Health</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{app.name}</h1>
          {app.is_ai_ml ? <AiTag /> : null}
          <CriticalityChip value={app.criticality} withLabel />
          {app.ags.length === 0 ? <NotRoutableTag /> : null}
        </div>
        <p className="num subtle mt-1">{app.apm} · {app.app_id}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card card-pad">
          <SectionHeader title="Identidad" />
          <dl className="space-y-3">
            <Field label="Nombre">{app.name}</Field>
            <Field label="APM"><span className="num">{app.apm}</span></Field>
            <Field label="Categoria"><TbdValue value={app.category} /></Field>
            <Field label="Scope status"><TbdValue value={app.scope_status} /></Field>
            <Field label="En inventario">{app.in_inventory ? "Si" : "No"}</Field>
            <Field label="En alcance de plataforma">{app.in_platform_scope ? "Si" : "No"}</Field>
          </dl>
        </section>

        <section className="card card-pad">
          <SectionHeader title="Atribucion" />
          <dl className="space-y-3">
            <Field label="Proceso"><TbdValue value={app.process} /> <EvidenceBadge tier="E3" /></Field>
            <Field label="Sector"><TbdValue value={app.sector} /></Field>
            <Field label="Criticidad normalizada"><CriticalityChip value={app.criticality} withLabel /></Field>
            {/* Los dos vocabularios BC/RP siguen en circulacion: el original se conserva. */}
            <Field label="Criticidad de origen (criticality_raw)">
              {app.criticality_raw?.trim()
                ? <span className="num rounded border border-ink-300 bg-ink-50 px-1.5 py-0.5 text-xs">{app.criticality_raw}</span>
                : <TbdValue value={null} />}
              <span className="subtle ml-2">vocabularios BC1–BC3 y RP1–RP3</span>
            </Field>
            <Field label="Peso de criticidad"><span className="num">{app.criticality_weight}</span></Field>
            <Field label="Compuertas"><GateChips gates={app.gates} /></Field>
          </dl>
        </section>

        <section className="card card-pad">
          <SectionHeader title="Propiedad" />
          <dl className="space-y-3">
            <Field label="DPM"><TbdValue value={app.dpm} /></Field>
            <Field label="DPM L3"><TbdValue value={app.dpm_l3} /></Field>
            <Field label="Owner"><TbdValue value={app.owner} /></Field>
            <Field label="Tech lead"><TbdValue value={app.tech_lead} /></Field>
            {/* R3: carga de soporte, nunca senal de riesgo. */}
            <Field label="Carga de soporte (tickets_year)">
              <SupportLoad value={app.tickets_year} showLabel={false} />
              <span className="subtle ml-2">eje de costo, no de riesgo</span>
            </Field>
          </dl>
        </section>
      </div>

      <section className="card card-pad">
        <SectionHeader kicker={`${plats.length} plataforma${plats.length === 1 ? "" : "s"}`} title="Plataformas sobre las que corre" />
        {plats.length === 0 ? (
          <ReadingNote tone="warn">
            Sin plataforma identificada. El eslabon Aplicacion → Plataforma no esta resuelto para esta
            aplicacion, por lo tanto no aparece en ningun blast radius. Cuenta en el hueco.
          </ReadingNote>
        ) : (
          <>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {plats.map((p) => (
                <li key={p!.platform_id} className="rounded border border-ink-200 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-ink-900">{p!.name}</span>
                    {p!.is_ai_platform ? <AiTag /> : null}
                    {p!.is_legacy ? <span className="rounded border border-ink-300 bg-ink-50 px-1 py-0.5 text-[10px] text-ink-500">legacy</span> : null}
                  </div>
                  <div className="subtle num">
                    tier {p!.tier} · {p!.blast_radius_direct} apps directas · {p!.routable_pct.toFixed(1)}% ruteables
                  </div>
                </li>
              ))}
            </ul>
            {/* R9 — la derivacion no se disfraza de dato. */}
            <div className="mt-3 rounded-md border border-ink-200 bg-ink-50 p-3">
              <div className="flex items-center gap-2">
                <span className="label">Origen de la clasificacion</span>
                {app.platform_evidence ? <EvidenceBadge tier={app.platform_evidence} showAuthority /> : null}
              </div>
              {app.technology_raw ? (
                <>
                  <p className="mt-1 text-xs text-ink-600">
                    Derivada por normalizacion del campo de texto libre <span className="num">Technology Stack</span>.
                    Cadena original:
                  </p>
                  <pre className="num mt-1 overflow-x-auto rounded border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-800">
{app.technology_raw}
                  </pre>
                </>
              ) : (
                <p className="mt-1 text-xs text-ink-600">
                  Proviene del analisis de Tech Buckets, no de normalizacion de texto libre.
                </p>
              )}
            </div>
          </>
        )}
      </section>

      {/* El punto de la pantalla: la cardinalidad 1:N del ruteo. */}
      <section className="card card-pad">
        <SectionHeader
          kicker={`${ags.length} assignment group${ags.length === 1 ? "" : "s"}`}
          title="Ruteo — todos los Assignment Groups"
        />
        <ReadingNote tone={ags.length === 0 ? "warn" : "neutral"}>
          {ags.length === 0 ? (
            <>
              Esta aplicacion <strong>no tiene Assignment Group declarado</strong>. Un incidente sobre ella no
              encuentra destino. Cuenta en el hueco de ruteo junto con el resto del portafolio sin AG.
            </>
          ) : (
            <>
              La aplicacion por si sola <strong>no determina el destino del ticket</strong>. Esta corre sobre{" "}
              <span className="num font-semibold">{ags.length}</span> grupo{ags.length === 1 ? "" : "s"} y se listan
              todos, sin elegir uno como “el” responsable. En el portafolio,{" "}
              <InlineMetric resolved={multiAgCount} universe={UNIVERSE} /> tienen mas de un AG y una llega a{" "}
              <span className="num font-semibold">{maxAgCount}</span>.
            </>
          )}
        </ReadingNote>

        {ags.length > 0 ? (
          <div className="mt-3 scroll-thin overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Assignment Group</th>
                  <th className="th">Clave</th>
                  <th className="th">Apps del grupo</th>
                  <th className="th">Procesos que cubre</th>
                  <th className="th">Corpus de calidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {ags.map((g) => (
                  <tr key={g!.ag_id} className="row-hover">
                    <td className="td max-w-[300px] truncate font-medium">{g!.name}</td>
                    <td className="num td text-xs text-ink-500">{g!.ag_key}</td>
                    <td className="num td">{g!.app_count}</td>
                    <td className="td max-w-[280px] truncate text-xs text-ink-600">
                      {g!.processes.length ? g!.processes.join(", ") : <TbdValue value={null} />}
                    </td>
                    <td className="td text-xs">
                      {g!.has_quality
                        ? <span className="text-emerald-700">Si · ≥100 incidentes</span>
                        : <span className="text-ink-400">Sin corpus elegible</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <p className="subtle">
        Corte {meta.as_of}. El eslabon Aplicacion → Audiencia no esta capturado en v1, por lo tanto esta ficha
        no declara cuantos usuarios dependen de esta aplicacion.
      </p>
    </div>
  );
}
