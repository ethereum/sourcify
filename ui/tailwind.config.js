module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    fontFamily: {
      sans: ["IBM Plex Sans", "Roboto", "sans-serif"],
    },
    extend: {
      colors: {
        ceruleanBlue: {
          100: "#E8EFFF",
          200: "#A9BDEE",
          300: "#7693DA",
          400: "#4C6FC4",
          500: "#2B50AA", // Primary base
          600: "#1C3E8E",
          700: "#142D6B",
          800: "#0E204E",
          900: "#08132F",
        },
        lightCoral: {
          100: "#FFCCD0",
          200: "#FFBABF",
          300: "#FFA9AF",
          400: "#FF9AA1",
          500: "#FF858D", // Secondary base
          600: "#D65861",
          700: "#AE373F",
          800: "#851F26",
          900: "#5D0E13",
        },
        partialMatch: {
          100: "#D9EDB8",
          200: "#CEEC9E",
          300: "#BBE577",
          400: "#A4D851",
          500: "#87B141",
          600: "#6A9B1B",
          700: "#4C730E",
          800: "#395808",
          900: "#273D04",
        },
      },
      minHeight: {
        96: "350px",
      },
    },
  },
  variants: {
    extend: {
      opacity: ["disabled"],
      cursor: ["disabled"],
      textColor: ["disabled"],
    },
  },
  plugins: [],
};
