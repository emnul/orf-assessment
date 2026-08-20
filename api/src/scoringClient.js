import fetch from "node-fetch";

const SCORING_SERVICE_URL =
  process.env.SCORING_SERVICE_URL || "http://localhost:8000";

export async function scoreAssessment({
  wordsRead,
  errorWordIndices,
  benchmark,
}) {
  const res = await fetch(`${SCORING_SERVICE_URL}/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      words_read: wordsRead,
      error_word_indices: errorWordIndices,
      benchmark: {
        at_benchmark_wcpm: benchmark.atBenchmarkWcpm,
        some_risk_wcpm: benchmark.someRiskWcpm,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Scoring service error (${res.status}): ${detail}`);
  }

  const data = await res.json();
  return {
    wordsRead: data.words_read,
    errorCount: data.error_count,
    wcpm: data.wcpm,
    accuracyPct: data.accuracy_pct,
    riskTier: data.risk_tier,
  };
}
