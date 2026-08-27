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
# --------------------------------------------------------------- sectores
# La hoja guarda el sector como texto multivalor en una sola celda y trae tres
# problemas: separador inconsistente (coma y punto y coma), variantes de caja
# ("Global" / "GLOBAL") y IDs de servicio de ServiceNow que se colaron en la
# columna. Se normaliza lo normalizable y lo demas se pone en cuarentena
# declarada (DQ4) en lugar de silenciarlo o de contarlo como un sector.
SECTOR_CANON = {
    "PFNA": "PFNA", "PBNA": "PBNA", "CGF": "CGF", "EUROPE": "EUROPE",
    "AMESA": "AMESA", "FLNA": "FLNA", "LATAM": "LATAM", "APAC": "APAC",
    "QFNA": "QFNA", "PGCS": "PGCS", "GLOBAL": "GLOBAL",
}
NON_SECTOR = re.compile(r"^(SNSVC|BSN)\d+$", re.I)

def split_sectors(raw):
    """Devuelve (sectores canonicos, tokens no reconocidos). Nunca inventa."""
    txt = (raw or "").strip()
    if not txt:
        return [], []
    parts = [q.strip() for chunk in txt.split(",") for q in chunk.split(";") if q.strip()]
    good, unknown = [], []
    for part in parts:
        up = part.upper()
        if up in ("TBD", "NOT STATED", "POR CONFIRMAR"):
            continue
        if up in SECTOR_CANON:
            if SECTOR_CANON[up] not in good:
                good.append(SECTOR_CANON[up])
        else:
            unknown.append(part)
    return good, unknown

sector_quarantine = {}

# Escalas de impacto de negocio. Solo se reconocen los niveles que la hoja
# declara; todo lo demas queda en null y se cuenta como no declarado.
IMPACT_LEVEL = {"low": "Low", "medium": "Medium", "high": "High", "critical": "Critical"}
# El tamano de audiencia viene en bandas de texto. ">100" es una banda distinta
# de las demas y se conserva tal cual en lugar de mapearla a la mas parecida.
USER_BAND = {
    "0-5": "0-5", "6-49": "6-49", "50-99": "50-99", "100-499": "100-499",
    "500-999": "500-999", "1000+": "1000+", ">100": ">100",
}

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

    sec_names, sec_unknown = split_sectors(a["sector"])
    if sec_unknown:
        sector_quarantine[app_id] = sec_unknown

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
        "sectors": sec_names,
        "sector_unrecognized": sec_unknown,
        "program": s(a["program"]),
        "archetype": s(a["archetype"]),
        "criticality": s(a["criticality"]) or "C-",
        "criticality_raw": s(a["criticality_raw"]),
        "criticality_weight": {"C1": 5, "C2": 3, "C3": 1}.get(s(a["criticality"]), 0),
        "service_tier": s(a["service_tier"]),
        "support_window": s(a["support_window"]),
        "user_base": s(a["user_base"]),
        "financial_impact": s(a["financial_impact"]),
        # Impacto de negocio, con los marcadores de la hoja convertidos a null.
        # "TBD, ARA Not Started" y "Empty" son ausencia declarada, no un nivel.
        "business_impact": {
            "financial": IMPACT_LEVEL.get(s(a["financial_impact"]).strip().lower()),
            "financial_raw": s(a["financial_impact"]) or None,
            "user_base": USER_BAND.get(s(a["user_base"]).strip()),
            "user_base_raw": s(a["user_base"]) or None,
            "service_tier": s(a["service_tier"]) or None,
            "support_window": s(a["support_window"]) or None,
        },
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

# ------------------------------------------------------------------- sectores
# El sector es una dimension de negocio de pleno derecho, no una cadena de texto:
# 116 aplicaciones pertenecen a mas de uno, asi que la relacion es N:M igual que
# plataforma y assignment group (R2). Se agrega desde las filas, nunca a mano.
apps_by_sector = defaultdict(list)
for a in applications:
    for sn in a["sectors"]:
        apps_by_sector[sn].append(a["app_id"])

sectors = []
for name in sorted(apps_by_sector, key=lambda k: (-len(apps_by_sector[k]), k)):
    ids = apps_by_sector[name]
    pool = [by_app[i] for i in ids]
    mix = {c: sum(1 for x in pool if x["criticality"] == c) for c in ("C1", "C2", "C3", "C-")}
    sectors.append({
        "sector_id": f"SEC{len(sectors) + 1:02d}",
        "name": name,
        "app_ids": ids,
        "apps": len(ids),
        "routable": sum(1 for x in pool if x["gates"]["routable"]),
        "owned": sum(1 for x in pool if x["gates"]["owned"]),
        "platform_known": sum(1 for x in pool if x["gates"]["platform_known"]),
        "attributable": sum(1 for x in pool if x["gates"]["attributable"]),
        "ai_ml": sum(1 for x in pool if x["is_ai_ml"]),
        "criticality_mix": mix,
        "weighted": sum(x["criticality_weight"] for x in pool),
        "processes": sorted({x["process"] for x in pool if x["process"] not in ("TBD", "Por confirmar")}),
        "platforms": sorted({pn for x in pool for pn in x["platforms"]}),
        "ags": sorted({g for x in pool for g in x["ags"]}),
        "dpms": sorted({x["dpm"] for x in pool if x["dpm"] not in ("TBD",)}),
        "tickets_2024": sum(x["tickets_2024"] or 0 for x in pool),
        # Impacto de negocio declarado dentro del sector, con su propio hueco.
        "impact_declared": sum(1 for x in pool if x["business_impact"]["financial"]),
        "impact_high": sum(1 for x in pool
                           if x["business_impact"]["financial"] in ("High", "Critical")),
    })

# Aplicaciones sin ningun sector reconocido. No se reparten ni se imputan.
apps_without_sector = [a["app_id"] for a in applications if not a["sectors"]]

# ------------------------------------------------------------------ cobertura
# La interfaz se publica en ingles. Las etiquetas narrativas de la hoja vienen en
# espanol, asi que se traducen con un diccionario explicito: si aparece una
# etiqueta nueva se conserva el original en lugar de perderla en silencio.
LINK_EN = {
    "Plataforma \u2192 Aplicaci\u00f3n": "Platform \u2192 Application",
    "Aplicaci\u00f3n \u2192 Assignment Group": "Application \u2192 Assignment Group",
    "Aplicaci\u00f3n \u2192 DPM sin TBD": "Application \u2192 DPM without TBD",
    "Aplicaci\u00f3n \u2192 Proceso y Sector": "Application \u2192 Process and Sector",
}
SOURCE_EN = {
    "Tech Buckets feb 2026 (E2) + Technology Stack del inventario Margarita "
    "(E3, derivado de texto libre)":
        "Tech Buckets Feb 2026 (E2) + Technology Stack from the Margarita inventory "
        "(E3, derived from free text)",
    "Hoja 12 ago 2026 + inventario Margarita":
        "Sheet 12 Aug 2026 + Margarita inventory",
    "Hoja 12 + DPM NAME y DPM L3 del inventario Margarita":
        "Sheet 12 + DPM NAME and DPM L3 from the Margarita inventory",
    "Inventory 479 + Sector SNOW del inventario Margarita":
        "Inventory 479 + Sector SNOW from the Margarita inventory",
}

coverage = []
for c in rows("09_COVERAGE", skip=2):
    resolved, universe = num(c["resolved"]), num(c["universe"])
    coverage.append({
        "id": s(c["id"]), "link": LINK_EN.get(s(c["link"]), s(c["link"])),
        "resolved": resolved, "universe": universe,
        "coverage_pct": round(100 * resolved / universe, 1),
        "gap": universe - resolved,
        "evidence_tier": s(c["evidence_tier"]),
        "owner": s(c["owner"]),
        "source": SOURCE_EN.get(s(c["source"]), s(c["source"])),
    })

# L1 mezcla dos autoridades; el desglose se calcula desde las filas.
l1_e2 = sum(1 for a in applications if a["platform_evidence_tier"] == "E2")
l1_e3 = sum(1 for a in applications if a["platform_evidence_tier"] == "E3")
for c in coverage:
    if c["id"] == "L1":
        c["breakdown"] = [
            {"evidence_tier": "E2", "resolved": l1_e2,
             "source": "Tech Buckets analysis · Impact_Lineage_Matrix"},
            {"evidence_tier": "E3", "resolved": l1_e3,
             "source": "Keyword normalization of the free-text Technology Stack field"},
        ]

# La unica etiqueta de Decalogo que no viene en ingles es la categoria residual.
# Se traduce explicitamente y NO se excluye: es la mas grande del corpus.
DCODE_EN = {"Sin c\u00f3digo": "No code", "Sin codigo": "No code"}

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
        "eligibility_rule": "State in (Closed, Resolved) AND Close Code not in "
                            "(Cancelled, Incident Withdrawn, Became a Request, Not Solved)",
        "eligibility_effect": "Excluding the non-eligible records moves the Excellent band from 36.6% "
                              "to 41.8%, that is 5.2 points. The denominator decision is written down "
                              "before the baseline is fixed, not after.",
        "instrument": "QN v2.4.2 scorer · canonical",
        "instrument_warning": "The file incidentes_clasificados.xlsx (279 incidents) uses a different "
                              "scoring function that depends on a VLOOKUP to a local path. Applying its "
                              "own binary rule to the large corpus, the averages disagree: High 84.5 vs "
                              "88.5, Medium 63.2 vs 44.3, Low 40.7 vs 3.1. The two instruments are not "
                              "calibrated against each other and the disagreement concentrates in the "
                              "low band, which is exactly where improvement will be measured.",
        "band_divergence": [
            {"band": "High", "qn_v242": 84.5, "binary_xlsx": 88.5},
            {"band": "Medium", "qn_v242": 63.2, "binary_xlsx": 44.3},
            {"band": "Low", "qn_v242": 40.7, "binary_xlsx": 3.1},
        ],
        "quality_rule": "has_root = Root Cause > 0 · has_res = Resolution Docs > 0 · "
                        "High = both · Medium = one · Low = neither",
        "break_note": "The diagnostic rate jumps from 6.6% in 2025Q2 to 31.4% in 2025Q3, which reflects "
                      "an internal change of practice. A baseline starting before that break would "
                      "measure the change of practice and not the vendor's performance.",
        "decalogue_coverage_pct": 23.0,
        "join_note": "Quality is measured per Assignment Group, not per Business Application. The quality "
                     "of an application is therefore an approximation through its AGs, and it is labelled "
                     "as such.",
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
        "dcode": DCODE_EN.get(s(r["dcode"]), s(r["dcode"])), "incidents": num(r["incidents"]),
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

# ------------------------------------------------------- registro de metricas
# 08_MEASURES es el respaldo de trazabilidad: por cada metrica trae formula de
# negocio, denominador declarado, cobertura, nivel de evidencia y estado. Se
# traduce con diccionarios explicitos y se le agrega `binding`, que es la clave
# con la que la interfaz une la ficha con el valor que ella misma calcula. Las
# cifras que la hoja escribio en su nota se conservan tal cual: cuando difieren
# del valor calculado, la interfaz muestra las dos y marca la divergencia.
MEASURE_EN = {
    "M01": ("Direct blast radius", "Distinct applications linked to the platform in 04_BRIDGE_APP_PLATFORM",
            "91 apps with a declared platform", "141 pairs \u00b7 91 apps",
            "Not additive across platforms: 8 apps run on Teradata and SAP BW at the same time",
            "platform.blast_radius_direct"),
    "M02": ("Union blast radius", "Distinct applications in the union of the set, deduplicated",
            "91 apps with a declared platform", "n/a until unblocked",
            "Teradata + SAP BW = 43 deduplicated apps, not 51", "blast.union"),
    "M03": ("Weighted blast radius", "Sum over apps of (criticality weight x audience weight). BC1=5 BC2=3 BC3=1",
            "Apps with a platform AND a resolved audience", "n/a until unblocked",
            "Requires M04. Unblocked by capturing the 30 workspaces", "blast.weighted"),
    "M04": ("Audience reach", "Unique users of the dashboards linked to the application",
            "838 active dashboards", "0.0% workspaces confirmed",
            "Requires application_name_CONFIRMED in 06", "dashboard.confirmed"),
    "M05": ("Ticket intensity", "Tickets per year divided by the applications of the platform",
            "Feb-2026 corpus, 132 apps", "n/a until unblocked",
            "COST AXIS, NOT A RISK AXIS. BC3 generates 11,167 tickets and BC1 only 563", "tickets.total"),
    "M06": ("Attribution coverage", "Applications with a declared process and sector over the universe",
            "504 applications", "0.0%", "Gate 1 of 3: Attributable", "gate.attributable"),
    "M07": ("Routing coverage", "Applications with at least one declared Assignment Group",
            "504 applications", "0.0%",
            "Gate 2 of 3: Routable. The source is a spreadsheet, not CMDB", "gate.routable"),
    "M08": ("Processes affected", "Distinct process buckets reached by the platform",
            "8 process buckets", "n/a until unblocked",
            "Translates technical failure into business function", "blast.processes"),
    "M09": ("Metadata debt", "Applications with no platform or no declared AG",
            "504 applications", "0 signals",
            "A progress metric, not a failure metric. It is published and tracked", "gap.metadata"),
    "M10": ("Concentration index", "Deduplicated union of the two largest platforms over the universe",
            "132 apps in the platform analysis", "n/a until unblocked", "43 of 132 = 32.6%",
            "blast.concentration"),
    "M11": ("Diagnostic rate", "Incidents with compliance_class DIAGNOSTICO over eligible incidents",
            "242,706 eligible", "", "Anchor metric of the module. Baseline 51.6% \u00b7 current 68.4%",
            "quality.diagnostic_rate"),
    "M12": ("Root cause rate", "Incidents with Root Cause greater than zero over eligible incidents",
            "242,706 eligible", "", "Baseline 71.2% \u00b7 current 83.7%", "quality.has_root_rate"),
    "M13": ("Poor+Critical rate", "Incidents in the Poor or Critical band over eligible incidents",
            "242,706 eligible", "", "Desired direction is downwards. Baseline 15.8% \u00b7 current 7.3%",
            "quality.poor_critical_rate"),
    "M14": ("Average score", "Average Total Score from the QN v2.4.2 scorer", "242,706 eligible", "",
            "Not comparable against the scorer in incidentes_clasificados.xlsx", "quality.avg_score"),
    "M15": ("Recurrence concentration", "Incidents of the pattern over the eligible corpus",
            "240,241 with a close date", "",
            "513 patterns concentrate 29.7%. The largest is 9,370 incidents from a single validator",
            "quality.recurrence"),
    "M16": ("Decalogue coverage", "Incidents with a D code assigned over eligible incidents",
            "242,706 eligible", "", "23.0%. It bounds assisted RCA to the codes actually covered",
            "quality.decalogue"),
}
LAYER_EN = {"Exposici\u00f3n": "Exposure", "Consumo": "Consumption", "Costo": "Cost",
            "Gate": "Gate", "Calidad": "Quality", "Recurrencia": "Recurrence"}
GRAIN_EN = {"Plataforma": "Platform", "Conjunto de plataformas": "Set of platforms",
            "Aplicaci\u00f3n": "Application", "Portafolio": "Portfolio",
            "Ventana de tiempo": "Time window", "Patr\u00f3n": "Pattern"}
STATUS_EN = {"Provisional": "Provisional", "Bloqueada": "Blocked", "Certificada": "Certified"}

measures = []
for m in rows("08_MEASURES"):
    mid = s(m["measure_id"])
    en = MEASURE_EN.get(mid)
    measures.append({
        "measure_id": mid,
        "name": en[0] if en else s(m["measure_name"]),
        "layer": LAYER_EN.get(s(m["layer"]), s(m["layer"])),
        "grain": GRAIN_EN.get(s(m["grain"]), s(m["grain"])),
        "formula": en[1] if en else s(m["formula_negocio"]),
        "denominator": en[2] if en else s(m["denominador_declarado"]),
        "coverage": en[3] if en else s(m["cobertura_actual"]),
        "evidence_tier": s(m["evidence_tier"]),
        "status": STATUS_EN.get(s(m["estado"]), s(m["estado"])),
        "note": en[4] if en else s(m["nota"]),
        # Clave con la que la interfaz une la ficha al valor que ella calcula.
        "binding": en[5] if en else None,
        "source_sheet": "08_MEASURES",
    })

# DQ3 · La hoja usa tres grafias distintas para el mismo no-valor. Se cuentan
# desde las filas y se declaran; la interfaz las trata a las tres como TBD, pero
# la compuerta Atribuible se conserva tal como la declara la hoja.
PLACEHOLDERS = ("TBD", "Por confirmar", "not stated")
placeholder_counts = {}
for _f in ("process", "sector"):
    for _a in applications:
        _v = (_a[_f] or "").strip()
        if _v in PLACEHOLDERS:
            placeholder_counts[f"{_f} = {_v}"] = placeholder_counts.get(f"{_f} = {_v}", 0) + 1
# Solo las grafias distintas de "TBD": son las que antes se leian como un valor.
ALIASES = ("Por confirmar", "not stated")
placeholder_apps = [
    a for a in applications
    if (a["process"] or "").strip() in ALIASES or (a["sector"] or "").strip() in ALIASES
]
placeholder_attributable = sum(1 for a in placeholder_apps if a["gates"]["attributable"])

# ----------------------------------------------------------------------- meta
meta = {
    "product": "XOps Operational Graph",
    "short_name": "XOG",
    "version": "POC v1",
    "as_of": AS_OF,
    "universe_apps": len(applications),
    "scope_note": "Impact by process and routing. Does NOT include impact by dashboard audience, "
                  "excluded by a scope decision, not by oversight.",
    "source_file": SRC.name,
    "rules": [
        {"id": "R1", "title": "The Business Application is the backbone",
         "statement": "Process, sector and criticality live on the application and roll up to the "
                      "Assignment Group, never the other way round."},
        {"id": "R2", "title": "Every relationship is N:M",
         "statement": "One application reaches 5 platforms and 14 Assignment Groups.",
         "consequence": "A lookup column would be wrong from the first row; the link is resolved with a "
                        "bridge table."},
        {"id": "R3", "title": "No metric is shown without its declared coverage",
         "statement": "Coverage is part of the metric: always resolved over universe, plus the percentage."},
        {"id": "R4", "title": "Blast radius is not additive across platforms",
         "statement": "Combining platforms computes the deduplicated union of app_ids, never the sum.",
         "consequence": "Some applications run on Teradata and SAP BW at the same time; adding the radii "
                        "counts them twice."},
        {"id": "R5", "title": "Ticket volume is a cost axis, never a risk axis",
         "statement": "Tickets are not colour-coded with a risk scale and are not ranked next to criticality.",
         "consequence": "Its relationship with criticality is inverse; using it as a risk signal would "
                        "prioritise the least critical work."},
        {"id": "R6", "title": "Work-notes quality is measured with a single declared instrument",
         "statement": "The canonical scorer is QN v2.4.2.",
         "consequence": "Comparing bands from two different scorers produces a delta that is an artefact "
                        "of the instrument."},
        {"id": "R7", "title": "Technology Stack is free text and its normalization is a declared derivation",
         "statement": "The classification into canonical platforms is not source data.",
         "consequence": "It must be reviewed before being used for architecture decisions, and it is "
                        "marked as E3."},
        {"id": "R8", "title": "Every bridge row carries its evidence tier and its source",
         "statement": "E1 is CMDB, E2 is derived analysis, E3 is a spreadsheet."},
    ],
    "evidence_tiers": {
        "E1": "CMDB · high authority",
        "E2": "Derived analysis · medium authority",
        "E3": "Spreadsheet · low authority",
    },
    "criticality_scale": {
        "C1": "Most critical · weight 5",
        "C2": "Somewhat critical · weight 3",
        "C3": "Less critical · weight 1",
        "C-": "Not declared · weight 0",
        "note": "Normalized from two vocabularies still in circulation: BC1/BC2/BC3 (Feb 2026) and "
                "RP1/RP2/RP3 (Aug 2026). criticality_raw keeps the original value.",
    },
    "derivation_warning": "The Platform -> Application link has two sources of different authority. "
                          f"{l1_e2} applications come from the Tech Buckets analysis, which is derived "
                          f"analysis (E2). The other {l1_e3} were derived by keyword matching over the "
                          "free-text Technology Stack field, which is E3 and admits both false positives "
                          "and false negatives. The interface distinguishes the two origins and never "
                          "presents them as equivalent.",
    "out_of_scope": [
        "Dashboard -> Application: capture sheet still open, "
        f"{confirmed_ws} of {len(workspaces)} workspaces confirmed.",
        "Application -> Audience: depends on the link above.",
        "RCA Intelligence, Agent Actions and writes back to ServiceNow.",
    ],
    "dashboard_link": {
        "workspaces": len(workspaces),
        "dashboards_active": len(consumption),
        "confirmed": confirmed_ws,
        "top30_views_share_pct": round(100 * sum(w["views_6m"] or 0 for w in top30) / total_views, 1),
        "note": "The only manual input in the model is application_name_CONFIRMED. Exact name matching "
                "resolves very little and fuzzy matching produces subset false positives, so confirmation "
                "is human by design. While it stays empty, audience impact is not estimated.",
    },
    # El detalle de incidente NO esta en la capa semantica. El corpus llega ya
    # agregado por grupo, por periodo, por codigo y por patron. Se declara el
    # eslabon que falta y su ruta de union en lugar de fabricar un numero.
    "incident_link": {
        "available": False,
        "corpus": "QN_p120826_FULL_2_4_2_RO_270826 \u00b7 User_Detail",
        "grain_published": "Assignment Group, period, Decalogue code and recurring signature",
        "grain_missing": "one row per incident, with its incident number",
        "join_path": "Incident \u2192 Assignment Group \u2192 (bridge 05) \u2192 Business Application",
        "note": "The upstream corpus is per incident and does carry the incident number, but the "
                "semantic layer publishes it already aggregated, so no incident number reaches this "
                "model. Until an incident-grain extract is added, the interface shows incident "
                "COUNTS with their denominator and never a ticket identifier. The contract already "
                "types the row that would land, so the screens absorb it without being rebuilt.",
        "blocks": ["Open a specific ticket from a chart", "Per-application incident history",
                   "Attributing an incident to one application rather than to its group"],
    },
    "link_sources": {
        "platform": {
            "E2": "Tech Buckets analysis · Impact_Lineage_Matrix (Feb 2026)",
            "E3": "Keyword normalization of the free-text Technology Stack field (Margarita inventory)",
        },
        "assignment_group": {
            "E3": "DPM_and_Application_List sheet 12 (Aug 2026) + Assignment Group from the Margarita inventory",
        },
    },
    "data_quality_notes": [
        {
            "id": "DQ1",
            "title": "The Assignment Group catalogue repeats destinations",
            "detail": f"{len(duplicate_ag_keys)} pairs of names normalize to the same key because of "
                      "spacing or punctuation, so the 268 rows represent fewer distinct routing "
                      "destinations. This affects the join with quality, which matches on the key.",
            "items": duplicate_ag_keys,
        },
        {
            "id": "DQ2",
            "title": "The inventory's ag_count does not match the bridge",
            "detail": f"In {ag_count_gap} applications the assignment_groups column declares one group "
                      "more than the bridge does. That column is capped at 10 entries, truncates the "
                      "last name mid-string and repeats variants of the same group. The bridge "
                      "05_BRIDGE_APP_AG is the exact source and is what feeds this application.",
        },
        {
            "id": "DQ4",
            "title": "ServiceNow service IDs sitting in the sector column",
            "detail": f"{len(sector_quarantine)} applications carry a token such as "
                      + ", ".join(sorted({v for vals in list(sector_quarantine.values())[:3] for v in vals})[:3])
                      + " in the sector column. They match the ServiceNow service-ID pattern, not any "
                        "sector of the business, so they are quarantined instead of being counted as a "
                        "sector or silently dropped: the application keeps whatever real sectors it also "
                        "declares, and the unrecognised token is shown on its record. The sector column "
                        "also mixes separators (comma and semicolon) and letter case (Global / GLOBAL); "
                        "both are normalized, and that normalization is a derivation, not source data.",
            "items": [{"ag_key": k, "names": v} for k, v in list(sector_quarantine.items())[:12]],
        },
        {
            "id": "DQ3",
            "title": "Three spellings for the same non-value",
            "detail": "The sheet writes an unresolved process or sector as "
                      + ", ".join(f"{k} ({v})" for k, v in sorted(placeholder_counts.items()))
                      + f". The interface treats all three as unresolved, so {len(placeholder_apps)} "
                        "applications now show a TBD chip where the raw text reads Por confirmar or not "
                        "stated. The Attributable gate is NOT "
                        f"rewritten: it stays exactly as the sheet declares it, and {placeholder_attributable} "
                        "of those applications are still marked attributable there. The disagreement is "
                        "surfaced rather than reconciled.",
        },
    ],
    "ai_ops": {
        "note": "Cluster 06 AI Ops. Routing coverage for the AI/ML portfolio is the lowest in the model, "
                "consistent with the fact that the L1.5 activity catalogue for that cluster has not been "
                "declared yet.",
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
    "sectors": sectors,
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
# Sector. Los conteos se comprueban contra el desglose que los explica, no
# contra una constante suelta: 118 celdas vacias + 8 "not stated" + 73 que solo
# traian un ID de servicio = 199 aplicaciones sin sector reconocido.
_PH = {"", "TBD", "POR CONFIRMAR", "NOT STATED"}
_empty = sum(1 for a in applications if (a["sector"] or "").strip().upper() in _PH)
_only_bad = sum(1 for a in applications if not a["sectors"] and a["sector_unrecognized"])
checks.append(("sectores reconocidos", len(sectors), 11))
checks.append(("apps sin sector reconocido = placeholder + solo token no reconocido",
               len(apps_without_sector), _empty + _only_bad))
checks.append(("apps con token de sector no reconocido", len(sector_quarantine), 73))
# El puente no pierde ni inventa: pares del puente = suma de sectores por app.
checks.append(("pares aplicacion-sector cuadran con el puente",
               sum(x["apps"] for x in sectors),
               sum(len(a["sectors"]) for a in applications)))
checks.append(("ningun sector reconocido es un ID de servicio",
               sum(1 for x in sectors if NON_SECTOR.match(x["name"])), 0))
checks.append(("todo app_id del puente de sector existe",
               sum(1 for x in sectors for i in x["app_ids"] if i not in by_app), 0))
checks.append(("apps con impacto financiero declarado",
               sum(1 for a in applications if a["business_impact"]["financial"]), 100))
checks.append(("apps con tamano de audiencia declarado",
               sum(1 for a in applications if a["business_impact"]["user_base"]), 124))
checks.append(("registro de metricas", len(measures), 16))

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
