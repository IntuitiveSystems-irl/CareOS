"""
Study protocol definition — the single source of truth for the comparative
EHR usability study.

Holds the synthetic patient chart (rendered identically by both interface
arms so the only manipulated variable is *presentation*), the task scenarios
(with server-side expected answers that are never sent to the client), the
NASA-TLX instrument, the qualitative prompts, and the informed-consent text.
"""
from copy import deepcopy

STUDY_META = {
    "title": (
        "Comparing Traditional and Relational Electronic Health Record "
        "Interfaces"
    ),
    "subtitle": (
        "A Convergent Mixed-Methods Comparative Usability Study of "
        "Clinician Cognitive Workload"
    ),
    "principal_investigator": "Lindsay Bachman",
    "institution": "University of Washington",
    "design": "convergent mixed-methods, within-subjects, counterbalanced",
    "arms": ["traditional", "relational"],
}

# ── Synthetic patient (no PHI) ───────────────────────────────────────────────
# Both interface arms render this exact chart. Cross-entity links (problem->med,
# encounter->labs, med->allergy) are encoded so that relational presentation can
# surface them directly while the traditional tabbed view forces manual lookup.
PATIENT = {
    "demographics": {
        "name": "Margaret R. Chen",
        "mrn": "SYN-4815162342",
        "sex": "Female",
        "dob": "1958-04-12",
        "age": 67,
    },
    "problems": [
        {"id": "P1", "name": "Type 2 Diabetes Mellitus", "onset": "2019-03-01", "status": "active", "med_ids": ["M1"]},
        {"id": "P2", "name": "Essential Hypertension", "onset": "2017-08-14", "status": "active", "med_ids": ["M2"]},
        {"id": "P3", "name": "Atrial Fibrillation", "onset": "2021-11-02", "status": "active", "med_ids": ["M4"]},
        {"id": "P4", "name": "Recurrent Urinary Tract Infection", "onset": "2025-04-20", "status": "active", "med_ids": ["M3"]},
        {"id": "P5", "name": "Hyperlipidemia", "onset": "2018-01-22", "status": "active", "med_ids": ["M5"]},
    ],
    "medications": [
        {"id": "M1", "name": "Metformin", "dose": "1000 mg", "sig": "BID", "treats": "P1"},
        {"id": "M2", "name": "Lisinopril", "dose": "20 mg", "sig": "daily", "treats": "P2"},
        {"id": "M3", "name": "Sulfamethoxazole-TMP", "dose": "800-160 mg", "sig": "BID x7d", "treats": "P4", "allergy_conflict": "A2"},
        {"id": "M4", "name": "Apixaban", "dose": "5 mg", "sig": "BID", "treats": "P3"},
        {"id": "M5", "name": "Atorvastatin", "dose": "40 mg", "sig": "daily", "treats": "P5"},
    ],
    "allergies": [
        {"id": "A1", "substance": "Penicillin", "reaction": "Rash", "severity": "moderate"},
        {"id": "A2", "substance": "Sulfa drugs (sulfonamides)", "reaction": "Hives, anaphylaxis", "severity": "severe"},
    ],
    "encounters": [
        {"id": "E1", "date": "2024-05-10", "type": "Office Visit", "reason": "Diabetes follow-up", "provider": "Dr. Alvarez", "lab_ids": ["L2"]},
        {"id": "E2", "date": "2024-11-15", "type": "Office Visit", "reason": "Annual physical", "provider": "Dr. Alvarez", "lab_ids": ["L1", "L3", "L4"]},
        {"id": "E3", "date": "2025-03-02", "type": "Urgent Care", "reason": "Chest pain", "provider": "Dr. Okafor", "lab_ids": ["L5", "L6"]},
        {"id": "E4", "date": "2025-04-20", "type": "Telehealth", "reason": "UTI symptoms", "provider": "Dr. Patel", "lab_ids": []},
    ],
    "labs": [
        {"id": "L1", "name": "Hemoglobin A1c", "value": "8.2", "unit": "%", "date": "2024-11-15", "flag": "H", "encounter_id": "E2"},
        {"id": "L2", "name": "Hemoglobin A1c", "value": "7.6", "unit": "%", "date": "2024-05-10", "flag": "H", "encounter_id": "E1"},
        {"id": "L3", "name": "LDL Cholesterol", "value": "142", "unit": "mg/dL", "date": "2024-11-15", "flag": "H", "encounter_id": "E2"},
        {"id": "L4", "name": "Potassium", "value": "5.1", "unit": "mmol/L", "date": "2024-11-15", "flag": "H", "encounter_id": "E2"},
        {"id": "L5", "name": "Troponin I", "value": "<0.01", "unit": "ng/mL", "date": "2025-03-02", "flag": "normal", "encounter_id": "E3"},
        {"id": "L6", "name": "BNP", "value": "45", "unit": "pg/mL", "date": "2025-03-02", "flag": "normal", "encounter_id": "E3"},
    ],
    "referrals": [
        {"id": "R1", "date": "2024-06-01", "specialty": "Ophthalmology", "provider": "Dr. Singh", "reason": "Diabetic retinopathy screening", "problem_id": "P1"},
        {"id": "R2", "date": "2025-03-05", "specialty": "Cardiology", "provider": "Dr. Reyes", "reason": "Atrial fibrillation management", "problem_id": "P3"},
    ],
}

# ── Tasks (expected answers are server-side only) ────────────────────────────
# Each task requires cross-referencing that is direct in a relational view but
# requires manual tab-switching + working memory in a traditional view.
TASKS = [
    {
        "key": "find_latest_a1c",
        "title": "Most recent A1c",
        "prompt": "What is the patient's MOST RECENT Hemoglobin A1c result?",
        "options": ["7.6%", "8.2%", "6.9%", "9.1%"],
        "expected": "8.2%",
        "rationale": "Requires sorting two A1c results by date.",
    },
    {
        "key": "med_treats_htn",
        "title": "Medication for hypertension",
        "prompt": "Which currently-prescribed medication treats the patient's hypertension?",
        "options": ["Metformin", "Lisinopril", "Atorvastatin", "Apixaban"],
        "expected": "Lisinopril",
        "rationale": "Requires linking a problem to its medication.",
    },
    {
        "key": "med_allergy_conflict",
        "title": "Medication–allergy conflict",
        "prompt": "Which currently-prescribed medication conflicts with a documented allergy?",
        "options": ["Metformin", "Apixaban", "Sulfamethoxazole-TMP", "Lisinopril"],
        "expected": "Sulfamethoxazole-TMP",
        "rationale": "Requires cross-referencing the medication list against the allergy list.",
    },
    {
        "key": "chest_pain_result",
        "title": "Result for chest-pain visit",
        "prompt": "At the 2025-03-02 chest-pain visit, which diagnostic result was collected to rule out a cardiac event?",
        "options": ["Hemoglobin A1c", "Troponin I", "LDL Cholesterol", "Potassium"],
        "expected": "Troponin I",
        "rationale": "Requires linking an encounter (by reason) to its labs.",
    },
    {
        "key": "recent_referral",
        "title": "Most recent referral",
        "prompt": "What specialty was the patient's most recent referral to?",
        "options": ["Ophthalmology", "Nephrology", "Cardiology", "Endocrinology"],
        "expected": "Cardiology",
        "rationale": "Requires sorting referrals by date.",
    },
]

# ── NASA-TLX instrument ──────────────────────────────────────────────────────
TLX_DIMENSIONS = [
    {"key": "mental_demand", "label": "Mental Demand", "question": "How mentally demanding was completing the tasks in this interface?", "low": "Very Low", "high": "Very High"},
    {"key": "physical_demand", "label": "Physical Demand", "question": "How physically demanding was the task (clicking, scrolling, navigating)?", "low": "Very Low", "high": "Very High"},
    {"key": "temporal_demand", "label": "Temporal Demand", "question": "How hurried or rushed was the pace of the tasks?", "low": "Very Low", "high": "Very High"},
    {"key": "performance", "label": "Performance", "question": "How successful were you in accomplishing what you were asked to do?", "low": "Perfect", "high": "Failure"},
    {"key": "effort", "label": "Effort", "question": "How hard did you have to work to reach your level of performance?", "low": "Very Low", "high": "Very High"},
    {"key": "frustration", "label": "Frustration", "question": "How insecure, discouraged, irritated, or stressed were you?", "low": "Very Low", "high": "Very High"},
]

# ── Qualitative prompts ──────────────────────────────────────────────────────
QUAL_PROMPTS = {
    # Asked after EACH interface condition (interface-scoped)
    "per_interface": [
        {"key": "easiest", "prompt": "What was easiest about locating information in this interface?"},
        {"key": "hardest", "prompt": "What was most difficult, confusing, or frustrating in this interface?"},
        {"key": "confidence", "prompt": "How confident were you that your answers were correct, and why?"},
    ],
    # Asked once at the end (overall)
    "closing": [
        {"key": "preference", "prompt": "Which interface did you prefer overall, and why?"},
        {"key": "mental_effort", "prompt": "What single change would most reduce the mental effort of chart review?"},
        {"key": "open", "prompt": "Anything else you would like the research team to know?"},
    ],
}

# ── Usability evaluation of CareOS (post-study) ──────────────────────────────
# The study doubles as a usability evaluation of CareOS (the relational
# interface). We use the validated System Usability Scale, Nielsen's 10 heuristics,
# design ratings, and open-ended function feedback.

# System Usability Scale — 10 items, alternating polarity, 1-5 Likert.
# ``positive`` is server-side only (used for scoring; stripped from the client).
SUS_ITEMS = [
    {"key": "sus1", "text": "I think that I would like to use this interface frequently.", "positive": True},
    {"key": "sus2", "text": "I found the interface unnecessarily complex.", "positive": False},
    {"key": "sus3", "text": "I thought the interface was easy to use.", "positive": True},
    {"key": "sus4", "text": "I think I would need support from a technical person to use this interface.", "positive": False},
    {"key": "sus5", "text": "I found the various functions in this interface were well integrated.", "positive": True},
    {"key": "sus6", "text": "I thought there was too much inconsistency in this interface.", "positive": False},
    {"key": "sus7", "text": "I would imagine that most clinicians would learn this interface very quickly.", "positive": True},
    {"key": "sus8", "text": "I found the interface very cumbersome to use.", "positive": False},
    {"key": "sus9", "text": "I felt very confident using the interface.", "positive": True},
    {"key": "sus10", "text": "I needed to learn a lot of things before I could get going with this interface.", "positive": False},
]
SUS_SCALE = {"min": 1, "max": 5, "low": "Strongly disagree", "high": "Strongly agree"}

# Nielsen's 10 usability heuristics — rated 1-5 (how well CareOS supports each).
HEURISTICS = [
    {"key": "h1", "name": "Visibility of system status", "desc": "Keeps you informed about what is happening through timely feedback."},
    {"key": "h2", "name": "Match with the real world", "desc": "Language, concepts, and order follow clinical conventions, not system jargon."},
    {"key": "h3", "name": "User control & freedom", "desc": "Easy to undo, go back, and recover from unwanted states."},
    {"key": "h4", "name": "Consistency & standards", "desc": "Words, situations, and actions mean the same thing throughout."},
    {"key": "h5", "name": "Error prevention", "desc": "Prevents problems before they happen (e.g. surfacing allergy conflicts)."},
    {"key": "h6", "name": "Recognition over recall", "desc": "Information is visible so you needn't remember it across views."},
    {"key": "h7", "name": "Flexibility & efficiency", "desc": "Supports both novices and experts; common look-ups are fast."},
    {"key": "h8", "name": "Aesthetic & minimalist design", "desc": "Signal over noise — no irrelevant clutter."},
    {"key": "h9", "name": "Error recovery", "desc": "Helps you recognize, diagnose, and recover from errors."},
    {"key": "h10", "name": "Help & documentation", "desc": "Any needed guidance is easy to find and task-focused."},
]
HEURISTIC_SCALE = {"min": 1, "max": 5, "low": "Poorly supported", "high": "Excellently supported"}

# Design ratings — 1-5.
DESIGN_DIMENSIONS = [
    {"key": "visual_appeal", "label": "Visual appeal", "question": "How visually appealing did you find CareOS?"},
    {"key": "clarity", "label": "Clarity", "question": "How clear and readable was the information layout?"},
    {"key": "information_density", "label": "Information density", "question": "How appropriate was the amount of information shown at once?"},
    {"key": "trust", "label": "Trustworthiness", "question": "How much did the design make you trust the information shown?"},
]
DESIGN_SCALE = {"min": 1, "max": 5, "low": "Poor", "high": "Excellent"}

# Open-ended function / design feedback.
FUNCTION_PROMPTS = [
    {"key": "most_valuable", "prompt": "Which function or capability of CareOS was most valuable to you?"},
    {"key": "missing_functions", "prompt": "What function is missing that you would need in real practice?"},
    {"key": "friction", "prompt": "Where did you experience the most friction, confusion, or doubt?"},
    {"key": "general", "prompt": "Any other feedback on the design, heuristics, or usability of CareOS?"},
]

USABILITY = {
    "intro": (
        "Finally, a short usability evaluation of CareOS — the relational "
        "interface you used — on standard measures."
    ),
    "sus": {"scale": SUS_SCALE, "items": [{"key": i["key"], "text": i["text"]} for i in SUS_ITEMS]},
    "heuristics": {"scale": HEURISTIC_SCALE, "items": HEURISTICS},
    "design": {"scale": DESIGN_SCALE, "dimensions": DESIGN_DIMENSIONS},
    "function_prompts": FUNCTION_PROMPTS,
}

_SUS_POLARITY = {i["key"]: i["positive"] for i in SUS_ITEMS}


# ── Informed consent (IRB) ───────────────────────────────────────────────────
CONSENT = {
    "title": "Informed Consent to Participate in Research",
    "version": "1.0",
    "sections": [
        {"heading": "Purpose", "body": (
            "You are invited to participate in a research study comparing two "
            "electronic health record (EHR) chart-review interfaces. The purpose "
            "is to measure clinician cognitive workload and task performance when "
            "reviewing the same patient chart presented in a traditional tabbed "
            "layout versus a relational linked layout."
        )},
        {"heading": "Procedures", "body": (
            "You will review a synthetic (fictional) patient chart and answer a "
            "short set of clinical look-up questions in each of the two interfaces, "
            "in a randomized order. After each interface you will complete the "
            "NASA Task Load Index (a six-item workload questionnaire) and a few "
            "open-ended questions. The session takes approximately 15-20 minutes."
        )},
        {"heading": "Data Collected", "body": (
            "We collect your name and email address so you can log back in and so "
            "the study team can contact you (e.g. scheduling or compensation). Your "
            "contact details are stored securely, separately from the analysis "
            "dataset, and are never shared or sold. We also record your professional "
            "background (role, specialty, years of experience, EHR familiarity), your "
            "answers, time-on-task, interaction events (e.g. clicks and navigation), "
            "workload ratings, and written comments. During an initial free-exploration "
            "step we also record on-screen interactions only — clicks, scrolling, time, "
            "and pointer movement; no webcam or camera is used. No patient data are "
            "collected, and findings are reported only in aggregate."
        )},
        {"heading": "One Sitting", "body": (
            "Please complete the study in a single sitting. For data quality, once "
            "you begin you will not be able to pause and resume later — if you leave, "
            "your session is considered complete."
        )},
        {"heading": "Risks & Benefits", "body": (
            "Risks are minimal and limited to the mild fatigue of computer tasks. "
            "There is no direct benefit to you; findings may inform the design of "
            "lower-burden EHR interfaces."
        )},
        {"heading": "Voluntary Participation", "body": (
            "Participation is entirely voluntary. You may skip any question or "
            "withdraw at any time without penalty. Data are reported only in "
            "aggregate."
        )},
    ],
    "agreement": (
        "I have read the information above, I am a healthcare professional, and I "
        "voluntarily consent to participate."
    ),
}


def public_study() -> dict:
    """Study payload safe for the client — task ``expected`` answers stripped."""
    tasks = []
    for t in TASKS:
        tasks.append({k: v for k, v in t.items() if k not in ("expected", "rationale")})
    return {
        "meta": STUDY_META,
        "patient": deepcopy(PATIENT),
        "tasks": tasks,
        "tlx_dimensions": TLX_DIMENSIONS,
        "qual_prompts": QUAL_PROMPTS,
        "usability": USABILITY,
        "consent": CONSENT,
    }


def score_sus(responses: dict) -> float | None:
    """Score the System Usability Scale (0-100) from a {key: 1-5} map.

    Positive items contribute (value - 1); negative items contribute (5 - value);
    the sum of the ten contributions is multiplied by 2.5. Returns None unless
    all ten items are present and in range.
    """
    if not isinstance(responses, dict):
        return None
    total = 0
    for key, positive in _SUS_POLARITY.items():
        v = responses.get(key)
        if v is None:
            return None
        try:
            v = int(v)
        except (TypeError, ValueError):
            return None
        if not (1 <= v <= 5):
            return None
        total += (v - 1) if positive else (5 - v)
    return round(total * 2.5, 1)


_TASK_BY_KEY = {t["key"]: t for t in TASKS}


def expected_answer(task_key: str) -> str | None:
    t = _TASK_BY_KEY.get(task_key)
    return t["expected"] if t else None


def task_title(task_key: str) -> str | None:
    t = _TASK_BY_KEY.get(task_key)
    return t["title"] if t else None
