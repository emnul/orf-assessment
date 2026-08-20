import { jest } from "@jest/globals";
import {
  createSession,
  getSession,
  addErrorTag,
  endSession,
} from "../sessionStore.js";

describe("sessionStore", () => {
  test("createSession returns a session with no tagged errors", () => {
    const session = createSession("1", "1");
    expect(session.studentId).toBe("1");
    expect(session.passageId).toBe("1");
    expect(session.taggedErrors).toEqual([]);
  });

  test("addErrorTag appends a new tag", () => {
    const session = createSession("1", "1");
    addErrorTag(session.sessionId, 5, "omission");
    const updated = getSession(session.sessionId);
    expect(updated.taggedErrors).toHaveLength(1);
    expect(updated.taggedErrors[0]).toEqual({
      wordIndex: 5,
      errorType: "omission",
    });
  });

  test("tagging the same word index twice does not duplicate", () => {
    const session = createSession("1", "1");
    addErrorTag(session.sessionId, 5, "omission");
    addErrorTag(session.sessionId, 5, "substitution");
    const updated = getSession(session.sessionId);
    expect(updated.taggedErrors).toHaveLength(1);
  });

  test("endSession removes the session so it can't be reused", () => {
    const session = createSession("1", "1");
    endSession(session.sessionId);
    expect(() => getSession(session.sessionId)).toThrow();
  });

  test("getSession throws for an unknown id", () => {
    expect(() => getSession("does-not-exist")).toThrow(
      /No active session/
    );
  });
});
