import { gql } from "./client";

export type ErrorType = "SUBSTITUTION" | "OMISSION" | "HESITATION";

export interface Passage {
  id: string;
  gradeLevel: number;
  title: string;
  wordTokens: string[];
  totalWords: number;
}

export interface ErrorTag {
  wordIndex: number;
  errorType: ErrorType;
}

export interface AssessmentSession {
  sessionId: string;
  studentId: string;
  passageId: string;
  taggedErrors: ErrorTag[];
}

export interface Assessment {
  id: string;
  studentId: string;
  passageId: string;
  administeredAt: string;
  season: string;
  wordsRead: number;
  wcpm: number;
  accuracyPct: number;
  riskTier: "at_benchmark" | "some_risk" | "at_risk";
}

export async function fetchPassage(grade: number): Promise<Passage> {
  const data = await gql<{ passage: Passage | null }>(
    `query($grade: Int!) {
      passage(grade: $grade) {
        id gradeLevel title wordTokens totalWords
      }
    }`,
    { grade }
  );
  if (!data.passage) throw new Error(`No passage found for grade ${grade}`);
  return data.passage;
}

export async function startAssessment(
  studentId: string,
  passageId: string
): Promise<AssessmentSession> {
  const data = await gql<{ startAssessment: AssessmentSession }>(
    `mutation($studentId: ID!, $passageId: ID!) {
      startAssessment(studentId: $studentId, passageId: $passageId) {
        sessionId studentId passageId taggedErrors { wordIndex errorType }
      }
    }`,
    { studentId, passageId }
  );
  return data.startAssessment;
}

export async function tagError(
  sessionId: string,
  wordIndex: number,
  errorType: ErrorType
): Promise<AssessmentSession> {
  const data = await gql<{ tagError: AssessmentSession }>(
    `mutation($sessionId: ID!, $wordIndex: Int!, $errorType: ErrorType!) {
      tagError(sessionId: $sessionId, wordIndex: $wordIndex, errorType: $errorType) {
        sessionId studentId passageId taggedErrors { wordIndex errorType }
      }
    }`,
    { sessionId, wordIndex, errorType }
  );
  return data.tagError;
}

export async function submitAssessment(
  sessionId: string,
  wordsReadIndex: number
): Promise<Assessment> {
  const data = await gql<{ submitAssessment: Assessment }>(
    `mutation($sessionId: ID!, $wordsReadIndex: Int!) {
      submitAssessment(sessionId: $sessionId, wordsReadIndex: $wordsReadIndex) {
        id studentId passageId administeredAt season wordsRead wcpm accuracyPct riskTier
      }
    }`,
    { sessionId, wordsReadIndex }
  );
  return data.submitAssessment;
}

export async function fetchStudentProgress(
  studentId: string
): Promise<Assessment[]> {
  const data = await gql<{ studentProgress: Assessment[] }>(
    `query($studentId: ID!) {
      studentProgress(studentId: $studentId) {
        id studentId passageId administeredAt season wordsRead wcpm accuracyPct riskTier
      }
    }`,
    { studentId }
  );
  return data.studentProgress;
}
