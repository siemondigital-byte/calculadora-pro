/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        negro: "#0A0A0C",
        navy: "#0F1B2D",
        oro: "#E6C788",
        crema: "#F4EFE6",
        gris: "#D7D7D9",
      },
      fontFamily: {
        display: ['"Bodoni Moda"', "serif"],
        sans: ['"Instrument Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
