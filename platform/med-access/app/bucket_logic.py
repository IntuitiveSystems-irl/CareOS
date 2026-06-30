"""
Bucket logic for categorizing survey answers into Yes / No / Skip.

The bucket rules are configurable but default to the standard mapping
derived from All of Us survey answer patterns.

Standard rules:
- Yes bucket: "yes", "y", "true", or any answer ending with ": Yes"
- No bucket: "no", "n", "false", or any answer ending with ": No"
- Skip bucket: empty/null, "PMI: Skip", "PMI: Prefer Not To Answer",
  "PMI: Dont Know", or anything that doesn't match Yes/No.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class BucketRules:
    """Configurable rules for bucketing survey answers."""

    yes_patterns: list[str] = field(default_factory=lambda: [
        r"^yes$",
        r"^y$",
        r"^true$",
        r":\s*yes\s*$",
    ])
    no_patterns: list[str] = field(default_factory=lambda: [
        r"^no$",
        r"^n$",
        r"^false$",
        r":\s*no\s*$",
    ])
    skip_literals: list[str] = field(default_factory=lambda: [
        "",
        "pmi: skip",
        "pmi: prefer not to answer",
        "pmi: dont know",
        "pmi: don't know",
    ])

    def _compiled_yes(self) -> list[re.Pattern]:
        return [re.compile(p, re.IGNORECASE) for p in self.yes_patterns]

    def _compiled_no(self) -> list[re.Pattern]:
        return [re.compile(p, re.IGNORECASE) for p in self.no_patterns]

    def classify(self, answer: str | None) -> str:
        """Classify a single answer string into 'Yes', 'No', or 'Skip'."""
        if answer is None:
            return "Skip"

        cleaned = answer.strip()

        # Check skip literals first (empty string, PMI codes)
        if cleaned.lower() in self.skip_literals:
            return "Skip"

        # Check Yes patterns
        for pat in self._compiled_yes():
            if pat.search(cleaned):
                return "Yes"

        # Check No patterns
        for pat in self._compiled_no():
            if pat.search(cleaned):
                return "No"

        # Default: anything else is Skip
        return "Skip"


# Module-level default instance
DEFAULT_RULES = BucketRules()


def bucket_answer(answer: str | None, rules: BucketRules | None = None) -> str:
    """Classify a single answer into Yes/No/Skip using given (or default) rules."""
    r = rules or DEFAULT_RULES
    return r.classify(answer)


def bucket_rows(
    rows: list[dict],
    rules: BucketRules | None = None,
) -> dict[int, dict]:
    """
    Take raw answer-count rows from BigQuery and bucket them.

    Input rows: [{question_concept_id, question, answer, n}, ...]
    Output: {qid: {qid, question, Yes, No, Skip, total}}
    """
    r = rules or DEFAULT_RULES
    result: dict[int, dict] = {}

    for row in rows:
        qid = row["question_concept_id"]
        if qid not in result:
            result[qid] = {
                "qid": qid,
                "question": row.get("question", ""),
                "Yes": 0,
                "No": 0,
                "Skip": 0,
                "total": 0,
            }

        bucket = r.classify(row.get("answer"))
        count = row.get("n", 0)
        result[qid][bucket] += count
        result[qid]["total"] += count

    return result
