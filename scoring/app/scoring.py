"""
Oral Reading Fluency scoring engine.

Pure, side-effect-free functions that turn raw assessment data (how many
words the student reached in 60 seconds, and which words were tagged as
errors) into the standard ORF metrics: WCPM, accuracy, and a benchmark
risk tier.

Kept deliberately free of any I/O (no DB, no HTTP) so it can be unit
tested in isolation and reused from any transport layer.
"""

from dataclasses import dataclass
from enum import Enum


class RiskTier(str, Enum):
    AT_BENCHMARK = "at_benchmark"
    SOME_RISK = "some_risk"
    AT_RISK = "at_risk"


class ErrorType(str, Enum):
    SUBSTITUTION = "substitution"
    OMISSION = "omission"
    HESITATION = "hesitation"


@dataclass(frozen=True)
class BenchmarkNorm:
    """Cut points for a given grade/season. Both cutoffs are WCPM."""
    at_benchmark_wcpm: int
    some_risk_wcpm: int


@dataclass(frozen=True)
class ScoreResult:
    words_read: int
    error_count: int
    wcpm: int
    accuracy_pct: float
    risk_tier: RiskTier


def score_assessment(
    words_read: int,
    error_word_indices: list[int],
    benchmark: BenchmarkNorm,
) -> ScoreResult:
    """
    Compute WCPM, accuracy, and risk tier for a single ORF assessment.

    Args:
        words_read: number of words the student reached in the 60-second
            window (i.e. the index of the last word attempted, 1-based
            count of words the student got to — not necessarily read
            correctly).
        error_word_indices: the distinct word positions tagged as a
            miscue (substitution, omission, or hesitation-over-3s) during
            the assessment. Duplicates are collapsed — a word is either
            an error or it isn't.
        benchmark: the grade/season benchmark cut points to compare
            against.

    Returns:
        ScoreResult with WCPM (words read minus errors, floored at 0),
        accuracy percentage, and a risk tier.

    Raises:
        ValueError: if words_read is negative, or if any error index
            falls outside the range of words actually read.
    """
    if words_read < 0:
        raise ValueError("words_read cannot be negative")

    distinct_errors = set(error_word_indices)
    for idx in distinct_errors:
        if idx < 0 or idx >= words_read:
            raise ValueError(
                f"error index {idx} is out of range for words_read={words_read}"
            )

    error_count = len(distinct_errors)
    wcpm = max(words_read - error_count, 0)

    if words_read == 0:
        accuracy_pct = 0.0
    else:
        accuracy_pct = round((wcpm / words_read) * 100, 1)

    risk_tier = _classify_risk(wcpm, benchmark)

    return ScoreResult(
        words_read=words_read,
        error_count=error_count,
        wcpm=wcpm,
        accuracy_pct=accuracy_pct,
        risk_tier=risk_tier,
    )


def _classify_risk(wcpm: int, benchmark: BenchmarkNorm) -> RiskTier:
    if wcpm >= benchmark.at_benchmark_wcpm:
        return RiskTier.AT_BENCHMARK
    if wcpm >= benchmark.some_risk_wcpm:
        return RiskTier.SOME_RISK
    return RiskTier.AT_RISK
