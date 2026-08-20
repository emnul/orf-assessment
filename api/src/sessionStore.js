import { randomUUID } from "crypto";

// In-memory store for in-progress assessment sessions.
// Deliberately not persisted: an in-progress 60-second assessment is
// ephemeral by nature, and this mirrors where a real system would use
// a fast key-value store (e.g. DynamoDB) for high-write, short-lived
// session state rather than the relational store.
const sessions = new Map();

export function createSession(studentId, passageId) {
  const sessionId = randomUUID();
  const session = { sessionId, studentId, passageId, taggedErrors: [] };
  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`No active session with id ${sessionId}`);
  }
  return session;
}

export function addErrorTag(sessionId, wordIndex, errorType) {
  const session = getSession(sessionId);
  const alreadyTagged = session.taggedErrors.some(
    (e) => e.wordIndex === wordIndex
  );
  if (!alreadyTagged) {
    session.taggedErrors.push({ wordIndex, errorType });
  }
  return session;
}

export function endSession(sessionId) {
  const session = getSession(sessionId);
  sessions.delete(sessionId);
  return session;
}
