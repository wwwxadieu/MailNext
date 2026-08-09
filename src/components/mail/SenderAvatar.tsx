const PALETTE = ["#0A84FF", "#FF9F0A", "#32D74B", "#FF453A", "#BF5AF2", "#64D2FF"];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length] ?? "#0A84FF";
}

interface SenderAvatarProps {
  name: string | null;
  address: string | null;
  size?: number;
  className?: string;
}

export function SenderAvatar({ name, address, size = 28, className }: SenderAvatarProps) {
  const label = name || address || "?";
  const seed = address || name || "?";
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full text-white ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.4),
        backgroundColor: colorFor(seed),
      }}
    >
      <span className="font-medium">{label.charAt(0).toUpperCase()}</span>
    </div>
  );
}
