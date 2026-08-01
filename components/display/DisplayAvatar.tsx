"use client";

const PALETTE = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#8b5cf6",
  "#f97316",
  "#14b8a6",
  "#ec4899",
  "#f59e0b",
  "#06b6d4",
  "#84cc16",
];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Larger avatar for the TV, with an optional coloured ring. */
export default function DisplayAvatar({
  name,
  photoUrl,
  size = 72,
  ring,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
  ring?: string;
}) {
  const border = ring ? `3px solid ${ring}` : "2px solid rgba(255,255,255,0.12)";

  if (photoUrl) {
    // The photo sits on a coloured disc rather than directly on the felt.
    // A cut-out PNG shows the colour through; an opaque photo covers it.
    const bg = colorFor(name);
    return (
      <span
        style={{
          width: size,
          height: size,
          border,
          background: `radial-gradient(circle at 50% 35%, ${bg}, ${bg}bb 60%, ${bg}66)`,
        }}
        className="rounded-full shrink-0 inline-block overflow-hidden relative"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt={name}
          style={{ width: "100%", height: "100%" }}
          className="object-cover"
        />
      </span>
    );
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        background: colorFor(name),
        fontSize: Math.round(size * 0.36),
        border,
      }}
      className="rounded-full shrink-0 inline-flex items-center justify-center font-black text-[#0a0f0c]"
    >
      {initials(name)}
    </span>
  );
}
