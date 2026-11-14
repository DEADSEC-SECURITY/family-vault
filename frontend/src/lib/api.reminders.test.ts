import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";

vi.mock("./auth", () => ({ getToken: () => "test-token", getActiveOrgId: () => "test-org", removeToken: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
it("sends the horizon and authentication to the real reminder URL, defaulting to 90", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
  vi.stubGlobal("fetch", fetch);
  for (const days of [undefined, 30, 365]) {
    await api.reminders.list(days);
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringMatching(new RegExp(`/reminders\\?days_ahead=${days ?? 90}$`)),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-token" }) }),
    );
  }
});
