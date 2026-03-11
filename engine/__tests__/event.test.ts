import { describe, it, expect } from "vitest";
import { generateEvent } from "../phases/event";

describe("event generation", () => {
  it("generates an event from the pool", () => {
    const event = generateEvent(3, 10, () => 0);
    expect(event).not.toBeNull();
    expect(event!.name).toBeTruthy();
  });

  it("generates different events based on rng", () => {
    const e1 = generateEvent(3, 10, () => 0);
    const e2 = generateEvent(3, 10, () => 0.99);
    expect(e1!.name).not.toBe(e2!.name);
  });
});
