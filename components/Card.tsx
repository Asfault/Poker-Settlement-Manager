import { ReactNode } from "react";

export default function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-felt-800/80 backdrop-blur border border-white/5 rounded-2xl shadow-card ${className}`}
    >
      {children}
    </div>
  );
}
