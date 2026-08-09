import type { Provider } from "@/types/mail";

export const providerLabel: Record<Provider, string> = {
  gmail: "Google",
  outlook: "Microsoft",
  yahoo: "Yahoo",
  icloud: "iCloud",
  custom: "Custom",
};
