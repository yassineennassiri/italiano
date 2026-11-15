import { describe, expect, it } from "vitest";
import { branchFromArgs, databaseUrl } from "./env";

const env = {
  DATABASE_URL: "postgresql://main.example/neondb",
  DATABASE_URL_TEST: "postgresql://dev.example/neondb",
};

describe("databaseUrl", () => {
  it("uses DATABASE_URL for the main branch", () => {
    expect(databaseUrl("main", env)).toBe("postgresql://main.example/neondb");
  });

  it("uses DATABASE_URL_TEST for the dev branch", () => {
    expect(databaseUrl("dev", env)).toBe("postgresql://dev.example/neondb");
  });

  it("never falls back to the main branch when the dev branch is missing", () => {
    expect(() => databaseUrl("dev", { DATABASE_URL: env.DATABASE_URL })).toThrow(/DATABASE_URL_TEST is not set/);
  });

  it("names the missing variable and points at .env.example", () => {
    expect(() => databaseUrl("main", {})).toThrow(/DATABASE_URL is not set.*\.env\.example/);
  });

  it("treats an empty value as missing", () => {
    expect(() => databaseUrl("main", { DATABASE_URL: "  " })).toThrow(/DATABASE_URL is not set/);
  });
});

describe("branchFromArgs", () => {
  it("targets the main branch unless --test is passed", () => {
    expect(branchFromArgs([])).toBe("main");
    expect(branchFromArgs(["--test"])).toBe("dev");
  });
});
