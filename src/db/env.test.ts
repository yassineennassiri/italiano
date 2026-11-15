import { describe, expect, it } from "vitest";
import { databaseUrl } from "./env";

const env = {
  DATABASE_URL: "postgresql://main.example/neondb",
  DATABASE_URL_TEST: "postgresql://dev.example/neondb",
};

describe("databaseUrl", () => {
  it("uses DATABASE_URL (the main branch) by default", () => {
    expect(databaseUrl(env)).toBe("postgresql://main.example/neondb");
  });

  it("uses DATABASE_URL_TEST (the dev branch) when asked for the test database", () => {
    expect(databaseUrl(env, { test: true })).toBe("postgresql://dev.example/neondb");
  });

  it("never falls back to the main branch when the test database is missing", () => {
    expect(() => databaseUrl({ DATABASE_URL: env.DATABASE_URL }, { test: true })).toThrow(
      /DATABASE_URL_TEST is not set/,
    );
  });

  it("names the missing variable and points at .env.example", () => {
    expect(() => databaseUrl({})).toThrow(/DATABASE_URL is not set.*\.env\.example/);
  });

  it("treats an empty value as missing", () => {
    expect(() => databaseUrl({ DATABASE_URL: "  " })).toThrow(/DATABASE_URL is not set/);
  });
});
