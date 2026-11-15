import { expect, it } from "vitest";

// Vitest runs without Next's `react-server` condition, just like a Client
// Component bundle would, so this import must fail instead of handing the
// connection string to browser code.
it("the database client cannot be imported outside server code", async () => {
  await expect(import("@/db")).rejects.toThrow(/Client Component/);
});
