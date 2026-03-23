"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Slot {
  id: number;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  bookerName: string | null;
  bookerEmail: string | null;
}

interface Booking {
  id: number;
  name: string;
  email: string;
  notes: string | null;
  createdAt: string;
  slotStart: string;
  slotEnd: string;
}

const ukFormat = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export default function AdminDashboard() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<"slots" | "bookings" | "settings">("slots");
  const [loading, setLoading] = useState(true);

  // Slot creation form
  const [slotMode, setSlotMode] = useState<"single" | "recurring">("single");
  const [date, setDate] = useState("");
  const [startHour, setStartHour] = useState("09");
  const [endHour, setEndHour] = useState("17");
  const [recurringDays, setRecurringDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [recurringWeeks, setRecurringWeeks] = useState(2);
  const [creating, setCreating] = useState(false);

  const [adminName, setAdminName] = useState("");
  const [adminSlug, setAdminSlug] = useState("");
  const [copied, setCopied] = useState(false);

  // Pagination (3-week windows)
  const [slotsPage, setSlotsPage] = useState(0);
  const [bookingsPage, setBookingsPage] = useState(0);

  // Cancellation
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);

  // Settings
  const [zoomLink, setZoomLink] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const fetchDataRef = useRef(false);

  useEffect(() => {
    if (fetchDataRef.current) return;
    fetchDataRef.current = true;

    async function load() {
      const [slotsRes, bookingsRes, meRes, settingsRes] = await Promise.all([
        fetch("/api/admin/slots"),
        fetch("/api/admin/bookings"),
        fetch("/api/admin/me"),
        fetch("/api/admin/settings"),
      ]);

      if (slotsRes.status === 401 || bookingsRes.status === 401 || meRes.status === 401) {
        router.push("/admin/login");
        return;
      }

      setSlots(await slotsRes.json());
      setBookings(await bookingsRes.json());
      const me = await meRes.json();
      setAdminName(me.name);
      setAdminSlug(me.bookingLink || "");
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setZoomLink(s.zoomLink || "");
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function refreshSlots() {
    const [slotsRes, bookingsRes] = await Promise.all([
      fetch("/api/admin/slots"),
      fetch("/api/admin/bookings"),
    ]);
    if (slotsRes.ok) setSlots(await slotsRes.json());
    if (bookingsRes.ok) setBookings(await bookingsRes.json());
  }

  function getDatesForRecurring(): string[] {
    const dates: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let d = 0; d < recurringWeeks * 7; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() + d);
      const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon...
      if (recurringDays.includes(dayOfWeek)) {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, "0");
        const dd = date.getDate().toString().padStart(2, "0");
        dates.push(`${y}-${m}-${dd}`);
      }
    }
    return dates;
  }

  async function createSlot() {
    setCreating(true);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const start = parseInt(startHour);
    const end = parseInt(endHour);
    const slotsToCreate: { startTime: string; endTime: string }[] = [];

    if (slotMode === "recurring") {
      const dates = getDatesForRecurring();
      for (const d of dates) {
        for (let h = start; h < end; h++) {
          slotsToCreate.push({
            startTime: ukToUtc(`${d}T${pad(h)}:00`),
            endTime: ukToUtc(`${d}T${pad(h + 1)}:00`),
          });
        }
      }
    } else {
      if (!date) { setCreating(false); return; }
      for (let h = start; h < end; h++) {
        slotsToCreate.push({
          startTime: ukToUtc(`${date}T${pad(h)}:00`),
          endTime: ukToUtc(`${date}T${pad(h + 1)}:00`),
        });
      }
    }

    if (slotsToCreate.length > 0) {
      await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slotsToCreate),
      });
    }

    setCreating(false);
    refreshSlots();
  }

  async function deleteSlot(id: number) {
    await fetch(`/api/admin/slots/${id}`, { method: "DELETE" });
    refreshSlots();
  }

  async function saveSettings() {
    setSavingSettings(true);
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zoomLink }),
    });
    setSavingSettings(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }

  async function cancelBooking(id: number, notify: boolean) {
    setCancellingId(id);
    await fetch(`/api/admin/bookings/${id}?notify=${notify}`, { method: "DELETE" });
    setConfirmCancelId(null);
    setCancellingId(null);
    refreshSlots();
  }

  const WINDOW_MS = 21 * 24 * 60 * 60 * 1000; // 3 weeks

  function getWindowRange(page: number) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(now.getTime() + page * WINDOW_MS);
    const end = new Date(start.getTime() + WINDOW_MS);
    return { start, end };
  }

  function formatWindowLabel(page: number) {
    const { start, end } = getWindowRange(page);
    const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${fmt(start)} — ${fmt(end)}`;
  }

  const slotsWindow = getWindowRange(slotsPage);
  const pagedSlots = slots.filter((s) => {
    const t = new Date(s.startTime).getTime();
    return t >= slotsWindow.start.getTime() && t < slotsWindow.end.getTime();
  });
  const hasNextSlots = slots.some((s) => new Date(s.startTime).getTime() >= slotsWindow.end.getTime());

  const bookingsWindow = getWindowRange(bookingsPage);
  const pagedBookings = bookings.filter((b) => {
    const t = new Date(b.slotStart).getTime();
    return t >= bookingsWindow.start.getTime() && t < bookingsWindow.end.getTime();
  });
  const hasNextBookings = bookings.some((b) => new Date(b.slotStart).getTime() >= bookingsWindow.end.getTime());

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-zinc-900 sm:text-2xl">{adminName.split(" ")[0]}&apos;s Meetings</h1>
            <button
              onClick={async () => {
                await fetch("/api/admin/logout", { method: "POST" });
                router.push("/admin/login");
              }}
              className="text-sm text-zinc-400 hover:text-red-600 transition"
            >
              Logout
            </button>
          </div>

          {/* Booking Link */}
          {adminSlug && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(adminSlug);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="mt-2 flex w-full max-w-full items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 transition"
            >
              <span className="min-w-0 truncate font-mono">{adminSlug}</span>
              <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-600">
                {copied ? "Copied!" : "Copy"}
              </span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-zinc-100 p-1">
          {(["slots", "bookings", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition ${
                tab === t
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {t === "slots" ? "Slots" : t === "bookings" ? `Bookings (${bookings.length})` : "Settings"}
            </button>
          ))}
        </div>

        {tab === "slots" && (
          <>
            {/* Create Slot Form */}
            <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-medium text-zinc-900">Add Availability</h2>

              {/* Mode toggle */}
              <div className="mb-4 flex gap-1 rounded-lg bg-zinc-100 p-1">
                {(["single", "recurring"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSlotMode(m)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-center text-xs font-medium transition ${
                      slotMode === m
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {m === "single" ? "Single Day" : "Recurring"}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {slotMode === "single" ? (
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs text-zinc-500">Days</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { day: 1, label: "Mon" },
                          { day: 2, label: "Tue" },
                          { day: 3, label: "Wed" },
                          { day: 4, label: "Thu" },
                          { day: 5, label: "Fri" },
                          { day: 6, label: "Sat" },
                          { day: 0, label: "Sun" },
                        ].map(({ day, label }) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() =>
                              setRecurringDays((prev) =>
                                prev.includes(day)
                                  ? prev.filter((d) => d !== day)
                                  : [...prev, day]
                              )
                            }
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                              recurringDays.includes(day)
                                ? "bg-zinc-900 text-white"
                                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-500">Weeks ahead</label>
                      <select
                        value={recurringWeeks}
                        onChange={(e) => setRecurringWeeks(parseInt(e.target.value))}
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                      >
                        {[1, 2, 3, 4, 6, 8].map((w) => (
                          <option key={w} value={w}>
                            {w} {w === 1 ? "week" : "weeks"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Time range (shared) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">From (UK)</label>
                    <select
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i.toString().padStart(2, "0")}>
                          {i.toString().padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Until (UK)</label>
                    <select
                      value={endHour}
                      onChange={(e) => setEndHour(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i.toString().padStart(2, "0")}>
                          {i.toString().padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={createSlot}
                  disabled={creating || (slotMode === "single" && !date) || (slotMode === "recurring" && recurringDays.length === 0)}
                  className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {creating
                    ? "Adding..."
                    : slotMode === "recurring"
                      ? `Add ${recurringDays.length} day${recurringDays.length !== 1 ? "s" : ""} × ${recurringWeeks} week${recurringWeeks !== 1 ? "s" : ""}`
                      : "Add Slots"}
                </button>
              </div>
            </div>

            {/* Slots List */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 sm:px-6">
                <h2 className="text-sm font-medium text-zinc-900">
                  Slots ({pagedSlots.length} of {slots.length})
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSlotsPage((p) => Math.max(0, p - 1))}
                    disabled={slotsPage === 0}
                    className="rounded p-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-xs text-zinc-500">{formatWindowLabel(slotsPage)}</span>
                  <button
                    onClick={() => setSlotsPage((p) => p + 1)}
                    disabled={!hasNextSlots}
                    className="rounded p-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
              {pagedSlots.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-400 sm:px-6">
                  No slots in this period.
                </p>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {pagedSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-start justify-between gap-2 px-4 py-3 sm:items-center sm:px-6"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              slot.isBooked ? "bg-blue-500" : "bg-emerald-500"
                            }`}
                          />
                          <span className="text-sm text-zinc-900">
                            {ukFormat(slot.startTime)} — {ukFormat(slot.endTime).split(", ").pop()}
                          </span>
                        </div>
                        {slot.isBooked && (
                          <p className="ml-4 mt-1 truncate text-xs text-blue-700">
                            {slot.bookerName || "Booked"}{slot.bookerEmail && <span className="ml-1 text-blue-500">({slot.bookerEmail})</span>}
                          </p>
                        )}
                      </div>
                      {!slot.isBooked && (
                        <button
                          onClick={() => deleteSlot(slot.id)}
                          className="shrink-0 text-sm text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "bookings" && (
          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 sm:px-6">
              <h2 className="text-sm font-medium text-zinc-900">
                Bookings ({pagedBookings.length} of {bookings.length})
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setBookingsPage((p) => Math.max(0, p - 1))}
                  disabled={bookingsPage === 0}
                  className="rounded p-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-xs text-zinc-500">{formatWindowLabel(bookingsPage)}</span>
                <button
                  onClick={() => setBookingsPage((p) => p + 1)}
                  disabled={!hasNextBookings}
                  className="rounded p-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
            {pagedBookings.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-400 sm:px-6">
                No bookings in this period.
              </p>
            ) : (
              <div className="divide-y divide-zinc-100">
                {pagedBookings.map((b) => (
                  <div key={b.id} className="px-4 py-4 sm:px-6">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900">{b.name}</p>
                        <p className="truncate text-sm text-zinc-500">{b.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-zinc-600">
                          {ukFormat(b.slotStart)} — {ukFormat(b.slotEnd).split(", ").pop()}
                        </p>
                        {confirmCancelId !== b.id && (
                          <button
                            onClick={() => setConfirmCancelId(b.id)}
                            className="shrink-0 text-sm text-red-500 hover:text-red-700"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                    {b.notes && (
                      <p className="mt-2 text-sm text-zinc-500">
                        <span className="font-medium">Notes:</span> {b.notes}
                      </p>
                    )}
                    {confirmCancelId === b.id && (
                      <div className="mt-3 rounded-lg bg-red-50 px-4 py-3">
                        <p className="mb-2 text-sm text-red-800">
                          Cancel this booking and reopen the slot?
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => cancelBooking(b.id, true)}
                            disabled={cancellingId === b.id}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {cancellingId === b.id ? "Cancelling..." : "Cancel & Notify"}
                          </button>
                          <button
                            onClick={() => cancelBooking(b.id, false)}
                            disabled={cancellingId === b.id}
                            className="rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-300 disabled:opacity-50"
                          >
                            Cancel Silently
                          </button>
                          <button
                            onClick={() => setConfirmCancelId(null)}
                            className="px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-700"
                          >
                            Back
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "settings" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-lg font-medium text-zinc-900">Settings</h2>
            <div className="max-w-md space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  Zoom Meeting Link
                </label>
                <input
                  type="url"
                  value={zoomLink}
                  onChange={(e) => setZoomLink(e.target.value)}
                  placeholder="https://zoom.us/j/your-meeting-id"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
                <p className="mt-1 text-xs text-zinc-400">
                  This link will be included in booking confirmation emails.
                </p>
              </div>
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {savingSettings ? "Saving..." : settingsSaved ? "Saved!" : "Save Settings"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Convert a UK local time string (YYYY-MM-DDTHH:mm) to a UTC ISO string.
 * Handles both GMT and BST automatically.
 */
function ukToUtc(ukLocalString: string): string {
  // Build a Date in UTC, then find the UK offset for that date
  const naive = new Date(ukLocalString + ":00Z"); // treat as UTC initially

  // Get UK offset by formatting in Europe/London
  const ukFormatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(naive);

  const parts: Record<string, string> = {};
  for (const p of ukFormatted) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }

  const ukAtNaive = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`
  );
  const offsetMs = ukAtNaive.getTime() - naive.getTime();

  // Subtract the offset to get true UTC
  const utc = new Date(naive.getTime() - offsetMs);
  return utc.toISOString();
}
