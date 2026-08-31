import { CSSProperties, ReactNode } from "react";

export default function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  /** For the few cases needing a runtime colour, like the season accent. */
  style?: CSSProperties;
}) {
  return (
    <div
      className={`bg-felt-800/80 backdrop-blur border border-white/5 rounded-2xl shadow-card ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
