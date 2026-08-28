#!/usr/bin/env python3
"""
Step 1.5 - label-free evaluation of the relationship-discovery evidence.

Runs ONLY measurements that need no Incident -> Application label.
No accuracy, no precision, no recall, no probability. Ground truth for
Incident -> Application is NOT AVAILABLE (see report).

Input: data/xops-operational-graph-data.json (the loaded semantic layer).
Nothing is written back. Read-only.
"""
import json, re, collections, statistics, sys

D = json.load(open("data/xops-operational-graph-data.json"))
APPS = D["applications"]
AGROWS = {g["name"]: g for g in D["assignment_groups"]}
PLATS = D["platforms"]
QAG = D["quality"]["by_assignment_group"]

APP_BY_ID = {a["app_id"]: a for a in APPS}
canon = lambda n: re.sub(r"[^A-Z0-9]", "", (n or "").upper())
agkey = lambda n: AGROWS[n]["ag_key"] if n in AGROWS else canon(n)

out = []
def h(t):  out.append("\n" + "=" * 72 + "\n" + t + "\n" + "=" * 72)
def p(*a): out.append(" ".join(str(x) for x in a))
def pct(x, n): return f"{100.0*x/n:.1f}%" if n else "n/a"


# ---------------------------------------------------------------- section 1
h("1. PARTITION RECONCILIATION - what 'unique support route' means")

by_key = collections.defaultdict(set)
for a in APPS:
    for g in a["ags"]:
        by_key[agkey(g)].add(a["app_id"])
by_name = collections.defaultdict(set)
for a in APPS:
    for g in a["ags"]:
        by_name[g].add(a["app_id"])

def partition(index, keyfn, test):
    u = s = n = 0
    for a in APPS:
        if not a["ags"]:
            n += 1
        elif test(a, index, keyfn):
            u += 1
        else:
            s += 1
    return u, s, n

ANY   = lambda a, ix, kf: any(len(ix[kf(g)]) == 1 for g in a["ags"])
ALL   = lambda a, ix, kf: all(len(ix[kf(g)]) == 1 for g in a["ags"])
INTER = lambda a, ix, kf: set.intersection(*[ix[kf(g)] for g in a["ags"]]) == {a["app_id"]}

p(f"{'definition':<46}{'unique':>8}{'shared':>8}{'no route':>10}")
for label, ix, kf, t in [
    ("canonical AG key - ANY AG is a singleton", by_key, agkey, ANY),
    ("canonical AG key - EVERY AG is a singleton", by_key, agkey, ALL),
    ("canonical AG key - intersection == the app", by_key, agkey, INTER),
    ("raw AG name  - ANY AG is a singleton", by_name, lambda g: g, ANY),
    ("raw AG name  - EVERY AG is a singleton", by_name, lambda g: g, ALL),
    ("raw AG name  - intersection == the app", by_name, lambda g: g, INTER),
]:
    u, s, n = partition(ix, kf, t)
    p(f"{label:<46}{u:>8}{s:>8}{n:>10}")
p("\nStep-1 headline 102 / 210 / 192 == canonical key + ANY-singleton (the most")
p("optimistic of the six). The strictest reading gives 37 unique, not 102.")


# ---------------------------------------------------------------- section 2
h("2. G1  ASSIGNMENT GROUP -> APPLICATION : candidate-set profile")

sizes = {k: len(v) for k, v in by_key.items()}
vals = sorted(sizes.values())
p(f"AG keys that reach >=1 application : {len(vals)}")
p(f"  |candidates| == 1                : {sum(1 for v in vals if v==1)}  ({pct(sum(1 for v in vals if v==1), len(vals))})")
p(f"  |candidates| 2-5                 : {sum(1 for v in vals if 2<=v<=5)}")
p(f"  |candidates| 6-20                : {sum(1 for v in vals if 6<=v<=20)}")
p(f"  |candidates| > 20                : {sum(1 for v in vals if v>20)}")
p(f"  median {statistics.median(vals)}  p90 {vals[int(.9*len(vals))]}  max {max(vals)}")
p(f"AG rows in the catalogue with zero applications: {sum(1 for g in AGROWS.values() if g['app_count']==0)} of {len(AGROWS)}")

p("\nGROUP-weighted is not the operational question. Incidents are not uniform")
p("across groups, so weight by declared incident volume at AG grain.")

qtot = sum(r["incidents"] for r in QAG)
buckets = collections.Counter(); binc = collections.Counter()
unmatched_inc = 0; unmatched_rows = 0
matched_rows = 0
detail = []
for r in QAG:
    k = r["ag_key"]; inc = r["incidents"]
    if k not in by_key:
        unmatched_inc += inc; unmatched_rows += 1
        continue
    matched_rows += 1
    n = len(by_key[k])
    b = "1" if n == 1 else "2-5" if n <= 5 else "6-20" if n <= 20 else ">20"
    buckets[b] += 1; binc[b] += inc
    detail.append((inc, n, r["name"]))

p(f"\nQuality catalogue: {len(QAG)} AG rows, {qtot:,} incidents (declared at AG grain).")
p(f"  AG rows that join the app bridge : {matched_rows}  ({pct(matched_rows,len(QAG))})")
p(f"  AG rows with no application at all: {unmatched_rows}  -> {unmatched_inc:,} incidents "
  f"({pct(unmatched_inc,qtot)}) reach ZERO candidates")
p("\nIncident-weighted candidate-set size, over the joined incidents:")
joined = qtot - unmatched_inc
p(f"{'|candidates|':<14}{'AG rows':>9}{'incidents':>12}{'% of joined':>13}{'% of catalogue':>16}")
for b in ["1", "2-5", "6-20", ">20"]:
    p(f"{b:<14}{buckets[b]:>9}{binc[b]:>12,}{pct(binc[b],joined):>13}{pct(binc[b],qtot):>16}")
p(f"{'unresolved':<14}{unmatched_rows:>9}{unmatched_inc:>12,}{'-':>13}{pct(unmatched_inc,qtot):>16}")

p("\nTop 12 AG rows by incident volume, with the candidate set AG alone yields:")
p(f"{'incidents':>10}  {'|cand|':>6}  assignment group")
for inc, n, name in sorted(detail, reverse=True)[:12]:
    p(f"{inc:>10,}  {n:>6}  {name}")
p("\nTop 8 unjoined AG rows by volume (AG reaches no application):")
un = sorted(((r["incidents"], r["name"]) for r in QAG if r["ag_key"] not in by_key), reverse=True)[:8]
for inc, name in un:
    p(f"{inc:>10,}  {'0':>6}  {name}")


# ---------------------------------------------------------------- section 3
h("3. G4  GRAPH-MEDIATED : AG -> applications -> platforms -> applications")

apps_of_plat = collections.defaultdict(set)
for a in APPS:
    for pl in a["platforms"]:
        apps_of_plat[pl].add(a["app_id"])

direct_t = mediated_t = 0
rows = []
for k, direct in by_key.items():
    plats = {pl for aid in direct for pl in APP_BY_ID[aid]["platforms"]}
    med = set().union(*[apps_of_plat[pl] for pl in plats]) if plats else set()
    med |= direct
    rows.append((k, len(direct), len(med)))
gain = [(k, a, b) for k, a, b in rows if b > a]
p(f"AG keys where platform mediation adds candidates: {len(gain)} of {len(rows)}")
p(f"AG keys where it adds nothing (no platform declared): {len(rows)-len(gain)}")
med_sizes = sorted(b for _, _, b in rows)
p(f"direct   : median {statistics.median([a for _,a,_ in rows])}  p90 {sorted(a for _,a,_ in rows)[int(.9*len(rows))]}  max {max(a for _,a,_ in rows)}")
p(f"mediated : median {statistics.median(med_sizes)}  p90 {med_sizes[int(.9*len(med_sizes))]}  max {max(med_sizes)}")

d1 = sum(1 for _, a, _ in rows if a == 1)
m1 = sum(1 for _, _, b in rows if b == 1)
p(f"AG keys yielding EXACTLY ONE candidate: direct {d1} -> mediated {m1}  (change {m1-d1})")

inc_direct = collections.Counter(); inc_med = collections.Counter()
for r in QAG:
    k = r["ag_key"]
    if k not in by_key: continue
    direct = by_key[k]
    plats = {pl for aid in direct for pl in APP_BY_ID[aid]["platforms"]}
    med = (set().union(*[apps_of_plat[pl] for pl in plats]) if plats else set()) | direct
    f = lambda n: "1" if n == 1 else "2-5" if n <= 5 else "6-20" if n <= 20 else ">20"
    inc_direct[f(len(direct))] += r["incidents"]; inc_med[f(len(med))] += r["incidents"]
p("\nIncident-weighted, joined incidents only:")
p(f"{'|candidates|':<14}{'direct':>14}{'+platform hop':>16}")
for b in ["1", "2-5", "6-20", ">20"]:
    p(f"{b:<14}{inc_direct[b]:>14,}{inc_med[b]:>16,}")
p("\nThe platform hop is an EXPANSION operator on this corpus: it can only add")
p("candidates, never remove them. It buys reach into apps AG cannot see, at the")
p("cost of ambiguity. Useful as corroboration for a candidate another signal")
p("already nominated; not usable as a standalone resolver.")


# ---------------------------------------------------------------- section 4
h("4. NORMALIZATION LADDER - coverage gained vs collisions introduced")

ENV = {"PROD","PRD","PRODUCTION","DEV","TEST","QA","UAT","NONPROD","NON","PRE","STG","STAGE","SANDBOX"}
REG = {"US","USA","CANADA","LATAM","EMEA","APAC","AMESA","EUROPE","MEXICO","BRAZIL","GLOBAL",
       "ESSA","GREATER","CHINA","INDIA","ENGLISH","SPANISH","FRENCH"}

def n1(x): return re.sub(r"\s+", " ", (x or "").upper()).strip()
def n2(x): return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9 ]", " ", n1(x))).strip()
def n3(x): return re.sub(r"\s*-\s*SO$", "", n1(x)).strip()
def n4(x):
    t = n2(n3(x)).split()
    while t and t[-1] in ENV: t.pop()
    return " ".join(t)
def n5(x):
    t = n4(x).split()
    while t and (t[-1] in ENV or t[-1] in REG): t.pop()
    return " ".join(t)
def n6(x): return canon(n3(x))

LADDER = [("N0 raw", lambda x: x or ""), ("N1 case+whitespace", n1),
          ("N2 +punctuation", n2), ("N3 +strip ' - SO'", n3),
          ("N4 +strip env suffix", n4), ("N5 +strip region suffix", n5),
          ("N6 alnum-only (model AG normalizer)", n6)]

app_names = [a["name"] for a in APPS]
ag_names = sorted({g for a in APPS for g in a["ags"]})
plat_names = [pl["name"] for pl in PLATS]

p(f"{'rule':<38}{'app keys':>9}{'collide':>9}{'AG hits':>9}{'plat hits':>10}")
prev_ag = None
for label, f in LADDER:
    keys = [f(x) for x in app_names]
    dis = len(set(k for k in keys if k))
    coll = len(app_names) - dis
    aset = set(k for k in keys if k)
    aghit = sum(1 for g in ag_names if f(g) in aset)
    plhit = sum(1 for pl in plat_names if f(pl) in aset)
    p(f"{label:<38}{dis:>9}{coll:>9}{aghit:>9}{plhit:>10}")

p("\nCollisions introduced by the aggressive rules (N5), examples:")
m = collections.defaultdict(list)
for a in APPS: m[n5(a["name"])].append(a["name"])
shown = 0
for k, v in m.items():
    if len(v) > 1 and k:
        p(f"  '{k}'  <-  {v}")
        shown += 1
        if shown == 8: break
p("\nReading: N1-N4 and N6 introduce ZERO collisions on the 504-name namespace,")
p("so they are safe - but on the namespaces that ARE loaded they gain almost")
p("nothing (3-4 cross-namespace hits out of 250 AG names). N5, the region-suffix")
p("strip, is the first rule that costs more than it returns: +3 cross-namespace")
p("hits, -3 distinct applications. It must not be adopted.")
p("The Service Offering values that motivated this ladder are NOT in the loaded")
p("corpus, so the coverage side of the table cannot be completed here - only the")
p("collision side. The ' - SO' strip is safe here; its reported 0% -> 6.4% payoff")
p("was measured elsewhere and is not reproducible in this container.")


# ---------------------------------------------------------------- section 5
h("5. CROSS-NAMESPACE OVERLAP - is an AG name an application name?")

aset = {n3(a["name"]) for a in APPS}
pset = {n3(pl["name"]) for pl in PLATS}
exact_ag = [g for g in ag_names if n3(g) in aset]
p(f"AG names that are exactly an application name (N3): {len(exact_ag)} of {len(ag_names)}  ({pct(len(exact_ag),len(ag_names))})")
for g in exact_ag[:10]: p(f"  {g}")
p(f"\nApplication names that are exactly a platform name (N3): "
  f"{sum(1 for a in APPS if n3(a['name']) in pset)}")
p("The three namespaces are almost disjoint by name. String identity between")
p("them is not a usable bridge; the bridges in this corpus are declared tables.")


# ---------------------------------------------------------------- section 6
h("6. ENTITY-SPACE CLASSIFICATION OF AG NAMES  (HEURISTIC - not declared)")

LEX = [
    ("SERVICE",        {"SERVICE DESK","SERVICEDESK","HELP DESK","SUPPORT","SERVICE OFFERING"," - SO"}),
    ("INFRASTRUCTURE", {"VMWARE","VCENTER","LINUX","WINDOWS","SERVER","NETWORK","STORAGE","BACKUP",
                        "COMPUTE","CITRIX","VDI","DATA CENTER","DATACENTER"," DC ","MAINFRAME","MIDDLEWARE"}),
    ("DATABASE",       {"ORACLE","SQL","TERADATA","HANA","POSTGRES","MONGO","DB2","SNOWFLAKE","DATABASE"}),
    ("PLATFORM",       {canon(pl["name"]) for pl in PLATS}),
]
def classify(name):
    u = " " + n1(name) + " "; c = canon(name)
    hits = []
    for dom, toks in LEX:
        for t in toks:
            if dom == "PLATFORM":
                if t and t in c and len(t) > 3: hits.append(dom); break
            elif t in u: hits.append(dom); break
    if n3(name) in aset: hits.append("APPLICATION")
    if not hits: return "UNKNOWN", []
    return hits[0], hits

dist = collections.Counter(); multi = 0
for g in ag_names:
    d, hits = classify(g)
    dist[d] += 1
    if len(set(hits)) > 1: multi += 1
p(f"{len(ag_names)} distinct AG names carried by applications")
for k, v in dist.most_common():
    p(f"  {k:<16}{v:>5}  {pct(v,len(ag_names))}")
p(f"  (names matching more than one domain: {multi})")
p("\nThis is a lexicon heuristic over names. It is NOT declared metadata and")
p("must not be promoted. Its only legitimate use is to show that the AG name")
p("space is mostly service/support naming, not application naming - which is")
p("why direct string matching from a ticket to an application fails.")


# ---------------------------------------------------------------- section 7
h("7. CANDIDATE-SET REDUCTION vs THE 504-APPLICATION PRIOR")

p("Reduction is reported as the share of the portfolio eliminated, not as a")
p("probability of being right.")
p(f"\n{'signal':<44}{'median |cand|':>14}{'reduction':>11}")
def red(n): return f"{100.0*(1-n/504):.2f}%"
med_direct = statistics.median([len(v) for v in by_key.values()])
p(f"{'prior (no signal)':<44}{504:>14}{red(504):>11}")
p(f"{'AG -> apps (declared bridge)':<44}{med_direct:>14.0f}{red(med_direct):>11}")
p(f"{'AG -> apps -> platform -> apps':<44}{statistics.median(med_sizes):>14.0f}{red(statistics.median(med_sizes)):>11}")
p("\nA median of 1 candidate is NOT a 99.8% chance of being correct. It is a")
p("statement about set size only. Correctness is unmeasurable without a label.")

print("\n".join(out))


# ---------------------------------------------------------------- section 8
out2 = []
def h2(t): out2.append("\n" + "=" * 72 + "\n" + t + "\n" + "=" * 72)
def p2(*a): out2.append(" ".join(str(x) for x in a))

h2("8. G5  FREE TEXT -> APPLICATION, on the only text corpus that is loaded")

RP = D["quality"]["recurring_patterns"]
rp_inc = sum(r["incidents"] for r in RP)
p2(f"200 recurring signatures, {rp_inc:,} incidents "
   f"({100.0*rp_inc/233834:.1f}% of the AG-grain quality table).")

# normalized text matching: full application name as a token-boundary substring
def norm_text(x): return " " + re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9]", " ", (x or "").upper())).strip() + " "
APP_TOK = []
for a in APPS:
    k = norm_text(a["name"]).strip()
    if len(k) >= 4:
        APP_TOK.append((" " + k + " ", a["app_id"], a["name"]))

def text_candidates(txt):
    t = norm_text(txt)
    return {aid for k, aid, _ in APP_TOK if k in t}

sig_hits = collections.Counter(); sig_inc = collections.Counter()
examples = []
for r in RP:
    c = text_candidates(r["example"] + " " + r["sig"])
    n = len(c)
    b = "0" if n == 0 else "1" if n == 1 else "2-5" if n <= 5 else ">5"
    sig_hits[b] += 1; sig_inc[b] += r["incidents"]
    if n: examples.append((r["incidents"], n, r["example"][:70], [APP_BY_ID[x]["name"] for x in list(c)[:3]]))

p2(f"\n{'|candidates|':<14}{'signatures':>12}{'incidents':>12}{'% incidents':>13}")
for b in ["0", "1", "2-5", ">5"]:
    p2(f"{b:<14}{sig_hits[b]:>12}{sig_inc[b]:>12,}{100.0*sig_inc[b]/rp_inc:>12.1f}%")
p2("\nSignatures where the text names an application (top by volume):")
for inc, n, ex, names in sorted(examples, reverse=True)[:8]:
    p2(f"  {inc:>7,}  |cand|={n}  {ex}")
    p2(f"           -> {names}")
if not examples:
    p2("  (none - no recurring signature spells out a Business Application name)")

# --- what happens if the matcher is loosened, which is the tempting next move
p2("\nLOOSENING THE MATCHER - the false-positive demonstration")
STOPW = {"DATA","GLOBAL","PROD","SYSTEM","REPORT","ANALYTICS","DIGITAL","SUPPORT",
         "SALES","MANAGEMENT"}
tok_idx = collections.defaultdict(set)
for a in APPS:
    for w in norm_text(a["name"]).split():
        if len(w) >= 5 and w not in STOPW:
            tok_idx[w].add(a["app_id"])
loose_sig = loose_inc = 0
drv = collections.Counter(); drv_inc = collections.Counter()
for r in RP:
    ws = set(norm_text(r["example"] + " " + r["sig"]).split()) & set(tok_idx)
    if ws:
        loose_sig += 1; loose_inc += r["incidents"]
        for w in ws:
            drv[w] += 1; drv_inc[w] += r["incidents"]
p2(f"strict (full application name)      : 0 of 200 signatures, 0 incidents")
p2(f"loose (any distinctive name token)  : {loose_sig} of 200 signatures, {loose_inc:,} incidents "
   f"({100.0*loose_inc/rp_inc:.1f}%)")
p2("\nTokens that produce that coverage:")
p2(f"  {'token':<14}{'signatures':>11}{'incidents':>11}{'apps claimed':>14}")
for w, c in drv.most_common(10):
    p2(f"  {w:<14}{c:>11}{drv_inc[w]:>11,}{len(tok_idx[w]):>14}")
p2("\nEvery one of the top drivers is a generic English or region word - MOBILE,")
p2("AMESA, INDIA, ORDER, APPLICATION, MONITORING. Loosening the matcher moved")
p2("coverage from 0% to 66.5% of signatures and produced no identifying evidence")
p2("whatsoever. This is the false-positive cost the brief asks to weigh, measured")
p2("rather than asserted: coverage is trivially purchasable and worth nothing on")
p2("its own.")

p2("\nText matching on this corpus is a ZERO-COVERAGE signal, not the")
p2("high-coverage / high-ambiguity signal reported from the ticket sample.")
p2("The two are not comparable: recurring signatures are stemmed, deduplicated")
p2("machine text, and Short Description is raw per-ticket text that is not")
p2("loaded here. Neither result transfers to the other.")


# ---------------------------------------------------------------- section 9
h2("9. EVIDENCE CONVERGENCE AND CONFLICT  (G1 x G5, signature grain)")

agree = conflict = only_ag = only_txt = neither = 0
ai = ci = oai = oti = ni = 0
conf_ex = []
for r in RP:
    k = canon(r["top_ag"])
    ag_c = by_key.get(k, set())
    tx_c = text_candidates(r["example"] + " " + r["sig"])
    inc = r["incidents"]
    if ag_c and tx_c:
        if ag_c & tx_c: agree += 1; ai += inc
        else:
            conflict += 1; ci += inc
            conf_ex.append((inc, r["top_ag"], [APP_BY_ID[x]["name"] for x in list(ag_c)[:2]],
                            [APP_BY_ID[x]["name"] for x in list(tx_c)[:2]], r["example"][:60]))
    elif ag_c: only_ag += 1; oai += inc
    elif tx_c: only_txt += 1; oti += inc
    else: neither += 1; ni += inc

p2(f"{'outcome':<34}{'signatures':>12}{'incidents':>12}{'%':>8}")
for lab, n, i in [("CONVERGENCE (sets intersect)", agree, ai),
                  ("CONFLICT (both non-empty, disjoint)", conflict, ci),
                  ("AG only", only_ag, oai),
                  ("text only", only_txt, oti),
                  ("UNRESOLVED (neither)", neither, ni)]:
    p2(f"{lab:<34}{n:>12}{i:>12,}{100.0*i/rp_inc:>7.1f}%")

p2("\nConflict examples (the two signals nominate disjoint applications):")
for inc, ag, a1, a2, ex in sorted(conf_ex, reverse=True)[:5]:
    p2(f"  {inc:>7,}  AG '{ag}' -> {a1}")
    p2(f"           text '{ex}' -> {a2}")

p2(f"\nConvergence: {agree} signatures. Conflict: {conflict} signatures. Both zero,")
p2("and not because the signals agree - because they never both fire. On the")
p2("loaded corpus exactly one generator ever produces a candidate, so there is")
p2("nothing to combine. EVIDENCE CONVERGENCE and EVIDENCE CONFLICT are therefore")
p2("NOT MEASURABLE here. The ensemble question the brief asks - how much")
p2("ambiguity is resolved by combining independent evidence - cannot be answered")
p2("against this container's data at all, in either direction.")
p2("\nMeasurement limit: top_ag is the modal group for a signature, not the group")
p2("of any individual incident, so even a non-zero result would have bounded the")
p2("shape of convergence rather than measured it per ticket. And convergence is")
p2("not correctness: two signals can agree and both be wrong. Without a label")
p2("that stays unknowable.")
p2(f"\nSignatures whose incidents span more than one AG: "
   f"{sum(1 for r in RP if r['ags'] > 1)} of 200 - for those, top_ag is a majority vote.")

print("\n".join(out2))
