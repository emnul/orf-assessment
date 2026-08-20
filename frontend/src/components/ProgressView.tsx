import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { fetchStudentProgress, type Assessment } from "../api/orf";

const STUDENT_ID = "1";

// Hardcoded to match the seeded grade-3/spring benchmark norm. In a
// fuller build this would come from a `benchmarkNorm` query rather
// than being duplicated on the client.
const AT_BENCHMARK_WCPM = 100;
const SOME_RISK_WCPM = 75;

export function ProgressView() {
  const [assessments, setAssessments] = useState<Assessment[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchStudentProgress(STUDENT_ID)
      .then(setAssessments)
      .catch((e) => setErrorMessage(e.message));
  }, []);

  if (errorMessage) {
    return <div className="card error-banner">{errorMessage}</div>;
  }

  if (!assessments) {
    return <div className="card empty-state">Loading progress…</div>;
  }

  const data = assessments.map((a, i) => ({
    label: `${a.season[0].toUpperCase()}${a.season.slice(1)} #${i + 1}`,
    wcpm: a.wcpm,
    date: new Date(a.administeredAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <div className="card">
      <div className="eyebrow">Progress monitoring</div>
      <h2 className="title">Maya T. · WCPM over time</h2>

      <div style={{ height: 280, marginTop: "1.5rem" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="#d3dbd5" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontFamily: "Inter", fontSize: 12, fill: "#4a5852" }}
              axisLine={{ stroke: "#d3dbd5" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontFamily: "IBM Plex Mono", fontSize: 11, fill: "#4a5852" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                fontFamily: "Inter",
                fontSize: 13,
                border: "1px solid #d3dbd5",
                borderRadius: 8,
              }}
            />
            <ReferenceLine
              y={AT_BENCHMARK_WCPM}
              stroke="#2f6f62"
              strokeDasharray="4 4"
              label={{ value: "At benchmark (100)", position: "insideTopRight", fontSize: 11, fill: "#2f6f62" }}
            />
            <ReferenceLine
              y={SOME_RISK_WCPM}
              stroke="#c48a2e"
              strokeDasharray="4 4"
              label={{ value: "Some risk (75)", position: "insideBottomRight", fontSize: 11, fill: "#c48a2e" }}
            />
            <Line
              type="monotone"
              dataKey="wcpm"
              stroke="#16241f"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#16241f" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="results-grid" style={{ marginTop: "1.5rem" }}>
        {assessments.map((a) => (
          <div className="stat" key={a.id}>
            <div className="stat-value">{a.wcpm}</div>
            <div className="stat-label">
              {a.season} · <span className={`tier-badge tier-${a.riskTier}`} style={{ marginTop: 4 }}>
                {a.riskTier.replace("_", " ")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
