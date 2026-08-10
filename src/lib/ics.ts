/** Minimal RFC 5545 (iCalendar) reader — extracts just enough from a
 * calendar-invite attachment (SUMMARY/DTSTART/LOCATION per VEVENT) to power
 * the "upcoming events" list in the calendar panel. Not a full parser: no
 * recurrence rules, no timezone database, no VALARM/VTIMEZONE handling —
 * DTSTART is read either as UTC ("...Z"), as a floating local time, or as
 * an all-day date, which covers the vast majority of real-world invites. */

export interface ParsedIcsEvent {
  summary: string;
  start: Date;
  location: string | null;
  allDay: boolean;
}

function unfoldLines(ics: string): string[] {
  const rawLines = ics.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function parseIcsDate(value: string): { date: Date; allDay: boolean } | null {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s, z] = match;
  const year = Number(y);
  const month = Number(mo) - 1;
  const day = Number(d);
  if (h === undefined) {
    return { date: new Date(year, month, day), allDay: true };
  }
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  if (z) {
    return { date: new Date(Date.UTC(year, month, day, hour, minute, second)), allDay: false };
  }
  return { date: new Date(year, month, day, hour, minute, second), allDay: false };
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

/** Parses every VEVENT block in a raw .ics file's text content. Events with
 * an unparseable or missing DTSTART are skipped rather than guessed at. */
export function parseIcsEvents(ics: string): ParsedIcsEvent[] {
  const lines = unfoldLines(ics);
  const events: ParsedIcsEvent[] = [];

  let inEvent = false;
  let summary = "";
  let location: string | null = null;
  let start: Date | null = null;
  let allDay = false;

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      inEvent = true;
      summary = "";
      location = null;
      start = null;
      allDay = false;
      continue;
    }
    if (line.startsWith("END:VEVENT")) {
      if (inEvent && start) {
        events.push({ summary: summary || "(No title)", start, location, allDay });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = (line.slice(0, colonIndex).split(";")[0] ?? "").toUpperCase();
    const value = line.slice(colonIndex + 1);

    if (key === "SUMMARY") {
      summary = unescapeIcsText(value);
    } else if (key === "LOCATION") {
      location = unescapeIcsText(value) || null;
    } else if (key === "DTSTART") {
      const parsed = parseIcsDate(value.trim());
      if (parsed) {
        start = parsed.date;
        allDay = parsed.allDay;
      }
    }
  }

  return events;
}

/** Decodes a base64-encoded .ics attachment (as stored in EmailAttachment)
 * into text, treating the bytes as UTF-8. Returns an empty string on any
 * decode failure rather than throwing, since this only ever feeds a
 * best-effort "upcoming events" list. */
export function decodeIcsAttachment(base64: string): string {
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}
