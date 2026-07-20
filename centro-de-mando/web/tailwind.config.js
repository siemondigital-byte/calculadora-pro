/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        negro: "rgb(var(--marca-fondo-rgb) / <alpha-value>)",
        navy: "rgb(var(--marca-carbon-rgb) / <alpha-value>)",
        oro: "rgb(var(--marca-acento-rgb) / <alpha-value>)",
        crema: "rgb(var(--marca-texto-rgb) / <alpha-value>)",
        gris: "rgb(var(--marca-texto-suave-rgb) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--marca-fuente-display)"],
        sans: ["var(--marca-fuente-sans)"],
      },
    },
  },
  plugins: [],
};
