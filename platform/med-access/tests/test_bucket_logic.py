"""Unit tests for bucket_logic.py — Yes/No/Skip classification."""
import pytest
from app.bucket_logic import bucket_answer, bucket_rows, BucketRules, DEFAULT_RULES


class TestBucketAnswer:
    """Test individual answer classification."""

    @pytest.mark.parametrize("answer,expected", [
        ("Yes", "Yes"),
        ("yes", "Yes"),
        ("Y", "Yes"),
        ("y", "Yes"),
        ("true", "Yes"),
        ("TRUE", "Yes"),
        ("Some Answer: Yes", "Yes"),
        ("Can't Afford Care: Yes", "Yes"),
    ])
    def test_yes_bucket(self, answer, expected):
        assert bucket_answer(answer) == expected

    @pytest.mark.parametrize("answer,expected", [
        ("No", "No"),
        ("no", "No"),
        ("N", "No"),
        ("n", "No"),
        ("false", "No"),
        ("FALSE", "No"),
        ("Some Answer: No", "No"),
        ("Can't Afford Care: No", "No"),
    ])
    def test_no_bucket(self, answer, expected):
        assert bucket_answer(answer) == expected

    @pytest.mark.parametrize("answer,expected", [
        (None, "Skip"),
        ("", "Skip"),
        ("PMI: Skip", "Skip"),
        ("PMI: Prefer Not To Answer", "Skip"),
        ("PMI: Dont Know", "Skip"),
        ("PMI: Don't Know", "Skip"),
        ("Some other answer text", "Skip"),
        ("3 times a week", "Skip"),
    ])
    def test_skip_bucket(self, answer, expected):
        assert bucket_answer(answer) == expected


class TestBucketRows:
    """Test row-level bucketing aggregation."""

    def test_single_qid(self):
        rows = [
            {"question_concept_id": 100, "question": "Q?", "answer": "Yes", "n": 50},
            {"question_concept_id": 100, "question": "Q?", "answer": "No", "n": 30},
            {"question_concept_id": 100, "question": "Q?", "answer": "PMI: Skip", "n": 20},
        ]
        result = bucket_rows(rows)
        assert 100 in result
        assert result[100]["Yes"] == 50
        assert result[100]["No"] == 30
        assert result[100]["Skip"] == 20
        assert result[100]["total"] == 100

    def test_multiple_qids(self):
        rows = [
            {"question_concept_id": 1, "question": "Q1", "answer": "Yes", "n": 10},
            {"question_concept_id": 1, "question": "Q1", "answer": "No", "n": 5},
            {"question_concept_id": 2, "question": "Q2", "answer": "Yes", "n": 20},
            {"question_concept_id": 2, "question": "Q2", "answer": "", "n": 3},
        ]
        result = bucket_rows(rows)
        assert len(result) == 2
        assert result[1]["total"] == 15
        assert result[2]["Yes"] == 20
        assert result[2]["Skip"] == 3

    def test_empty_rows(self):
        result = bucket_rows([])
        assert result == {}

    def test_custom_rules(self):
        custom = BucketRules(
            yes_patterns=[r"^agree$"],
            no_patterns=[r"^disagree$"],
            skip_literals=["", "na"],
        )
        rows = [
            {"question_concept_id": 1, "question": "Q", "answer": "Agree", "n": 10},
            {"question_concept_id": 1, "question": "Q", "answer": "Disagree", "n": 5},
            {"question_concept_id": 1, "question": "Q", "answer": "NA", "n": 2},
        ]
        result = bucket_rows(rows, rules=custom)
        assert result[1]["Yes"] == 10
        assert result[1]["No"] == 5
        assert result[1]["Skip"] == 2
