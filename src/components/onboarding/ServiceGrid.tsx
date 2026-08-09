import type { FC, SVGProps } from "react";
import { GmailIcon, ICloudIcon, OutlookIcon, YahooIcon } from "@/components/icons/BrandIcons";
import type { Provider } from "@/types/mail";

interface ServiceGridProps {
  onSelect: (provider: Provider) => void;
}

const services: { provider: Provider; label: string; icon: FC<SVGProps<SVGSVGElement>> }[] = [
  { provider: "gmail", label: "Gmail", icon: GmailIcon },
  { provider: "outlook", label: "Outlook", icon: OutlookIcon },
  { provider: "icloud", label: "iCloud", icon: ICloudIcon },
  { provider: "yahoo", label: "Yahoo Mail", icon: YahooIcon },
];

export function ServiceGrid({ onSelect }: ServiceGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {services.map(({ provider, label, icon: Icon }) => (
        <button
          key={provider}
          onClick={() => onSelect(provider)}
          className="glass-card group flex flex-col items-center justify-center gap-3 rounded-2xl p-6 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <Icon className="h-11 w-11 drop-shadow-sm transition-transform duration-150 group-hover:scale-105" />
          <span className="text-sm font-medium tracking-tight text-neutral-800 dark:text-neutral-100">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
