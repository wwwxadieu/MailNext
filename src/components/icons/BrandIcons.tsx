// Simplified, original vector marks that evoke each provider's brand
// identity (silhouette + brand color) without reproducing any trademarked
// logo artwork pixel-for-pixel.

import type { SVGProps } from "react";

export function GmailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <rect x="4" y="10" width="40" height="28" rx="4" fill="#ffffff" />
      <path d="M4 14L24 28L44 14" stroke="#EA4335" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M6 12h6v22.5H6a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2Z" fill="#4285F4" />
      <path d="M42 12h-6v22.5h6a2 2 0 0 0 2-2V14a2 2 0 0 0-2-2Z" fill="#34A853" />
      <path d="M12 12h6l6 5-6 5-6-5Z" fill="#FBBC05" />
      <path d="M36 12h-6l-6 5 6 5 6-5Z" fill="#EA4335" />
    </svg>
  );
}

export function OutlookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <rect x="20" y="6" width="24" height="30" rx="3" fill="#1B6EF3" />
      <path d="M20 12h24v6H20z" fill="#0F58D6" />
      <rect x="24" y="16" width="16" height="16" rx="1.5" fill="#ffffff" />
      <path d="M27 20l6 4.4 6-4.4" stroke="#1B6EF3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <ellipse cx="12" cy="24" rx="10" ry="12" fill="#0A4CC7" />
      <ellipse cx="12" cy="24" rx="5.5" ry="7.2" fill="#ffffff" />
    </svg>
  );
}

export function ICloudIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <path
        d="M15 34a9 9 0 0 1-1.2-17.9A11 11 0 0 1 34.9 13 8.5 8.5 0 0 1 33.5 34H15Z"
        fill="url(#icloud-gradient)"
      />
      <defs>
        <linearGradient id="icloud-gradient" x1="6" y1="13" x2="38" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5AC8FA" />
          <stop offset="1" stopColor="#0A84FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function YahooIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      <rect x="4" y="4" width="40" height="40" rx="9" fill="#6001D2" />
      <path
        d="M17 14l6 11.3V32h2.6v-6.7L31.6 14h-3.4l-4 8-4-8H17Z"
        fill="#ffffff"
      />
      <circle cx="32.5" cy="30.5" r="2.6" fill="#ffffff" />
    </svg>
  );
}
