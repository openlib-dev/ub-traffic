import { describe, expect, it } from "vitest";
import { simulationSocketUrl } from "@/data/simulation-client";

describe("simulationSocketUrl", () => {
  it("keeps a direct worker origin", () => {
    expect(simulationSocketUrl("http://127.0.0.1:8081", "abc", "http://localhost")).toBe(
      "ws://127.0.0.1:8081/runs/abc/events",
    );
  });

  it("keeps a same-origin API prefix", () => {
    expect(simulationSocketUrl("/api", "abc", "https://example.com")).toBe(
      "wss://example.com/api/runs/abc/events",
    );
  });
});
