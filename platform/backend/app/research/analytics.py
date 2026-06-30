"""
Analytics for the comparative usability study.

Produces the descriptive + paired (within-subject) statistics that drive the
researcher dashboard, and the tidy one-row-per-participant CSV export.

Note on inference: we report the paired t-statistic, degrees of freedom,
Cohen's d_z, and a 95% CI computed with a normal approximation (z=1.96).
Exact p-values should be obtained from the exported CSV in a stats package;
we deliberately avoid bundling a t-distribution implementation here.
"""
import statistics
from math import sqrt

from sqlalchemy.orm import Session, selectinload

from app.research.models import (
    ResearchParticipant, TaskAttempt, WorkloadAssessment, UsabilityAssessment,
    ExplorationMetric, ParticipantStatus, InterfaceArm,
)
from app.research import study as study_def

ARMS = [InterfaceArm.traditional, InterfaceArm.relational]
SUBSCALES = ["mental_demand", "physical_demand", "temporal_demand",
             "performance", "effort", "frustration"]


def _mean(xs):
    return round(statistics.fmean(xs), 2) if xs else None


def _sd(xs):
    return round(statistics.stdev(xs), 2) if len(xs) > 1 else 0.0


def _paired_stats(pairs):
    """pairs: list of (traditional_value, relational_value)."""
    diffs = [rel - trad for trad, rel in pairs]
    n = len(diffs)
    if n == 0:
        return {"n": 0}
    mean_diff = statistics.fmean(diffs)
    sd = statistics.stdev(diffs) if n > 1 else 0.0
    se = sd / sqrt(n) if (n > 1 and sd > 0) else 0.0
    t = round(mean_diff / se, 3) if se > 0 else None
    dz = round(mean_diff / sd, 3) if sd > 0 else None
    ci = [round(mean_diff - 1.96 * se, 2), round(mean_diff + 1.96 * se, 2)] if se > 0 else None
    return {
        "n": n,
        "mean_traditional": round(statistics.fmean([t_ for t_, _ in pairs]), 2),
        "mean_relational": round(statistics.fmean([r_ for _, r_ in pairs]), 2),
        "mean_diff": round(mean_diff, 2),
        "sd_diff": round(sd, 2),
        "se_diff": round(se, 3),
        "t": t,
        "df": n - 1,
        "cohens_dz": dz,
        "ci95_approx": ci,
    }


def _per_participant_arm_value(attempts, arm, field):
    """Mean of an attempt field for a participant within one arm."""
    vals = [getattr(a, field) for a in attempts if a.interface == arm]
    return statistics.fmean(vals) if vals else None


def _per_participant_accuracy(attempts, arm):
    vals = [1.0 if a.correct else 0.0 for a in attempts if a.interface == arm]
    return (statistics.fmean(vals) * 100) if vals else None


def compute_summary(db: Session) -> dict:
    participants = (
        db.query(ResearchParticipant)
        .options(
            selectinload(ResearchParticipant.attempts),
            selectinload(ResearchParticipant.assessments),
        )
        .all()
    )
    n_total = len(participants)
    n_completed = sum(1 for p in participants if p.status == ParticipantStatus.completed)

    # ── Descriptive, per interface (pooled across participants) ──
    by_interface = {}
    for arm in ARMS:
        attempts = db.query(TaskAttempt).filter(TaskAttempt.interface == arm).all()
        assessments = db.query(WorkloadAssessment).filter(WorkloadAssessment.interface == arm).all()
        durations = [a.duration_ms for a in attempts]
        clicks = [a.click_count for a in attempts]
        acc = [1.0 if a.correct else 0.0 for a in attempts]
        tlx_block = {"n": len(assessments), "raw_tlx_mean": _mean([w.raw_tlx for w in assessments]),
                     "raw_tlx_sd": _sd([w.raw_tlx for w in assessments])}
        for s in SUBSCALES:
            tlx_block[s] = _mean([getattr(w, s) for w in assessments])
        by_interface[arm.value] = {
            "n_attempts": len(attempts),
            "accuracy_pct": round(statistics.fmean(acc) * 100, 1) if acc else None,
            "mean_duration_ms": _mean(durations),
            "mean_duration_sec": round(_mean(durations) / 1000, 1) if durations else None,
            "mean_clicks": _mean(clicks),
            "tlx": tlx_block,
        }

    # ── Paired (within-subject) comparisons ──
    tlx_pairs, dur_pairs, acc_pairs = [], [], []
    for p in participants:
        tlx_by_arm = {w.interface: w.raw_tlx for w in p.assessments}
        if InterfaceArm.traditional in tlx_by_arm and InterfaceArm.relational in tlx_by_arm:
            tlx_pairs.append((tlx_by_arm[InterfaceArm.traditional], tlx_by_arm[InterfaceArm.relational]))
        dt = _per_participant_arm_value(p.attempts, InterfaceArm.traditional, "duration_ms")
        dr = _per_participant_arm_value(p.attempts, InterfaceArm.relational, "duration_ms")
        if dt is not None and dr is not None:
            dur_pairs.append((dt / 1000, dr / 1000))  # seconds
        at = _per_participant_accuracy(p.attempts, InterfaceArm.traditional)
        ar = _per_participant_accuracy(p.attempts, InterfaceArm.relational)
        if at is not None and ar is not None:
            acc_pairs.append((at, ar))

    paired = {
        "raw_tlx": _paired_stats(tlx_pairs),
        "duration_sec": _paired_stats(dur_pairs),
        "accuracy_pct": _paired_stats(acc_pairs),
    }

    # ── Per-task breakdown (for task-level chart) ──
    tasks = []
    for t in study_def.TASKS:
        row = {"key": t["key"], "title": t["title"]}
        for arm in ARMS:
            ta = db.query(TaskAttempt).filter(
                TaskAttempt.task_key == t["key"], TaskAttempt.interface == arm
            ).all()
            acc = [1.0 if a.correct else 0.0 for a in ta]
            row[arm.value] = {
                "n": len(ta),
                "accuracy_pct": round(statistics.fmean(acc) * 100, 1) if acc else None,
                "mean_duration_sec": round(_mean([a.duration_ms for a in ta]) / 1000, 1) if ta else None,
            }
        tasks.append(row)

    return {
        "n_participants": n_total,
        "n_completed": n_completed,
        "by_interface": by_interface,
        "paired": paired,
        "tasks": tasks,
    }


def _sus_grade(mean) -> str | None:
    """Sauro-Lewis curved grade for a mean SUS score."""
    if mean is None:
        return None
    if mean >= 80.3:
        return "A"
    if mean >= 74:
        return "B"
    if mean >= 68:
        return "C"
    if mean >= 51:
        return "D"
    return "F"


def _sus_adjective(mean) -> str | None:
    """Bangor adjective rating for a mean SUS score."""
    if mean is None:
        return None
    if mean >= 85:
        return "Excellent"
    if mean >= 72:
        return "Good"
    if mean >= 52:
        return "OK"
    return "Poor"


def compute_usability(db: Session) -> dict:
    """Aggregate the post-study CareOS usability evaluation."""
    rows = db.query(UsabilityAssessment).all()
    sus_scores = [r.sus_score for r in rows if r.sus_score is not None]
    sus_mean = _mean(sus_scores)
    sus = {
        "n": len(sus_scores),
        "mean": sus_mean,
        "sd": _sd(sus_scores),
        "min": round(min(sus_scores), 1) if sus_scores else None,
        "max": round(max(sus_scores), 1) if sus_scores else None,
        "grade": _sus_grade(sus_mean),
        "adjective": _sus_adjective(sus_mean),
    }

    heuristics = []
    for h in study_def.HEURISTICS:
        vals = [float(r.heuristic_ratings[h["key"]]) for r in rows
                if r.heuristic_ratings and r.heuristic_ratings.get(h["key"]) is not None]
        heuristics.append({"key": h["key"], "name": h["name"],
                           "n": len(vals), "mean": _mean(vals), "sd": _sd(vals)})

    design = []
    for d in study_def.DESIGN_DIMENSIONS:
        vals = [float(r.design_ratings[d["key"]]) for r in rows
                if r.design_ratings and r.design_ratings.get(d["key"]) is not None]
        design.append({"key": d["key"], "label": d["label"],
                       "n": len(vals), "mean": _mean(vals), "sd": _sd(vals)})

    feedback = []
    for r in rows:
        item = {
            "participant_id": r.participant_id,
            "most_valuable": r.most_valuable,
            "missing_functions": r.missing_functions,
            "friction": r.friction,
            "general_comments": r.general_comments,
        }
        if any(item[k] for k in ("most_valuable", "missing_functions", "friction", "general_comments")):
            feedback.append(item)

    return {"n": len(rows), "sus": sus, "heuristics": heuristics,
            "design": design, "feedback": feedback}


def compute_exploration(db: Session) -> dict:
    """Aggregate the instrumented free-exploration phase.

    Compares the two styling conditions (neon vs generic) and, within them, how
    attention/clicks split between the relational and non-relational sections.
    """
    rows = db.query(ExplorationMetric).all()

    def _share(rel_total, non_total):
        tot = rel_total + non_total
        return round(rel_total / tot * 100, 1) if tot else None

    def _style_agg(style):
        rs = [r for r in rows if r.style == style]
        if not rs:
            return {"style": style, "n": 0, "mean_duration_sec": None,
                    "mean_scroll_pct": None, "mean_clicks": None,
                    "relational_attention_pct": None, "relational_clicks_pct": None}
        return {
            "style": style,
            "n": len(rs),
            "mean_duration_sec": round(_mean([r.duration_ms for r in rs]) / 1000, 1),
            "mean_scroll_pct": _mean([r.scroll_depth_pct for r in rs]),
            "mean_clicks": _mean([r.click_count for r in rs]),
            "relational_attention_pct": _share(
                sum(r.relational_attention_ms for r in rs),
                sum(r.nonrelational_attention_ms for r in rs)),
            "relational_clicks_pct": _share(
                sum(r.relational_clicks for r in rs),
                sum(r.nonrelational_clicks for r in rs)),
        }

    # Forced-choice design preference (per participant).
    pref = {"neon": 0, "generic": 0}
    for (sp,) in db.query(ResearchParticipant.style_preference).all():
        if sp in pref:
            pref[sp] += 1

    return {
        "n": len(rows),
        "by_style": [_style_agg("neon"), _style_agg("generic")],
        "relational_attention_pct": _share(
            sum(r.relational_attention_ms for r in rows),
            sum(r.nonrelational_attention_ms for r in rows)),
        "relational_clicks_pct": _share(
            sum(r.relational_clicks for r in rows),
            sum(r.nonrelational_clicks for r in rows)),
        "preference": pref,
    }


def csv_rows(db: Session):
    """Return (headers, rows) — one tidy row per participant."""
    participants = (
        db.query(ResearchParticipant)
        .options(
            selectinload(ResearchParticipant.attempts),
            selectinload(ResearchParticipant.assessments),
            selectinload(ResearchParticipant.usability),
        )
        .order_by(ResearchParticipant.id)
        .all()
    )
    headers = [
        "participant_code", "role", "specialty", "years_experience",
        "primary_ehr", "ehr_hours_per_week", "age_range", "style_preference", "condition_order", "status",
        "trad_tlx_raw", "rel_tlx_raw",
        "trad_accuracy_pct", "rel_accuracy_pct",
        "trad_mean_duration_sec", "rel_mean_duration_sec",
        "trad_total_clicks", "rel_total_clicks",
        "sus_score", "heuristics_mean", "design_mean",
    ]
    for s in SUBSCALES:
        headers += [f"trad_{s}", f"rel_{s}"]

    rows = []
    for p in participants:
        tlx = {w.interface: w for w in p.assessments}
        t, r = InterfaceArm.traditional, InterfaceArm.relational

        def dur(arm):
            v = _per_participant_arm_value(p.attempts, arm, "duration_ms")
            return round(v / 1000, 1) if v is not None else ""

        def clicks(arm):
            return sum(a.click_count for a in p.attempts if a.interface == arm)

        def acc(arm):
            v = _per_participant_accuracy(p.attempts, arm)
            return round(v, 1) if v is not None else ""

        row = [
            p.participant_code,
            p.role.value if p.role else "",
            p.specialty or "",
            p.years_experience if p.years_experience is not None else "",
            p.primary_ehr or "",
            p.ehr_hours_per_week if p.ehr_hours_per_week is not None else "",
            p.age_range or "",
            p.style_preference or "",
            p.condition_order.value,
            p.status.value,
            tlx[t].raw_tlx if t in tlx else "",
            tlx[r].raw_tlx if r in tlx else "",
            acc(t), acc(r),
            dur(t), dur(r),
            clicks(t), clicks(r),
        ]
        u = p.usability[0] if p.usability else None
        hmean = _mean([float(v) for v in u.heuristic_ratings.values()]) if (u and u.heuristic_ratings) else None
        dmean = _mean([float(v) for v in u.design_ratings.values()]) if (u and u.design_ratings) else None
        row += [
            u.sus_score if (u and u.sus_score is not None) else "",
            hmean if hmean is not None else "",
            dmean if dmean is not None else "",
        ]
        for s in SUBSCALES:
            row += [
                getattr(tlx[t], s) if t in tlx else "",
                getattr(tlx[r], s) if r in tlx else "",
            ]
        rows.append(row)
    return headers, rows
