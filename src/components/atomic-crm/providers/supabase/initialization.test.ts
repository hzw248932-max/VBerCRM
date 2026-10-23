import { expect, it } from "vitest";
import { resolveInitialization } from "./initialization";

it("only sends a confirmed empty database to first-user setup", () => {
  expect(resolveInitialization([{ is_initialized: 0 }], null)).toBe(false);
  expect(resolveInitialization([{ is_initialized: 1 }], null)).toBe(true);
  expect(resolveInitialization([{ is_initialized: "2" }], null)).toBe(true);
});
it("does not mistake failed or malformed reads for an empty database", () => {
  expect(() =>
    resolveInitialization(null, { message: "Failed to fetch" }),
  ).toThrow();
  for (const data of [
    null,
    [],
    [{}],
    [{ is_initialized: null }],
    [{ is_initialized: "" }],
    [{ is_initialized: -1 }],
  ])
    expect(() => resolveInitialization(data, null)).toThrow();
});
