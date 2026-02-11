import { describe, expect, it } from "vitest";
import { humanize, titleCase, formatDate, getFieldValue, repeatLabel } from "./format";

describe("humanize", () => {
  it("replaces underscores with spaces", () => {
    expect(humanize("auto_insurance")).toBe("auto insurance");
  });

  it("handles strings without underscores", () => {
    expect(humanize("passport")).toBe("passport");
  });

  it("handles multiple underscores", () => {
    expect(humanize("state_of_formation")).toBe("state of formation");
  });
});

describe("titleCase", () => {
  it("capitalizes first letter of each word", () => {
    expect(titleCase("auto_insurance")).toBe("Auto Insurance");
  });

  it("handles single word", () => {
    expect(titleCase("passport")).toBe("Passport");
  });

  it("handles multiple underscored words", () => {
    expect(titleCase("state_of_formation")).toBe("State Of Formation");
  });
});

describe("formatDate", () => {
  it("formats ISO date string", () => {
    const result = formatDate("2025-01-15");
    // Date parsing of "YYYY-MM-DD" treats it as UTC, so the local display
    // may be Jan 14 or Jan 15 depending on timezone. Just verify format.
    expect(result).toMatch(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}$/);
    expect(result).toContain("2025");
  });

  it("returns null for null input", () => {
    expect(formatDate(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(formatDate(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(formatDate("")).toBeNull();
  });
});

describe("getFieldValue", () => {
  const mockItem = {
    id: "1",
    org_id: "org1",
    category: "ids",
    subcategory: "passport",
    name: "Test",
    notes: null,
    is_archived: false,
    fields: [
      { field_key: "full_name", field_value: "John Doe", field_type: "text" },
      { field_key: "passport_number", field_value: "ABC123", field_type: "text" },
      { field_key: "empty_field", field_value: null, field_type: "text" },
    ],
    files: [],
    created_at: "2025-01-01",
    updated_at: "2025-01-01",
  };

  it("returns field value by key", () => {
    expect(getFieldValue(mockItem, "full_name")).toBe("John Doe");
    expect(getFieldValue(mockItem, "passport_number")).toBe("ABC123");
  });

  it("returns null for missing field", () => {
    expect(getFieldValue(mockItem, "nonexistent")).toBeNull();
  });

  it("returns null for null field value", () => {
    expect(getFieldValue(mockItem, "empty_field")).toBeNull();
  });
});

describe("repeatLabel", () => {
  it("returns label for known values", () => {
    expect(repeatLabel("weekly")).toBe("Every week");
    expect(repeatLabel("monthly")).toBe("Every month");
    expect(repeatLabel("quarterly")).toBe("Every 3 months");
    expect(repeatLabel("yearly")).toBe("Every year");
  });

  it("returns null for none", () => {
    expect(repeatLabel("none")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(repeatLabel(null)).toBeNull();
    expect(repeatLabel(undefined)).toBeNull();
  });

  it("returns the value itself for unknown strings", () => {
    expect(repeatLabel("biweekly")).toBe("biweekly");
  });
});
