import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          900: "#0a0f0c",
          800: "#0f1814",
          700: "#13201b",
          600: "#1a2b24",
        },
        gold: {
          400: "#e9c46a",
          500: "#d4a72c",
        },
        win: "#22c55e",
        loss: "#ef4444",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 30px rgba(0, 0, 0, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
