import { useEffect, useRef, useState } from "react";
import {
  fetchPassage,
  startAssessment,
  tagError,
  submitAssessment,
  type Passage,
  type Assessment,
  type ErrorType,
} from "../api/orf";

const STUDENT_ID = "1";
const GRADE = 3;
const ASSESSMENT_SECONDS = 60;

type Phase = "loading" | "idle" | "live" | "awaiting-stop" | "submitting" | "results";

const ERROR_TYPES: { value: ErrorType; label: string }[] = [
  { value: "OMISSION", label: "Omission" },
  { value: "SUBSTITUTION", label: "Substitution" },
  { value: "HESITATION", label: "Hesitation" },
];

const RECOMMENDATIONS: Record<Assessment["riskTier"], string> = {
  at_benchmark:
    "Maya is reading at or above the benchmark for this season. Continue core instruction and monitor at the next scheduled check.",
  some_risk:
    "Maya is reading below benchmark. Consider a strategic small-group intervention focused on fluency, and progress-monitor every 2 weeks.",
  at_risk:
    "Maya is reading well below benchmark. Recommend an intensive, individualized intervention and weekly progress monitoring.",
};

export function AssessmentFlow() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [passage, setPassage] = useState<Passage | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(ASSESSMENT_SECONDS);
  const [taggedWords, setTaggedWords] = useState<Map<number, ErrorType>>(
    new Map()
  );
  const [errorTypeMode, setErrorTypeMode] = useState<ErrorType>("OMISSION");
  const [stopIndex, setStopIndex] = useState<number | null>(null);
  const [result, setResult] = useState<Assessment | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    fetchPassage(GRADE)
      .then((p) => {
        setPassage(p);
        setPhase("idle");
      })
      .catch((e) => setErrorMessage(e.message));
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  async function handleStart() {
    if (!passage) return;
    setErrorMessage(null);
    try {
      const session = await startAssessment(STUDENT_ID, passage.id);
      setSessionId(session.sessionId);
      setTaggedWords(new Map());
      setStopIndex(null);
      setTimeLeft(ASSESSMENT_SECONDS);
      setPhase("live");

      intervalRef.current = window.setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            if (intervalRef.current) window.clearInterval(intervalRef.current);
            setPhase("awaiting-stop");
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } catch (e) {
      setErrorMessage((e as Error).message);
    }
  }

  function handleStopNow() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setPhase("awaiting-stop");
  }

  async function handleWordClick(index: number) {
    if (phase === "live") {
      if (!sessionId) return;
      const next = new Map(taggedWords);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.set(index, errorTypeMode);
      }
      setTaggedWords(next);
      // Fire the tag to the API; UI already reflects the optimistic state.
      tagError(sessionId, index, errorTypeMode).catch((e) =>
        setErrorMessage((e as Error).message)
      );
    } else if (phase === "awaiting-stop") {
      setStopIndex(index + 1);
    }
  }

  async function handleSubmit() {
    if (!sessionId || stopIndex === null) return;
    setPhase("submitting");
    setErrorMessage(null);
    try {
      const assessment = await submitAssessment(sessionId, stopIndex);
      setResult(assessment);
      setPhase("results");
    } catch (e) {
      setErrorMessage((e as Error).message);
      setPhase("awaiting-stop");
    }
  }

  function handleReset() {
    setPhase("idle");
    setResult(null);
    setSessionId(null);
    setTaggedWords(new Map());
    setStopIndex(null);
    setTimeLeft(ASSESSMENT_SECONDS);
  }

  if (phase === "loading") {
    return <div className="card empty-state">Loading passage…</div>;
  }

  if (!passage) {
    return <div className="card error-banner">Couldn't load a passage.</div>;
  }

  if (phase === "results" && result) {
    return (
      <ResultsCard
        studentName="Maya T."
        result={result}
        onReset={handleReset}
      />
    );
  }

  return (
    <div className="card">
      {errorMessage && <div className="error-banner">{errorMessage}</div>}

      <div className="session-header">
        <div className="student-line">
          <strong>Maya T.</strong> · Grade {passage.gradeLevel} · "{passage.title}"
        </div>
        <div className={`timer ${phase === "live" ? "is-live" : ""}`}>
          {phase === "live" && <span className="live-dot" aria-hidden />}
          {formatTime(timeLeft)}
        </div>
      </div>

      {phase === "live" && (
        <div className="mode-bar">
          Marking as:
          <div className="mode-options" role="group" aria-label="Error type">
            {ERROR_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-pressed={errorTypeMode === t.value}
                onClick={() => setErrorTypeMode(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="passage">
        {passage.wordTokens.map((word, i) => {
          const tag = taggedWords.get(i);
          const classes = ["word"];
          if (tag) classes.push("tagged", `type-${tag.toLowerCase()}`);
          if (stopIndex !== null && i === stopIndex - 1)
            classes.push("stop-boundary");
          return (
            <button
              key={i}
              type="button"
              className={classes.join(" ")}
              onClick={() => handleWordClick(i)}
              disabled={phase !== "live" && phase !== "awaiting-stop"}
            >
              {word}
            </button>
          );
        })}
      </div>

      {phase === "idle" && (
        <div className="actions">
          <button className="btn btn-primary" onClick={handleStart}>
            Start assessment
          </button>
        </div>
      )}

      {phase === "live" && (
        <div className="actions">
          <button className="btn btn-secondary" onClick={handleStopNow}>
            Stop now
          </button>
        </div>
      )}

      {phase === "awaiting-stop" && (
        <>
          <div className="helper-banner">
            Time's up. Tap the last word Maya read to mark where she stopped.
          </div>
          <div className="actions">
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={stopIndex === null}
            >
              Submit assessment
            </button>
          </div>
        </>
      )}

      {phase === "submitting" && (
        <div className="helper-banner">Scoring…</div>
      )}
    </div>
  );
}

function ResultsCard({
  studentName,
  result,
  onReset,
}: {
  studentName: string;
  result: Assessment;
  onReset: () => void;
}) {
  return (
    <div className="card">
      <div className="eyebrow">Results</div>
      <h2 className="title">{studentName}</h2>

      <div className="results-grid">
        <div className="stat">
          <div className="stat-value">{result.wcpm}</div>
          <div className="stat-label">WCPM</div>
        </div>
        <div className="stat">
          <div className="stat-value">{result.accuracyPct}%</div>
          <div className="stat-label">Accuracy</div>
        </div>
        <div className="stat">
          <div className="stat-value">{result.wordsRead}</div>
          <div className="stat-label">Words read</div>
        </div>
      </div>

      <span className={`tier-badge tier-${result.riskTier}`}>
        {result.riskTier.replace("_", " ")}
      </span>

      <p className="recommendation">{RECOMMENDATIONS[result.riskTier]}</p>

      <div className="actions">
        <button className="btn btn-primary" onClick={onReset}>
          New assessment
        </button>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
