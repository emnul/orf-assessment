from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.scoring import BenchmarkNorm, score_assessment

app = FastAPI(title="ORF Scoring Service")


class BenchmarkNormIn(BaseModel):
    at_benchmark_wcpm: int
    some_risk_wcpm: int


class ScoreRequest(BaseModel):
    words_read: int
    error_word_indices: list[int]
    benchmark: BenchmarkNormIn


class ScoreResponse(BaseModel):
    words_read: int
    error_count: int
    wcpm: int
    accuracy_pct: float
    risk_tier: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest):
    try:
        result = score_assessment(
            words_read=req.words_read,
            error_word_indices=req.error_word_indices,
            benchmark=BenchmarkNorm(
                at_benchmark_wcpm=req.benchmark.at_benchmark_wcpm,
                some_risk_wcpm=req.benchmark.some_risk_wcpm,
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return ScoreResponse(
        words_read=result.words_read,
        error_count=result.error_count,
        wcpm=result.wcpm,
        accuracy_pct=result.accuracy_pct,
        risk_tier=result.risk_tier.value,
    )
