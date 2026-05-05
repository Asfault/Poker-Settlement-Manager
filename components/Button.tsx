"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gold-500 text-felt-900 hover:bg-gold-400 active:bg-gold-500 disabled:bg-gold-500/40 disabled:text-felt-900/50",
  secondary:
    "bg-felt-700 text-white hover:bg-felt-600 border border-white/10 disabled:opacity-50",
  ghost:
    "bg-transparent text-white/80 hover:text-white hover:bg-white/5 disabled:opacity-50",
  danger:
    "bg-loss/90 text-white hover:bg-loss disabled:bg-loss/40",
  success:
    "bg-win/90 text-white hover:bg-win disabled:bg-win/40",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2 text-sm rounded-xl",
  lg: "px-5 py-3 text-base rounded-xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`font-semibold transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    />
  );
});

export default Button;
