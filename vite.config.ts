import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5188,
    proxy: {
      // Proxy Freepik API requests to avoid CORS issues
      "/api/freepik": {
        target: "https://api.freepik.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/freepik/, ""),
      },
    },
  },
});
