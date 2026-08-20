import "dotenv/config";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers.js";
import { initDb } from "./db.js";

await initDb();

const server = new ApolloServer({ typeDefs, resolvers });

const PORT = process.env.PORT || 4000;

const { url } = await startStandaloneServer(server, {
  listen: { port: Number(PORT), host: "0.0.0.0" },
});

console.log(`ORF GraphQL API ready at ${url}`);
