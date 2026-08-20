import pytest

from app.scoring import BenchmarkNorm, RiskTier, score_assessment

GRADE_3_SPRING = BenchmarkNorm(at_benchmark_wcpm=100, some_risk_wcpm=75)


def test_perfect_read_no_errors():
    result = score_assessment(words_read=110, error_word_indices=[], benchmark=GRADE_3_SPRING)
    assert result.wcpm == 110
    assert result.accuracy_pct == 100.0
    assert result.risk_tier == RiskTier.AT_BENCHMARK


def test_several_errors_reduces_wcpm_and_accuracy():
    result = score_assessment(
        words_read=100,
        error_word_indices=[3, 17, 42, 99],
        benchmark=GRADE_3_SPRING,
    )
    assert result.error_count == 4
    assert result.wcpm == 96
    assert result.accuracy_pct == 96.0


def test_zero_words_read():
    result = score_assessment(words_read=0, error_word_indices=[], benchmark=GRADE_3_SPRING)
    assert result.wcpm == 0
    assert result.accuracy_pct == 0.0
    assert result.risk_tier == RiskTier.AT_RISK


def test_duplicate_error_indices_are_collapsed():
    result = score_assessment(
        words_read=50,
        error_word_indices=[5, 5, 5, 10],
        benchmark=GRADE_3_SPRING,
    )
    assert result.error_count == 2
    assert result.wcpm == 48


def test_boundary_exactly_at_benchmark_cutoff():
    result = score_assessment(words_read=100, error_word_indices=[], benchmark=GRADE_3_SPRING)
    assert result.wcpm == 100
    assert result.risk_tier == RiskTier.AT_BENCHMARK


def test_boundary_one_below_benchmark_cutoff_is_some_risk():
    result = score_assessment(words_read=99, error_word_indices=[], benchmark=GRADE_3_SPRING)
    assert result.wcpm == 99
    assert result.risk_tier == RiskTier.SOME_RISK


def test_boundary_one_below_some_risk_cutoff_is_at_risk():
    result = score_assessment(words_read=74, error_word_indices=[], benchmark=GRADE_3_SPRING)
    assert result.wcpm == 74
    assert result.risk_tier == RiskTier.AT_RISK


def test_negative_words_read_raises():
    with pytest.raises(ValueError):
        score_assessment(words_read=-1, error_word_indices=[], benchmark=GRADE_3_SPRING)


def test_error_index_out_of_range_raises():
    with pytest.raises(ValueError):
        score_assessment(words_read=10, error_word_indices=[10], benchmark=GRADE_3_SPRING)


def test_wcpm_never_goes_negative_when_every_word_is_an_error():
    result = score_assessment(words_read=5, error_word_indices=[0, 1, 2, 3, 4], benchmark=GRADE_3_SPRING)
    assert result.wcpm == 0
    assert result.accuracy_pct == 0.0
