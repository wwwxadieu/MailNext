import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import clsx from "clsx";
import { useAccountStore } from "@/store/useAccountStore";
import * as repo from "@/lib/repository";
import { decodeIcsAttachment, parseIcsEvents } from "@/lib/ics";
import type { ParsedIcsEvent } from "@/lib/ics";
import { useT } from "@/lib/useT";

interface UpcomingEvent extends ParsedIcsEvent {
  messageSubject: string;
}

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Right-hand panel: a mini month calendar plus an "upcoming events" list
 * scraped from any .ics/.vcs calendar-invite attachments in the account's
 * cached mail (see src/lib/ics.ts) — there's no calendar API integration,
 * this is purely what's already sitting in synced messages. */
export function CalendarPanel() {
  const t = useT();
  const activeAccount = useAccountStore((s) => s.activeAccount());
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeAccount) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void repo
      .listMessagesWithAttachments(activeAccount.id, 300)
      .then((rows) => {
        if (cancelled) return;
        // Include the last day too, in case a same-day invite already
        // started — still useful context rather than noise.
        const horizon = Date.now() - 24 * 60 * 60 * 1000;
        const found: UpcomingEvent[] = [];
        for (const row of rows) {
          for (const attachment of repo.parseAttachments(row.attachments_json)) {
            const looksLikeIcs =
              attachment.mimeType.includes("calendar") || /\.(ics|vcs)$/i.test(attachment.filename);
            if (!looksLikeIcs) continue;
            const text = decodeIcsAttachment(attachment.contentBase64);
            if (!text) continue;
            for (const event of parseIcsEvents(text)) {
              if (event.start.getTime() >= horizon) {
                found.push({ ...event, messageSubject: row.subject });
              }
            }
          }
        }
        found.sort((a, b) => a.start.getTime() - b.start.getTime());
        setEvents(found.slice(0, 8));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeAccount?.id]);

  const days = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [cursor]);

  const eventDaySet = useMemo(() => new Set(events.map((e) => format(e.start, "yyyy-MM-dd"))), [events]);

  return (
    <aside className="glass-panel flex h-full w-72 min-h-0 flex-shrink-0 flex-col rounded-none border-y-0 border-r-0 border-l border-black/10 p-4 dark:border-white/10">
      <div className="mb-3 flex flex-shrink-0 items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{format(cursor, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setCursor((c) => subMonths(c, 1))}
            aria-label={t("calendar.prevMonth")}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <ChevronLeft size={14} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="rounded-lg px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
          >
            {t("calendar.today")}
          </button>
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label={t("calendar.nextMonth")}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <ChevronRight size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="grid flex-shrink-0 grid-cols-7 gap-1 text-center text-[10px] font-medium text-neutral-400">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className="grid flex-shrink-0 grid-cols-7 gap-1 text-center text-[12px]">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const hasEvent = eventDaySet.has(key);
          return (
            <div key={key} className="flex flex-col items-center py-1">
              <span
                className={clsx(
                  "flex h-6 w-6 items-center justify-center rounded-full",
                  today
                    ? "bg-accent font-semibold text-white"
                    : inMonth
                      ? "text-neutral-700 dark:text-neutral-200"
                      : "text-neutral-300 dark:text-neutral-600",
                )}
              >
                {format(day, "d")}
              </span>
              <span className={clsx("mt-0.5 h-1 w-1 rounded-full", hasEvent ? "bg-accent" : "bg-transparent")} />
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto border-t border-black/5 pt-3 dark:border-white/10">
        <p className="flex flex-shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          <CalendarDays size={12} strokeWidth={2} />
          {t("calendar.upcoming")}
        </p>
        {loading && <p className="text-xs text-neutral-400">{t("calendar.loading")}</p>}
        {!loading && events.length === 0 && <p className="text-xs text-neutral-400">{t("calendar.noEvents")}</p>}
        {events.map((event, index) => (
          <div
            key={`${event.summary}-${event.start.toISOString()}-${index}`}
            className="flex-shrink-0 rounded-xl border border-black/5 bg-black/[0.02] p-2.5 dark:border-white/10 dark:bg-white/[0.02]"
          >
            <p className="text-[11px] font-medium tabular-nums text-neutral-400">
              {event.allDay ? format(event.start, "dd/MM/yyyy") : format(event.start, "dd/MM/yyyy • HH:mm")}
            </p>
            <p className="truncate text-[13px] font-medium text-neutral-800 dark:text-neutral-100">{event.summary}</p>
            {event.location && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-neutral-400">
                <MapPin size={10} strokeWidth={1.5} />
                {event.location}
              </p>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
