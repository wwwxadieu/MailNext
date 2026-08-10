import * as commands from "@/lib/commands";
import * as repo from "@/lib/repository";
import type { Account, CalendarEventDto } from "@/types/mail";

export type GoogleCalendarStatus = "ok" | "needs_reconnect" | "unavailable";

export interface GoogleCalendarResult {
  status: GoogleCalendarStatus;
  events: CalendarEventDto[];
}

/**
 * Fetches upcoming events from a Gmail account's primary Google Calendar.
 * On a 401 ("unauthorized" from the Rust command — an expired access
 * token) this refreshes the token via the account's stored refresh token,
 * persists the new one, and retries once. On a 403 ("forbidden_scope") the
 * account was connected before MailNext started requesting the
 * calendar.readonly scope and needs to reconnect — surfaced as a status
 * the panel can show a hint for, not thrown as an error.
 */
export async function fetchGoogleCalendarEvents(
  account: Account,
  timeMin: string,
  timeMax: string,
): Promise<GoogleCalendarResult> {
  if (account.provider !== "gmail" || !account.access_token) {
    return { status: "unavailable", events: [] };
  }

  try {
    const events = await commands.gmailListCalendarEvents(account.access_token, timeMin, timeMax);
    return { status: "ok", events };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("forbidden_scope")) {
      return { status: "needs_reconnect", events: [] };
    }

    if (message.includes("unauthorized") && account.refresh_token) {
      try {
        const refreshed = await commands.oauthRefresh("gmail", account.refresh_token);
        const expiresAt = refreshed.expiresInSecs ? Date.now() + refreshed.expiresInSecs * 1000 : null;
        await repo.updateAccountTokens(account.id, refreshed.accessToken, refreshed.refreshToken, expiresAt);
        const events = await commands.gmailListCalendarEvents(refreshed.accessToken, timeMin, timeMax);
        return { status: "ok", events };
      } catch {
        return { status: "unavailable", events: [] };
      }
    }

    return { status: "unavailable", events: [] };
  }
}
