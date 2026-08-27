"""
Construye data/xops-operational-graph-data.json desde la capa semantica
XOps_Operational_Graph_Semantic_Layer_v3.xlsx.

El xlsx es la fuente de verdad. Este script no inventa ni imputa: solo proyecta
las hojas al contrato de datos que consume la aplicacion, y verifica al final
que los agregados declarados en 09_COVERAGE se reproduzcan desde las filas.

Uso:  python3 scripts/build_data.py <ruta-al-xlsx>
"""
import json, sys, re
from pathlib import Path
from collections import Counter, defaultdict
import openpyxl

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else
           "XOps_Operational_Graph_Semantic_Layer_v3.xlsx")
OUT = Path(__file__).resolve().parent.parent / "data" / "xops-operational-graph-data.json"
AS_OF = "2026-08-21"

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)


def rows(sheet, skip=0):
    """Filas como dicts. `skip` salta filas de titulo antes del encabezado."""
    it = wb[sheet].iter_rows(values_only=True)
    for _ in range(skip):
        next(it)
    hdr = [str(h).strip() if h is not None else "" for h in next(it)]
    for r in it:
        if all(v is None for v in r):
            continue
        yield dict(zip(hdr, r))


def s(v):
    """Texto normalizado. El vacio se conserva como vacio, nunca se inventa."""
    if v is None:
        return ""
    return str(v).strip()


def num(v):
    if v is None or s(v) == "":
        return None
    try:
        f = float(v)
        return int(f) if f == int(f) else round(f, 3)
    except (TypeError, ValueError):
        return None


def yn(v):
    return s(v).upper() == "Y"


def split_list(v, sep=","):
    """Las columnas de lista traen su propio separador: las plataformas usan
    coma y los assignment groups punto y coma, porque sus nombres contienen
    comas internas ("REAL ESTATE, FACILITIES SUPPORT CGF")."""
    if not s(v):
        return []
    return [p.strip() for p in str(v).split(sep) if p.strip()]


TBD = "TBD"


def confirmed(v):
    """R4: lo no confirmado se declara como TBD, nunca en blanco."""
    t = s(v)
    return t if t and t.upper() != "TBD" else TBD


# ---------------------------------------------------------------- catalogos
platforms_raw = list(rows("02_DIM_PLATFORM"))
ags_raw = list(rows("03_DIM_ASSIGNMENT_GROUP"))
apps_raw = list(rows("01_DIM_APPLICATION"))
bridge_plat = list(rows("04_BRIDGE_APP_PLATFORM"))
bridge_ag = list(rows("05_BRIDGE_APP_AG"))

plat_id_by_name = {s(p["name"]): s(p["platform_id"]) for p in platforms_raw}
ag_id_by_name = {s(a["assignment_group"]): s(a["ag_id"]) for a in ags_raw}

# Los nombres de AG contienen comas ("DATA & DIGITAL SOLUTIONS, X"), por lo que
# separar por coma sin consultar el catalogo partiria grupos reales. Se re-arma
# greedy contra el catalogo y lo que no resuelve se conserva tal cual, declarado.
AG_NAMES = set(ag_id_by_name)
# Puentes: el par lleva su propio evidence_tier y source (R4 del contrato xlsx).
plat_pairs = defaultdict(list)
for r in bridge_plat:
    plat_pairs[s(r["app_id"])].append(
        {"platform_id": s(r["platform_id"]), "platform_name": s(r["platform_name"]),
         "evidence_tier": s(r["evidence_tier"]), "source": s(r["source"]), "as_of": s(r["as_of"])})

ag_pairs = defaultdict(list)
for r in bridge_ag:
    ag_pairs[s(r["app_id"])].append(
        {"ag_id": s(r["ag_id"]), "assignment_group": s(r["assignment_group"]),
         "evidence_tier": s(r["evidence_tier"]), "source": s(r["source"]), "as_of": s(r["as_of"])})

# ------------------------------------------------------------- aplicaciones
applications = []
unresolved_ag_names = Counter()

for a in apps_raw:
    app_id = s(a["app_id"])
    plat_names = split_list(a["platforms"])
    ba = ag_pairs.get(app_id, [])
    if ba:
        ag_names = [x["assignment_group"] for x in ba]
        ag_from = "bridge"
    else:
        ag_names = split_list(a["assignment_groups"], ";")
        ag_from = "inventory"
    for x in ag_names:
        if x not in AG_NAMES:
            unresolved_ag_names[x] += 1

    bp = plat_pairs.get(app_id, [])
    # R9 / derivation_warning: el eslabon Plataforma -> Aplicacion tiene dos
    # origenes de distinta autoridad. E2 es el analisis de Tech Buckets; el
    # resto se derivo normalizando el texto libre Technology Stack, que es E3.
    plat_tier = "E2" if bp else ("E3" if plat_names else None)
    # La fuente completa de cada tier vive una sola vez en meta.link_sources.
    ag_tier = "E3" if ag_names else None

    applications.append({
        "app_id": app_id,
        "name": s(a["application_name"]),
        "apm": s(a["apm"]),
        "category": s(a["product_category"]),
        "is_ai_ml": yn(a["is_ai_ml"]),
        "scope_status": s(a["scope_status"]),
        "process": confirmed(a["process_bucket"]),
        "sector": confirmed(a["sector"]),
        "program": s(a["program"]),
        "archetype": s(a["archetype"]),
        "criticality": s(a["criticality"]) or "C-",
        "criticality_raw": s(a["criticality_raw"]),
        "criticality_weight": {"C1": 5, "C2": 3, "C3": 1}.get(s(a["criticality"]), 0),
        "service_tier": s(a["service_tier"]),
        "support_window": s(a["support_window"]),
        "user_base": s(a["user_base"]),
        "financial_impact": s(a["financial_impact"]),
        "dpm": confirmed(a["dpm"]),
        "dpm_l3": confirmed(a["dpm_l3"]),
        "owner": confirmed(a["owner"]),
        "tech_lead": confirmed(a["tech_lead"]),
        "platforms": plat_names,
        "platform_evidence_tier": plat_tier,
        "technology_raw": s(a["technology_raw"]) or None,
        "ags": ag_names,
        "ag_evidence_tier": ag_tier,
        "ag_source_kind": ag_from if ag_names else None,
        "declared_reports": num(a["declared_reports"]),
        "tickets_2024": num(a["tickets_2024"]),
        "gates": {
            "attributable": yn(a["attributable"]),
            "routable": yn(a["routable"]),
            "owned": yn(a["owned"]),
            "platform_known": yn(a["platform_known"]),
        },
        "has_quality": yn(a["has_quality"]),
    })

by_app = {a["app_id"]: a for a in applications}

# ---------------------------------------------------------------- plataformas
apps_by_platform = defaultdict(list)
for a in applications:
    for pn in a["platforms"]:
        apps_by_platform[pn].append(a["app_id"])

platforms = []
for p in platforms_raw:
    name = s(p["name"])
    app_ids = apps_by_platform.get(name, [])
    apps_of = [by_app[i] for i in app_ids]
    mix = Counter(x["criticality"] for x in apps_of)
    ags_reach = sorted({g for x in apps_of for g in x["ags"]})
    routable = [x for x in apps_of if x["gates"]["routable"]]
    platforms.append({
        "platform_id": s(p["platform_id"]),
        "name": name,
        "tier": s(p["tier"]),
        "is_legacy": yn(p["is_legacy"]),
        "is_ai_platform": yn(p["is_ai_platform"]),
        # Recalculado desde las filas, no copiado de la hoja.
        "blast_radius_direct": len(app_ids),
        "blast_radius_weighted": sum(x["criticality_weight"] for x in apps_of),
        "app_ids": app_ids,
        "ai_ml_apps": sum(1 for x in apps_of if x["is_ai_ml"]),
        "processes_affected": sorted({x["process"] for x in apps_of}),
        "sectors_affected": sorted({x["sector"] for x in apps_of}),
        "ags_reachable": ags_reach,
        "dpms_reachable": sorted({x["dpm"] for x in apps_of if x["dpm"] != TBD}),
        "criticality_mix": {k: mix.get(k, 0) for k in ("C1", "C2", "C3", "C-")},
        "routable_apps": len(routable),
        "routable_pct": round(100 * len(routable) / len(app_ids), 1) if app_ids else 0.0,
        "declared_reports": num(p["declared_reports"]),
        "quality_incidents": num(p["quality_incidents"]),
        # Valores publicados en la hoja, conservados para contraste.
        "sheet_blast_radius_direct": num(p["blast_radius_direct"]),
    })

# ------------------------------------------------------- assignment groups
apps_by_ag = defaultdict(list)
for a in applications:
    for gn in a["ags"]:
        apps_by_ag[gn].append(a["app_id"])

assignment_groups = []
for g in ags_raw:
    name = s(g["assignment_group"])
    app_ids = apps_by_ag.get(name, [])
    apps_of = [by_app[i] for i in app_ids]
    assignment_groups.append({
        "ag_id": s(g["ag_id"]),
        "name": name,
        "ag_key": re.sub(r"[^A-Z0-9]", "", name.upper()),
        "has_quality": yn(g["has_quality"]),
        "app_count": len(app_ids),
        "app_ids": app_ids,
        "processes": sorted({x["process"] for x in apps_of if x["process"] != TBD}),
        "dpms": sorted({x["dpm"] for x in apps_of if x["dpm"] != TBD}),
    })

# --------------------------------- hallazgos de calidad del propio catalogo --
# 1. Nombres de AG que normalizan a la misma clave: son destinos de ruteo que el
#    catalogo lista dos veces por diferencias de espaciado o puntuacion.
_by_key = defaultdict(list)
for g in assignment_groups:
    _by_key[g["ag_key"]].append(g["name"])
duplicate_ag_keys = [{"ag_key": k, "names": v} for k, v in _by_key.items() if len(v) > 1]

# 2. La columna assignment_groups del inventario esta topada en 10 entradas,
#    corta el ultimo nombre y ademas repite variantes del mismo grupo, por lo que
#    su ag_count no coincide con el puente. El puente manda.
ag_count_gap = sum(
    1 for a, x in zip(applications, apps_raw)
    if len(a["ags"]) != int(x["ag_count"] or 0)
)

# ------------------------------------------------------------------ cobertura
coverage = []
for c in rows("09_COVERAGE", skip=2):
    resolved, universe = num(c["resolved"]), num(c["universe"])
    coverage.append({
        "id": s(c["id"]), "link": s(c["link"]),
        "resolved": resolved, "universe": universe,
        "coverage_pct": round(100 * resolved / universe, 1),
        "gap": universe - resolved,
        "evidence_tier": s(c["evidence_tier"]),
        "owner": s(c["owner"]), "source": s(c["source"]),
    })

# L1 mezcla dos autoridades; el desglose se calcula desde las filas.
l1_e2 = sum(1 for a in applications if a["platform_evidence_tier"] == "E2")
l1_e3 = sum(1 for a in applications if a["platform_evidence_tier"] == "E3")
for c in coverage:
    if c["id"] == "L1":
        c["breakdown"] = [
            {"evidence_tier": "E2", "resolved": l1_e2,
             "source": "Analisis de Tech Buckets · Impact_Lineage_Matrix"},
            {"evidence_tier": "E3", "resolved": l1_e3,
             "source": "Normalizacion por palabra clave del campo libre Technology Stack"},
        ]

# -------------------------------------------------------------------- calidad
DIRECTION = {"sube": "up_is_good", "baja": "down_is_good"}
baseline_metrics = []
for m in rows("10_QUALITY_BASELINE", skip=3):
    baseline_metrics.append({
        "key": s(m["metrica"]),
        "baseline": num(m["baseline_2025-08_2026-01"]),
        "current": num(m["actual_2026-02_2026-08"]),
        "delta": num(m["delta_pp"]),
        "direccion_deseada": DIRECTION[s(m["direccion_deseada"])],
        "unit": "pts" if s(m["metrica"]) == "avg_score" else "pp",
    })

TS_FIELDS = ["incidents", "diagnostic_rate", "empty_rate", "has_root_rate",
             "has_res_rate", "avg_score", "poor_critical_rate", "rca_marker_rate", "reopen_rate"]


def series(sheet, key):
    out = []
    for r in rows(sheet):
        point = {"period": s(r[key])}
        for f in TS_FIELDS:
            point[f] = num(r[f])
        out.append(point)
    return out


quality = {
    "meta": {
        "corpus": "QN_p120826_FULL_2_4_2_RO_270826 · User_Detail",
        "as_of": "2026-08-12",
        "universe_raw": 277408,
        "eligible": 242706,
        "eligible_pct": 87.5,
        "eligibility_rule": "State en (Closed, Resolved) Y Close Code fuera de "
                            "(Cancelled, Incident Withdrawn, Became a Request, Not Solved)",
        "eligibility_effect": "Excluir los no elegibles mueve la banda Excellent de 36.6% a 41.8%, "
                              "es decir 5.2 puntos. La decision de denominador queda escrita antes "
                              "de fijar la linea base.",
        "instrument": "Scorer QN v2.4.2 · canonico",
        "instrument_warning": "El archivo incidentes_clasificados.xlsx (279 incidentes) usa una funcion "
                              "de puntaje distinta que depende de un VLOOKUP a una ruta local. Aplicando "
                              "su misma regla binaria al corpus grande los promedios difieren: Alta 84.5 "
                              "vs 88.5, Media 63.2 vs 44.3, Baja 40.7 vs 3.1. Los dos instrumentos no "
                              "estan calibrados y el desacuerdo se concentra en la banda baja, que es "
                              "justo donde se medira la mejora.",
        "band_divergence": [
            {"band": "Alta", "qn_v242": 84.5, "binary_xlsx": 88.5},
            {"band": "Media", "qn_v242": 63.2, "binary_xlsx": 44.3},
            {"band": "Baja", "qn_v242": 40.7, "binary_xlsx": 3.1},
        ],
        "quality_rule": "has_root = Root Cause > 0 · has_res = Resolution Docs > 0 · "
                        "Alta = ambos · Media = uno · Baja = ninguno",
        "break_note": "La tasa diagnostica pasa de 6.6% en 2025Q2 a 31.4% en 2025Q3, lo cual refleja "
                      "un cambio de practica interno. Una linea base anterior a ese quiebre mediria ese "
                      "cambio y no el desempeno del proveedor.",
        "decalogue_coverage_pct": 23.0,
        "join_note": "La calidad se mide por Assignment Group, no por Business Application. La calidad "
                     "de una aplicacion es por lo tanto una aproximacion via sus AGs y se etiqueta asi.",
        "baseline_window": ["2025-08-01", "2026-01-31"],
        "current_window": ["2026-02-01", "2026-08-12"],
    },
    "baseline_metrics": baseline_metrics,
    "timeseries": {
        "week": series("11_TS_WEEK", "week"),
        "month": series("11_TS_MONTH", "month"),
        "quarter": series("11_TS_QUARTER", "quarter"),
        "year": series("11_TS_YEAR", "year"),
    },
    "by_assignment_group": [{
        "name": s(r["Assignment Group"]),
        "ag_key": re.sub(r"[^A-Z0-9]", "", s(r["Assignment Group"]).upper()),
        "incidents": num(r["incidents"]),
        "diagnostic_rate": num(r["diagnostic_rate"]),
        "has_root_rate": num(r["has_root_rate"]),
        "avg_score": num(r["avg_score"]),
        "poor_rate": num(r["poor_rate"]),
    } for r in rows("13_QUALITY_BY_AG")],
    "by_decalogue": [{
        "dcode": s(r["dcode"]), "incidents": num(r["incidents"]),
        "avg_score": num(r["avg_score"]), "diagnostic_rate": num(r["diagnostic_rate"]),
        "ags": num(r["ags"]),
    } for r in rows("14_QUALITY_BY_DECALOGUE")],
    "recurring_patterns": [{
        "sig": s(r["sig"]), "incidents": num(r["incidents"]), "example": s(r["example"]),
        "ags": num(r["ags"]), "top_ag": s(r["top_ag"]),
        "diagnostic_rate": num(r["diagnostic_rate"]), "avg_score": num(r["avg_score"]),
        "first_seen": s(r["first_seen"]), "last_seen": s(r["last_seen"]),
    } for r in rows("12_RECURRING_PATTERNS", skip=2)],
}

# Cobertura del join calidad<->AG, calculada desde las filas.
q_keys = {r["ag_key"] for r in quality["by_assignment_group"]}
bridge_keys = {g["ag_key"] for g in assignment_groups}
matched = q_keys & bridge_keys
apps_with_q = [a for a in applications
               if any(re.sub(r"[^A-Z0-9]", "", n.upper()) in matched for n in a["ags"])]
q_matched_incidents = sum(r["incidents"] for r in quality["by_assignment_group"]
                          if r["ag_key"] in matched)
q_total_incidents = sum(r["incidents"] for r in quality["by_assignment_group"])
quality["meta"]["join_coverage"] = {
    "ags_matched": len(matched),
    "ags_bridge": len(bridge_keys),
    "ags_quality": len(quality["by_assignment_group"]),
    "incident_coverage_pct": round(100 * q_matched_incidents / q_total_incidents, 1),
    "apps_reached": len(apps_with_q),
    "apps_universe": len(applications),
    "platforms_reached": sum(1 for p in platforms
                             if any(re.sub(r"[^A-Z0-9]", "", n.upper()) in matched
                                    for n in p["ags_reachable"])),
    "platforms_universe": len(platforms),
}

# --------------------------- extension seccion 7: aun no resuelta -----------
workspaces = [{
    "priority_rank": num(r["priority_rank"]),
    "workspace_name": s(r["workspace_name"]),
    "platform": s(r["platform"]),
    "dashboards_active": num(r["dashboards_active"]),
    "sector": s(r["sector"]),
    "function_l1": s(r["function_l1"]),
    "views_6m": num(r["views_6m"]),
    "l5_manager": s(r["l5_manager"]),
    "candidate_suggested": s(r["candidate_suggested"]),
    "match_score": num(r["match_score"]),
    "match_method": s(r["match_method"]),
    "subset_risk": s(r["subset_risk"]) == "Sí",
    "views_share_pct": num(r["views_share_pct"]),
    "cum_share_pct": num(r["cum_share_pct"]),
    "wave": s(r["wave"]),
    # El unico input manual del modelo. Vacio = no capturado.
    "application_name_confirmed": s(r["application_name_CONFIRMED"]) or None,
} for r in rows("06_BRIDGE_WORKSPACE_APP", skip=2)]

consumption = [{
    "platform": s(r["platform"]), "report_id": s(r["report_id"]),
    "report_name": s(r["report_name"]), "workspace_name": s(r["workspace_name"]),
    "function_l1": s(r["function_l1"]), "sector": s(r["sector"]),
    "l4_manager": s(r["l4_manager"]), "l5_manager": s(r["l5_manager"]),
    "refresh_frequency": s(r["refresh_frequency"]),
    "views_6m": num(r["views_6m"]), "total_users": num(r["total_users"]),
    "app_id_confirmed": s(r["app_id_confirmed"]) or None,
} for r in rows("07_FACT_CONSUMPTION")]

confirmed_ws = sum(1 for w in workspaces if w["application_name_confirmed"])
top30 = sorted(workspaces, key=lambda w: w["views_6m"] or 0, reverse=True)[:30]
total_views = sum(w["views_6m"] or 0 for w in workspaces) or 1

measures = [{
    "measure_id": s(m["measure_id"]), "name": s(m["measure_name"]), "layer": s(m["layer"]),
    "grain": s(m["grain"]), "formula": s(m["formula_negocio"]),
    "denominator": s(m["denominador_declarado"]), "coverage": s(m["cobertura_actual"]),
    "evidence_tier": s(m["evidence_tier"]), "status": s(m["estado"]), "note": s(m["nota"]),
} for m in rows("08_MEASURES")]

# ----------------------------------------------------------------------- meta
meta = {
    "product": "XOps Operational Graph",
    "short_name": "XOG",
    "version": "POC v1",
    "as_of": AS_OF,
    "universe_apps": len(applications),
    "scope_note": "Impacto por proceso y ruteo. NO incluye impacto por audiencia de dashboards, "
                  "excluido por decision de alcance, no por olvido.",
    "source_file": SRC.name,
    "rules": [
        {"id": "R1", "title": "La Business Application es la espina dorsal",
         "statement": "Proceso, sector y criticidad viven en la aplicacion y suben al Assignment Group, nunca al reves."},
        {"id": "R2", "title": "Toda relacion es N:M",
         "statement": "Una aplicacion llega a 5 plataformas y a 14 Assignment Groups.",
         "consequence": "Una columna de lookup seria falsa desde la primera fila; se resuelve con tabla puente."},
        {"id": "R3", "title": "Ninguna metrica se muestra sin su cobertura declarada",
         "statement": "La cobertura es parte de la metrica: siempre resuelto sobre universo y porcentaje."},
        {"id": "R4", "title": "El blast radius no es aditivo entre plataformas",
         "statement": "Al combinar plataformas se calcula la union deduplicada de app_ids, nunca la suma.",
         "consequence": "Hay aplicaciones que corren en Teradata y SAP BW a la vez; sumar las cuenta dos veces."},
        {"id": "R5", "title": "El volumen de tickets es eje de costo, nunca eje de riesgo",
         "statement": "tickets no se colorea con semaforo de riesgo ni se ordena junto a criticidad.",
         "consequence": "La relacion con criticidad es inversa; usarlo como senal de riesgo prioriza lo menos critico."},
        {"id": "R6", "title": "La calidad de work notes se mide con un solo instrumento declarado",
         "statement": "El scorer canonico es QN v2.4.2.",
         "consequence": "Comparar bandas de dos scorers distintos produce un delta que es artefacto del instrumento."},
        {"id": "R7", "title": "Technology Stack es texto libre y su normalizacion es una derivacion declarada",
         "statement": "La clasificacion a plataformas canonicas no es un dato de origen.",
         "consequence": "Debe revisarse antes de usarse para decisiones de arquitectura, y se marca como E3."},
        {"id": "R8", "title": "Cada fila de puente lleva su nivel de evidencia y su fuente",
         "statement": "E1 es CMDB, E2 analisis derivado, E3 hoja de calculo."},
    ],
    "evidence_tiers": {
        "E1": "CMDB · alta autoridad",
        "E2": "Analisis derivado · autoridad media",
        "E3": "Hoja de calculo · baja autoridad",
    },
    "criticality_scale": {
        "C1": "Most critical · peso 5",
        "C2": "Somewhat critical · peso 3",
        "C3": "Less critical · peso 1",
        "C-": "No declarada · peso 0",
        "note": "Normalizado desde dos vocabularios en circulacion: BC1/BC2/BC3 (feb 2026) y "
                "RP1/RP2/RP3 (ago 2026). criticality_raw conserva el original.",
    },
    "derivation_warning": "El eslabon Plataforma -> Aplicacion tiene dos origenes de distinta autoridad. "
                          f"{l1_e2} aplicaciones vienen del analisis de Tech Buckets, que es analisis derivado (E2). "
                          f"Las otras {l1_e3} se derivaron por coincidencia de palabras clave sobre el campo de "
                          "texto libre Technology Stack, lo cual es E3 y admite falsos positivos y falsos negativos. "
                          "La interfaz distingue ambos origenes y no los presenta como equivalentes.",
    "out_of_scope": [
        "Dashboard -> Aplicacion: hoja de captura abierta, "
        f"{confirmed_ws} de {len(workspaces)} workspaces confirmados.",
        "Aplicacion -> Audiencia: depende del eslabon anterior.",
        "RCA Intelligence, Agent Actions y escritura hacia ServiceNow.",
    ],
    "dashboard_link": {
        "workspaces": len(workspaces),
        "dashboards_active": len(consumption),
        "confirmed": confirmed_ws,
        "top30_views_share_pct": round(100 * sum(w["views_6m"] or 0 for w in top30) / total_views, 1),
        "note": "El unico input manual del modelo es application_name_CONFIRMED. El match por nombre "
                "resuelve poco y el fuzzy produce falsos positivos por subconjunto, por lo tanto la "
                "confirmacion es humana por diseno. Mientras este vacia, el impacto por audiencia no se estima.",
    },
    "link_sources": {
        "platform": {
            "E2": "Analisis de Tech Buckets · Impact_Lineage_Matrix (feb 2026)",
            "E3": "Normalizacion por palabra clave del campo libre Technology Stack (inventario Margarita)",
        },
        "assignment_group": {
            "E3": "DPM_and_Application_List hoja 12 (ago 2026) + Assignment Group del inventario Margarita",
        },
    },
    "data_quality_notes": [
        {
            "id": "DQ1",
            "title": "El catalogo de Assignment Groups repite destinos",
            "detail": f"{len(duplicate_ag_keys)} pares de nombres normalizan a la misma clave por "
                      "espaciado o puntuacion, por lo que las 268 filas representan menos destinos "
                      "de ruteo distintos. Afecta el cruce con calidad, que se une por clave.",
            "items": duplicate_ag_keys,
        },
        {
            "id": "DQ2",
            "title": "ag_count del inventario no coincide con el puente",
            "detail": f"En {ag_count_gap} aplicaciones la columna assignment_groups declara un grupo "
                      "mas que el puente. La columna esta topada en 10 entradas, corta el ultimo "
                      "nombre a la mitad y repite variantes del mismo grupo. El puente "
                      "05_BRIDGE_APP_AG es la fuente exacta y es la que alimenta la aplicacion.",
        },
    ],
    "ai_ops": {
        "note": "Cluster 06 AI Ops. La cobertura de ruteo del portafolio AI/ML es la mas baja del modelo, "
                "coherente con que el catalogo de actividades L1.5 de ese cluster aun no esta declarado.",
    },
}

# Ninguna fila de consumo trae app_id_confirmed, por lo tanto no puede unirse a
# ninguna aplicacion y no se publica en v1. Se emite con --with-consumption, que
# es lo que corresponde el dia que la hoja de captura se llene.
WITH_CONSUMPTION = "--with-consumption" in sys.argv

data = {
    "meta": meta,
    "coverage": coverage,
    "applications": applications,
    "platforms": platforms,
    "assignment_groups": assignment_groups,
    "measures": measures,
    "quality": quality,
    "workspaces": workspaces,
    **({"consumption": consumption} if WITH_CONSUMPTION else {}),
}

# ------------------------------------------------------------ verificaciones
cov = {c["id"]: c for c in coverage}
checks = [
    ("aplicaciones", len(applications), 504),
    ("plataformas", len(platforms), 38),
    ("assignment groups", len(assignment_groups), 268),
    ("L1 con plataforma", sum(1 for a in applications if a["platforms"]), cov["L1"]["resolved"]),
    ("L2 con AG", sum(1 for a in applications if a["ags"]), cov["L2"]["resolved"]),
    ("L3 con DPM confirmado", sum(1 for a in applications if a["dpm"] != TBD), cov["L3"]["resolved"]),
    ("L4 atribuibles", sum(1 for a in applications if a["gates"]["attributable"]), cov["L4"]["resolved"]),
    ("L1 desglose E2+E3 = resuelto", l1_e2 + l1_e3, cov["L1"]["resolved"]),
    ("AI/ML", sum(1 for a in applications if a["is_ai_ml"]), 142),
    ("criticidad no declarada", sum(1 for a in applications if a["criticality"] == "C-"), 324),
    ("AGs con calidad medida", len(quality["by_assignment_group"]), 140),
    ("series semana", len(quality["timeseries"]["week"]), 138),
    ("series mes", len(quality["timeseries"]["month"]), 33),
    ("series trimestre", len(quality["timeseries"]["quarter"]), 12),
    ("series ano", len(quality["timeseries"]["year"]), 4),
    ("workspaces", len(workspaces), 159),
    ("dashboards activos", len(consumption), 838),
]

checks.append(("app con mas AGs", max(len(a["ags"]) for a in applications), 14))
checks.append(("apps con mas de un AG", sum(1 for a in applications if len(a["ags"]) > 1), 113))
checks.append(("nombres de AG fuera del catalogo", len(unresolved_ag_names), 0))
checks.append(("claves de AG duplicadas", len(duplicate_ag_keys), 3))

fails = 0
print("VERIFICACION")
for label, got, want in checks:
    ok = got == want
    fails += not ok
    print(f"  {'ok  ' if ok else 'FAIL'} {label}: {got}" + ("" if ok else f"  (esperado {want})"))

# R4: caso testigo de no aditividad, calculado desde las filas.
td = {a for a in apps_by_platform.get("TERADATA", [])}
bw = {a for a in apps_by_platform.get("SAP_BW", [])}
print(f"\n  R4 · Teradata {len(td)} + SAP_BW {len(bw)} = suma {len(td)+len(bw)} · "
      f"union {len(td | bw)} · traslape {len(td & bw)}")

if unresolved_ag_names:
    print(f"\n  aviso: {len(unresolved_ag_names)} nombre(s) de AG no resueltos contra el catalogo:")
    for n, c in unresolved_ag_names.most_common(8):
        print(f"    {c:3d}x  {n[:70]}")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
kb = OUT.stat().st_size / 1024
print(f"\nEscrito {OUT} ({kb:.0f} KB)")
if fails:
    print(f"{fails} verificacion(es) fallida(s).")
    sys.exit(1)
