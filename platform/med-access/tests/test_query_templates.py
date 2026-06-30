"""Unit tests for query_templates.py — validation and template registry."""
import pytest
from app.query_templates import (
    get_template, list_templates, TEMPLATE_REGISTRY,
    _validate_qid, _validate_qid_list, _validate_keywords, _validate_limit,
)


class TestValidators:
    """Test parameter validators."""

    def test_validate_qid_valid(self):
        assert _validate_qid(43530415) == 43530415
        assert _validate_qid("100") == 100

    def test_validate_qid_invalid(self):
        with pytest.raises(ValueError):
            _validate_qid(-1)
        with pytest.raises(ValueError):
            _validate_qid(0)
        with pytest.raises((ValueError, TypeError)):
            _validate_qid("abc")

    def test_validate_qid_list_valid(self):
        result = _validate_qid_list([43530415, 43530416, 43530417])
        assert len(result) == 3

    def test_validate_qid_list_empty(self):
        with pytest.raises(ValueError, match="non-empty"):
            _validate_qid_list([])

    def test_validate_qid_list_too_long(self):
        with pytest.raises(ValueError, match="cannot exceed 50"):
            _validate_qid_list(list(range(1, 52)))

    def test_validate_keywords_valid(self):
        result = _validate_keywords(["insurance", "medication", "cost"])
        assert result == ["insurance", "medication", "cost"]

    def test_validate_keywords_empty(self):
        with pytest.raises(ValueError, match="non-empty"):
            _validate_keywords([])

    def test_validate_keywords_invalid_chars(self):
        with pytest.raises(ValueError, match="Invalid keyword"):
            _validate_keywords(["valid", "DROP TABLE;"])

    def test_validate_keywords_too_many(self):
        with pytest.raises(ValueError, match="cannot exceed 10"):
            _validate_keywords([f"kw{i}" for i in range(11)])

    def test_validate_limit_valid(self):
        assert _validate_limit(25) == 25
        assert _validate_limit(1) == 1
        assert _validate_limit(100) == 100

    def test_validate_limit_invalid(self):
        with pytest.raises(ValueError):
            _validate_limit(0)
        with pytest.raises(ValueError):
            _validate_limit(101)


class TestTemplateRegistry:
    """Test template lookup and listing."""

    def test_all_templates_registered(self):
        assert "answers_by_qid" in TEMPLATE_REGISTRY
        assert "bucketed_counts" in TEMPLATE_REGISTRY
        assert "search_questions" in TEMPLATE_REGISTRY

    def test_get_template_valid(self):
        t = get_template("answers_by_qid")
        assert t.template_id == "answers_by_qid"
        assert "qid" in t.required_params

    def test_get_template_invalid(self):
        with pytest.raises(ValueError, match="Unknown template"):
            get_template("drop_table")

    def test_list_templates(self):
        result = list_templates()
        assert len(result) == 3
        ids = [t["template_id"] for t in result]
        assert "answers_by_qid" in ids
        assert "bucketed_counts" in ids
        assert "search_questions" in ids


class TestSqlBuilders:
    """Test that SQL builders produce valid parameterized queries."""

    def test_answers_by_qid_builder(self):
        t = get_template("answers_by_qid")
        sql, params = t.sql_builder({"qid": 43530415})
        assert "question_concept_id = @qid" in sql
        assert "COUNT(*)" in sql
        assert "GROUP BY" in sql
        assert len(params) == 1
        assert params[0].name == "qid"
        assert params[0].value == 43530415

    def test_bucketed_counts_builder(self):
        t = get_template("bucketed_counts")
        sql, params = t.sql_builder({"qids": [43530415, 43530416]})
        assert "IN UNNEST(@qids)" in sql
        assert len(params) == 1
        assert params[0].name == "qids"

    def test_search_questions_builder(self):
        t = get_template("search_questions")
        sql, params = t.sql_builder({"keywords": ["insurance", "coverage"], "limit": 10})
        assert "LIKE" in sql
        assert "LIMIT @row_limit" in sql
        # 2 keyword params + 1 limit param
        assert len(params) == 3

    def test_search_questions_default_limit(self):
        t = get_template("search_questions")
        sql, params = t.sql_builder({"keywords": ["medication"]})
        limit_param = [p for p in params if p.name == "row_limit"][0]
        assert limit_param.value == 25
