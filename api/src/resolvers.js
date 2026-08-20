import { pool } from "./db.js";
import * as sessionStore from "./sessionStore.js";
import { scoreAssessment } from "./scoringClient.js";

export const resolvers = {
  Query: {
    passage: async (_, { grade }) => {
      const { rows } = await pool.query(
        "SELECT * FROM passage WHERE grade_level = $1 LIMIT 1",
        [grade]
      );
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        gradeLevel: row.grade_level,
        title: row.title,
        wordTokens: row.word_tokens,
        totalWords: row.total_words,
      };
    },

    studentProgress: async (_, { studentId }) => {
      const { rows } = await pool.query(
        `SELECT * FROM assessment WHERE student_id = $1 ORDER BY administered_at ASC`,
        [studentId]
      );
      return rows.map(mapAssessmentRow);
    },
  },

  Mutation: {
    startAssessment: (_, { studentId, passageId }) => {
      const session = sessionStore.createSession(studentId, passageId);
      return {
        sessionId: session.sessionId,
        studentId: session.studentId,
        passageId: session.passageId,
        taggedErrors: session.taggedErrors,
      };
    },

    tagError: (_, { sessionId, wordIndex, errorType }) => {
      const session = sessionStore.addErrorTag(sessionId, wordIndex, errorType);
      return {
        sessionId: session.sessionId,
        studentId: session.studentId,
        passageId: session.passageId,
        taggedErrors: session.taggedErrors,
      };
    },

    submitAssessment: async (_, { sessionId, wordsReadIndex }) => {
      const session = sessionStore.endSession(sessionId);

      const { rows: passageRows } = await pool.query(
        "SELECT * FROM passage WHERE id = $1",
        [session.passageId]
      );
      const passage = passageRows[0];
      if (!passage) throw new Error(`Passage ${session.passageId} not found`);

      const { rows: benchmarkRows } = await pool.query(
        "SELECT * FROM benchmark_norm WHERE grade = $1 LIMIT 1",
        [passage.grade_level]
      );
      const benchmarkRow = benchmarkRows[0];
      if (!benchmarkRow) {
        throw new Error(`No benchmark norm for grade ${passage.grade_level}`);
      }

      const errorIndices = session.taggedErrors.map((e) => e.wordIndex);

      const scored = await scoreAssessment({
        wordsRead: wordsReadIndex,
        errorWordIndices: errorIndices,
        benchmark: {
          atBenchmarkWcpm: benchmarkRow.at_benchmark_wcpm,
          someRiskWcpm: benchmarkRow.some_risk_wcpm,
        },
      });

      const { rows } = await pool.query(
        `INSERT INTO assessment
           (student_id, passage_id, season, words_read, errors_json, wcpm, accuracy_pct, risk_tier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          session.studentId,
          session.passageId,
          benchmarkRow.season,
          scored.wordsRead,
          JSON.stringify(session.taggedErrors),
          scored.wcpm,
          scored.accuracyPct,
          scored.riskTier,
        ]
      );

      return mapAssessmentRow(rows[0]);
    },
  },
};

function mapAssessmentRow(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    passageId: row.passage_id,
    administeredAt: row.administered_at.toISOString(),
    season: row.season,
    wordsRead: row.words_read,
    wcpm: row.wcpm,
    accuracyPct: Number(row.accuracy_pct),
    riskTier: row.risk_tier,
  };
}
