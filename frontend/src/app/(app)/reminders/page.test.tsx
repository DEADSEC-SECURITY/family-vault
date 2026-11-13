import { beforeEach, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RemindersPage from "./page";
import { api } from "@/lib/api";
import type { Reminder } from "@/lib/api";

vi.mock("@/lib/api", () => ({ api: { reminders: { list: vi.fn(), delete: vi.fn() } } }));
vi.mock("@/components/items/ReminderCard", () => ({
  ReminderCard: ({ reminder }: { reminder: Reminder }) => <p>{reminder.field_label}</p>,
}));
const list = vi.mocked(api.reminders.list);
beforeEach(() => { vi.resetAllMocks(); list.mockResolvedValue([]); });

it("defaults to 90 days and requests each selected horizon", async () => {
  const user = userEvent.setup();
  render(<RemindersPage />);
  expect(screen.getByLabelText("Date range")).toHaveValue("90");
  await waitFor(() => expect(list).toHaveBeenCalledWith(90));
  for (const days of [30, 365, 90]) {
    await user.selectOptions(screen.getByLabelText("Date range"), String(days));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(days));
  }
  expect(screen.getByText("Overdue reminders are always included.")).toBeInTheDocument();
});

it("shows loading, hides stale results on failure, and retries the selected range", async () => {
  const user = userEvent.setup();
  list.mockResolvedValueOnce([{ item_id: "one", field_label: "Near term", is_overdue: false } as Reminder]);
  render(<RemindersPage />);
  await screen.findByText("Near term");
  let reject!: (reason: Error) => void;
  list.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  await user.selectOptions(screen.getByLabelText("Date range"), "365");
  expect(screen.getByRole("status")).toHaveTextContent("Loading reminders");
  expect(screen.queryByText("Near term")).not.toBeInTheDocument();
  reject(new Error("offline"));
  await screen.findByRole("alert");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("No upcoming expirations");
  expect(list).toHaveBeenLastCalledWith(365);
});

it("ignores an older response after the range changes", async () => {
  const user = userEvent.setup();
  let resolve!: (data: Reminder[]) => void;
  const olderResponse = new Promise<Reminder[]>((done) => { resolve = done; });
  list.mockReturnValueOnce(olderResponse);
  render(<RemindersPage />);
  await user.selectOptions(screen.getByLabelText("Date range"), "30");
  await screen.findByText("No upcoming expirations");
  await act(async () => {
    resolve([{ item_id: "old", field_label: "Old response", is_overdue: false } as Reminder]);
    await olderResponse;
  });
  expect(screen.queryByText("Old response")).not.toBeInTheDocument();
});
