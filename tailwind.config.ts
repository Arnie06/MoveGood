import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1f2933",
        mist: "#f7f4ef",
        sand: "#f0e6d8",
        clay: "#d68b5c",
        moss: "#617a55",
        ocean: "#1f5c6d",
        sky: "#e1eef2",
        rose: "#f4dede"
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"]
      },
      boxShadow: {
        soft: "0 20px 45px rgba(31, 41, 51, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
