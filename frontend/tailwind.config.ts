import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          100: "#f0fdf4",
          500: "#22c55e",
          700: "#15803d",
          900: "#14532d"
        }
      }
    }
  },
  plugins: [],
} satisfies Config;
