"use client";

import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { formatShowDate, formatShowTime } from "@/lib/format";
import { submitAvails } from "./actions";

export type AvailsShow = {
  id: number;
  city: string;
  neighborhood: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  isAllStar: boolean;
  isTravel: boolean;
};

type CityGroup = { city: string; shows: AvailsShow[] };

const noopSubscribe = () => () => {};

// Timestamps render in the viewer's own timezone. The server can't know it,
// so the server render is blank and the client fills it in after hydration.
function useLocalDateTime(iso: string | null): string {
  return useSyncExternalStore(
    noopSubscribe,
    () =>
      iso
        ? new Date(iso).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "",
    () => ""
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** By city (alphabetical); within a city by date, then time. */
function groupByCity(shows: AvailsShow[]): CityGroup[] {
  const groups = new Map<string, CityGroup>();
  for (const show of shows) {
    const key = show.city.trim().toLowerCase();
    const group = groups.get(key) ?? { city: show.city.trim(), shows: [] };
    group.shows.push(show);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.city.localeCompare(b.city, "en", { sensitivity: "base" }))
    .map((g) => ({
      ...g,
      shows: g.shows.sort(
        (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id - b.id
      ),
    }));
}

export function AvailsForm({
  shows,
  initialAnswers,
  lastSubmittedAt,
}: {
  shows: AvailsShow[];
  initialAnswers: Record<number, boolean>;
  lastSubmittedAt: string | null;
}) {
  const [answers, setAnswers] = useState<Record<number, boolean>>(initialAnswers);
  const [lastSubmitted, setLastSubmitted] = useState(lastSubmittedAt);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [triedToSubmit, setTriedToSubmit] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [saving, startSaving] = useTransition();
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const groups = useMemo(() => groupByCity(shows), [shows]);
  // Display order, which is also the order "first unanswered" is judged in.
  const ordered = useMemo(() => groups.flatMap((g) => g.shows), [groups]);

  const answeredCount = ordered.filter((s) => answers[s.id] !== undefined).length;
  const missing = ordered.length - answeredCount;
  const lastSubmittedText = useLocalDateTime(lastSubmitted);

  function answer(showId: number, available: boolean) {
    // Tapping the selected pill again does nothing.
    if (answers[showId] === available) return;
    setAnswers((prev) => ({ ...prev, [showId]: available }));
    setSavedAt(null);
    setServerError(null);
  }

  function flash(showId: number) {
    const el = document.getElementById(`show-${showId}`);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    setHighlightId(showId);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 1600);
  }

  function submit() {
    setServerError(null);
    const firstUnanswered = ordered.find((s) => answers[s.id] === undefined);
    if (firstUnanswered) {
      setTriedToSubmit(true);
      flash(firstUnanswered.id);
      return;
    }

    startSaving(async () => {
      const result = await submitAvails(
        ordered.map((s) => ({ showId: s.id, available: answers[s.id] }))
      );
      if (result.ok) {
        const now = new Date();
        setSavedAt(now);
        setLastSubmitted(now.toISOString());
        setTriedToSubmit(false);
      } else {
        setServerError(result.error ?? "Couldn't save your avails. Try again.");
      }
    });
  }

  if (ordered.length === 0) {
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        <p className="text-sm text-zinc-600">No upcoming shows yet. Check back soon.</p>
      </main>
    );
  }

  const missingError =
    triedToSubmit && missing > 0
      ? `Mark in or out for ${missing} more show${missing === 1 ? "" : "s"}.`
      : null;
  const error = missingError ?? serverError;

  return (
    <>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-4">
        {lastSubmitted && (
          <p className="mb-4 min-h-5 text-sm text-zinc-500">
            {lastSubmittedText && `Last submitted ${lastSubmittedText}`}
          </p>
        )}

        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.city.toLowerCase()}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                {group.city}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.shows.map((show) => (
                  <ShowRow
                    key={show.id}
                    show={show}
                    answer={answers[show.id]}
                    highlighted={highlightId === show.id}
                    onAnswer={(available) => answer(show.id, available)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>

      <div className="sticky bottom-0 border-t border-black/10 bg-white">
        <div className="mx-auto w-full max-w-xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <p className="text-sm text-zinc-600">
            {answeredCount} of {ordered.length} answered
          </p>
          <div aria-live="polite" className="min-h-5 text-sm">
            {error && <p className="text-red-600">{error}</p>}
            {!error && savedAt && (
              <p className="text-emerald-700">
                Avails saved · Saved at {formatTime(savedAt)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="mt-2 w-full rounded-md bg-[#DA1717] px-4 py-3 text-base font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Submit avails"}
          </button>
        </div>
      </div>
    </>
  );
}

function ShowRow({
  show,
  answer,
  highlighted,
  onAnswer,
}: {
  show: AvailsShow;
  answer: boolean | undefined;
  highlighted: boolean;
  onAnswer: (available: boolean) => void;
}) {
  const title = show.neighborhood?.trim() || show.city;
  const when = `${formatShowDate(show.date)}, ${formatShowTime(show.time)}`;

  return (
    <li
      id={`show-${show.id}`}
      className={`rounded-md border px-4 py-3 transition-colors duration-500 ${
        show.isAllStar ? "border-l-4 border-black/10 border-l-[#DA1717]" : "border-black/10"
      } ${highlighted ? "bg-red-50" : "bg-white"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`font-medium ${show.isAllStar ? "text-[#5A0000]" : "text-zinc-950"}`}
          >
            {show.isAllStar && "★ "}
            {title}
          </p>
          <p className="text-sm text-zinc-600">
            {when}
            {show.isAllStar && (
              <>
                ,{" "}
                <span className="whitespace-nowrap">all-star</span>
              </>
            )}
          </p>
          {show.isTravel && (
            <span className="mt-1 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-500">
              Travel
            </span>
          )}
        </div>

        <div role="group" aria-label={`Availability for ${title}, ${when}`} className="flex shrink-0 gap-2">
          <Pill label="In" selected={answer === true} tone="in" onClick={() => onAnswer(true)} />
          <Pill label="Out" selected={answer === false} tone="out" onClick={() => onAnswer(false)} />
        </div>
      </div>
    </li>
  );
}

function Pill({
  label,
  selected,
  tone,
  onClick,
}: {
  label: string;
  selected: boolean;
  tone: "in" | "out";
  onClick: () => void;
}) {
  const style = selected
    ? tone === "in"
      ? "border-[#DA1717] bg-[#DA1717] text-white"
      : "border-neutral-700 bg-neutral-700 text-white"
    : "border-zinc-300 bg-white text-zinc-700";

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`h-10 min-w-16 rounded-full border px-4 text-sm font-medium ${style}`}
    >
      {label}
    </button>
  );
}
