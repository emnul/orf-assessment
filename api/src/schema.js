export const typeDefs = `#graphql
  type Passage {
    id: ID!
    gradeLevel: Int!
    title: String!
    wordTokens: [String!]!
    totalWords: Int!
  }

  type Assessment {
    id: ID!
    studentId: ID!
    passageId: ID!
    administeredAt: String!
    season: String!
    wordsRead: Int!
    wcpm: Int!
    accuracyPct: Float!
    riskTier: String!
  }

  enum ErrorType {
    SUBSTITUTION
    OMISSION
    HESITATION
  }

  type ErrorTag {
    wordIndex: Int!
    errorType: ErrorType!
  }

  type AssessmentSession {
    sessionId: ID!
    studentId: ID!
    passageId: ID!
    taggedErrors: [ErrorTag!]!
  }

  type Query {
    passage(grade: Int!): Passage
    studentProgress(studentId: ID!): [Assessment!]!
  }

  type Mutation {
    startAssessment(studentId: ID!, passageId: ID!): AssessmentSession!
    tagError(sessionId: ID!, wordIndex: Int!, errorType: ErrorType!): AssessmentSession!
    submitAssessment(sessionId: ID!, wordsReadIndex: Int!): Assessment!
  }
`;
