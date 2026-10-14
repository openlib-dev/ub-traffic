import { describe, expect, it } from "vitest";
import { localize } from "@/i18n/localize";

describe("localize", () => {
  it("keeps English when that language is selected", () => {
    expect(localize("en", "No active simulation")).toBe("No active simulation");
  });

  it("translates the morning demand sentence and a comparison", () => {
    expect(localize("mn", "Generating estimated demand toward offices and universities (2000 cars, seed 42)")).toBe(
      "Албан газар, их сургууль руу чиглэсэн тооцоолсон ачааллыг үүсгэж байна (2000 автомашин, санамж 42)",
    );
    expect(
      localize(
        "mn",
        "The scenario has 5 more severe-road seconds than the baseline. The largest gap is 07:30:01, with 4 more severe roads.",
      ),
    ).toContain("07:30:01");
    expect(localize("mn", "Close Peace Avenue for the next run.")).toBe(
      "Peace Avenue замыг дараагийн ажиллуулалтад хаана.",
    );
  });
});