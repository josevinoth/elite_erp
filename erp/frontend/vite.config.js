import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local Django dev server runs on 8000.
const backendTarget = "http://127.0.0.1:8000";

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
      "/rooms": {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});
