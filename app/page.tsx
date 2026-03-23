"use client";

import { useState, useEffect, useMemo, useSyncExternalStore, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Slot {
  id: number;
  startTime: string;
  endTime: string;
}

interface BookingResult {
  booking: { id: number };
  zoomLink: string;
}

const HOSTS: Record<string, { name: string; initial: string }> = {
  alice: { name: "Alice Smith", initial: "A" },
  bob: { name: "Bob Jones", initial: "B" },
};

const subscribeNoop = () => () => {};
const getTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const getServerTimezone = () => "Europe/London";

function BookingPageInner() {
  const searchParams = useSearchParams();
  const accessKey = searchParams.get("key");
  const hostSlug = searchParams.get("host");
  const host = hostSlug ? HOSTS[hostSlug] : null;

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantInput, setParticipantInput] = useState("");
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState<BookingResult | null>(null);
  const [error, setError] = useState("");

  const tz = useSyncExternalStore(subscribeNoop, getTimezone, getServerTimezone);

  useEffect(() => {
    async function load() {
      if (!accessKey || !hostSlug || !HOSTS[hostSlug]) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      const r = await fetch(`/api/slots?key=${encodeURIComponent(accessKey)}&host=${hostSlug}`);
      if (!r.ok) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      setAuthorized(true);
      const data = await r.json();
      setSlots(Array.isArray(data) ? data : []);
      setLoading(false);
    }
    load();
  }, [accessKey, hostSlug]);

  const slotsByDate = useMemo(() => {
    const map: Record<string, Slot[]> = {};
    for (const slot of slots) {
      const localDate = new Date(slot.startTime).toLocaleDateString("en-CA", { timeZone: tz });
      if (!map[localDate]) map[localDate] = [];
      map[localDate].push(slot);
    }
    return map;
  }, [slots, tz]);

  const availableDates = new Set(Object.keys(slotsByDate));
  const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(calMonth.year, calMonth.month, 1).getDay() + 6) % 7;
  const monthName = new Date(calMonth.year, calMonth.month).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const slotsForDate = selectedDate ? slotsByDate[selectedDate] || [] : [];

  function formatLocalTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
      hour12: false,
    });
  }

  function formatUkTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
      hour12: false,
    });
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setBooking(true);
    setError("");

    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slotId: selectedSlot.id,
        name,
        email,
        notes: notes || undefined,
        participants: participants.length > 0 ? participants : undefined,
        key: accessKey,
      }),
    });

    if (res.ok) {
      setBooked(await res.json());
    } else {
      const data = await res.json();
      setError(data.error || "Something went wrong");
    }
    setBooking(false);
  }

  // Access denied / invalid link
  if (authorized === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
              <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-zinc-900">Access Required</h2>
            <p className="text-sm text-zinc-500">
              You need a valid booking link to view availability. Please check your email for the link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (authorized === null || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  // Booked confirmation
  if (booked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-zinc-900">Meeting Booked!</h2>
            <p className="mb-6 text-sm text-zinc-500">
              A confirmation email has been sent to <strong>{email}</strong>
            </p>
            <div className="mb-6 rounded-lg bg-zinc-50 p-4 text-left text-sm">
              <p className="text-zinc-600">
                <span className="font-medium text-zinc-900">With:</span> {host?.name}
              </p>
              <p className="mt-1 text-zinc-600">
                <span className="font-medium text-zinc-900">Date:</span>{" "}
                {selectedSlot &&
                  new Date(selectedSlot.startTime).toLocaleDateString(undefined, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: tz,
                  })}
              </p>
              <p className="mt-1 text-zinc-600">
                <span className="font-medium text-zinc-900">Time:</span>{" "}
                {selectedSlot && formatLocalTime(selectedSlot.startTime)} —{" "}
                {selectedSlot && formatLocalTime(selectedSlot.endTime)} ({tz})
              </p>
            </div>
            <p className="text-sm text-zinc-500">
              Details sent to your email.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Calendar + booking view
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-lg font-bold text-white">
            {host!.initial}
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">{host!.name}</h1>
          <p className="mt-1 text-zinc-500">Book a 1-hour meeting via Zoom</p>
          <p className="mt-1 text-xs text-zinc-400">Times shown in {tz}</p>
        </div>

        {slots.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
            <p className="text-zinc-500">No available slots right now. Check back soon!</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[280px_1fr]">
            {/* Calendar */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={() =>
                    setCalMonth((m) => {
                      const d = new Date(m.year, m.month - 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    })
                  }
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-medium text-zinc-900">{monthName}</span>
                <button
                  onClick={() =>
                    setCalMonth((m) => {
                      const d = new Date(m.year, m.month + 1);
                      return { year: d.getFullYear(), month: d.getMonth() };
                    })
                  }
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-400">
                {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                  <div key={d} className="py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const dateStr = `${calMonth.year}-${(calMonth.month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
                  const hasSlots = availableDates.has(dateStr);
                  const isSelected = selectedDate === dateStr;
                  const isPast = new Date(dateStr) < new Date(new Date().toLocaleDateString("en-CA"));

                  return (
                    <button
                      key={day}
                      disabled={!hasSlots || isPast}
                      onClick={() => {
                        setSelectedDate(dateStr);
                        setSelectedSlot(null);
                      }}
                      className={`rounded-lg py-1.5 transition ${
                        isSelected
                          ? "bg-zinc-900 font-medium text-white"
                          : hasSlots && !isPast
                            ? "font-medium text-zinc-900 hover:bg-zinc-100"
                            : "text-zinc-300"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slots / Booking Form */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              {!selectedDate ? (
                <p className="py-12 text-center text-sm text-zinc-400">
                  Select a date to see available times
                </p>
              ) : slotsForDate.length === 0 ? (
                <p className="py-12 text-center text-sm text-zinc-400">No slots on this date</p>
              ) : selectedSlot ? (
                <div>
                  <button
                    onClick={() => setSelectedSlot(null)}
                    className="mb-4 text-sm text-zinc-500 hover:text-zinc-700"
                  >
                    &larr; Back to times
                  </button>
                  <div className="mb-4 rounded-lg bg-zinc-50 p-3 text-sm">
                    <p className="font-medium text-zinc-900">
                      {new Date(selectedSlot.startTime).toLocaleDateString(undefined, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: tz,
                      })}
                    </p>
                    <p className="text-zinc-600">
                      {formatLocalTime(selectedSlot.startTime)} — {formatLocalTime(selectedSlot.endTime)}
                      <span className="ml-2 text-zinc-400">({tz})</span>
                    </p>
                    <p className="text-xs text-zinc-400">
                      {formatUkTime(selectedSlot.startTime)} — {formatUkTime(selectedSlot.endTime)} UK
                    </p>
                  </div>
                  <form onSubmit={handleBook} className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-500">Name *</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-500">Email *</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        placeholder="you@example.com"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-500">Notes</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                        placeholder="What would you like to discuss?"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-500">Additional Participants</label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={participantInput}
                          onChange={(e) => setParticipantInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const val = participantInput.trim().toLowerCase();
                              if (val && val.includes("@") && !participants.includes(val)) {
                                setParticipants([...participants, val]);
                                setParticipantInput("");
                              }
                            }
                          }}
                          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                          placeholder="colleague@example.com"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = participantInput.trim().toLowerCase();
                            if (val && val.includes("@") && !participants.includes(val)) {
                              setParticipants([...participants, val]);
                              setParticipantInput("");
                            }
                          }}
                          className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200"
                        >
                          Add
                        </button>
                      </div>
                      {participants.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {participants.map((p) => (
                            <span key={p} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700">
                              {p}
                              <button
                                type="button"
                                onClick={() => setParticipants(participants.filter((x) => x !== p))}
                                className="text-zinc-400 hover:text-zinc-600"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <button
                      type="submit"
                      disabled={booking}
                      className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {booking ? "Booking..." : "Confirm Booking"}
                    </button>
                  </form>
                </div>
              ) : (
                <div>
                  <h3 className="mb-4 text-sm font-medium text-zinc-900">
                    {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </h3>
                  <div className="space-y-2">
                    {slotsForDate
                      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                      .map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedSlot(slot)}
                          className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-left transition hover:border-zinc-900 hover:bg-zinc-50"
                        >
                          <span className="text-sm font-medium text-zinc-900">
                            {formatLocalTime(slot.startTime)} — {formatLocalTime(slot.endTime)}
                          </span>
                          <span className="ml-2 text-xs text-zinc-400">
                            {formatUkTime(slot.startTime)} — {formatUkTime(slot.endTime)} UK
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-50"><p className="text-zinc-400">Loading...</p></div>}>
      <BookingPageInner />
    </Suspense>
  );
}
