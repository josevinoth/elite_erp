import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Default to ERP control script port; override with VITE_BACKEND_URL when needed.
const backendTarget = process.env.VITE_BACKEND_URL || "http://127.0.0.1:8010";

export default defineConfig({
  plugins: [react()],
  base: "/static/",   // built asset URLs will be /static/assets/... matching Django's STATIC_URL
  build: {
    outDir: "dist",
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});
