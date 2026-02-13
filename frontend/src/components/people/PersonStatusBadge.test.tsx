import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PersonStatusBadge } from "./PersonStatusBadge";

describe("PersonStatusBadge", () => {
  it("renders nothing for status 'none'", () => {
    const { container } = render(<PersonStatusBadge status="none" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders 'Invited' badge with amber styling", () => {
    render(<PersonStatusBadge status="invited" />);
    expect(screen.getByText("Invited")).toBeInTheDocument();
    const badge = screen.getByText("Invited").closest("div");
    expect(badge?.className).toContain("bg-amber-100");
    expect(badge?.className).toContain("text-amber-700");
  });

  it("renders 'Active' badge with green styling", () => {
    render(<PersonStatusBadge status="active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    const badge = screen.getByText("Active").closest("div");
    expect(badge?.className).toContain("bg-green-100");
    expect(badge?.className).toContain("text-green-700");
  });

  it("renders 'Inactive' badge with gray styling", () => {
    render(<PersonStatusBadge status="inactive" />);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    const badge = screen.getByText("Inactive").closest("div");
    expect(badge?.className).toContain("bg-gray-100");
    expect(badge?.className).toContain("text-gray-600");
  });

  it("uses compact size classes when size='compact'", () => {
    render(<PersonStatusBadge status="active" size="compact" />);
    const badge = screen.getByText("Active").closest("div");
    expect(badge?.className).toContain("text-xs");
    expect(badge?.className).toContain("px-2");
  });

  it("uses default size classes by default", () => {
    render(<PersonStatusBadge status="active" />);
    const badge = screen.getByText("Active").closest("div");
    expect(badge?.className).toContain("text-sm");
    expect(badge?.className).toContain("px-3");
  });

  it("includes a colored dot indicator", () => {
    render(<PersonStatusBadge status="invited" />);
    const badge = screen.getByText("Invited").closest("div");
    const dot = badge?.querySelector("div");
    expect(dot?.className).toContain("bg-amber-600");
    expect(dot?.className).toContain("rounded-full");
  });
});
