import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import baseManifest from "./manifest.json";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  const apiBase = env.VITE_API_BASE ?? "http://localhost:8000";
  const webBase = env.VITE_WEB_BASE ?? "http://localhost:3000";

  // Replace localhost origins in manifest content_scripts.matches so the
  // auth-bridge and prefill-bridge work against the configured web app URL in prod.
  type ContentScript = { matches?: string[]; js?: string[]; [key: string]: unknown };
  const manifest = {
    ...baseManifest,
    content_scripts: (baseManifest.content_scripts as ContentScript[]).map(script => ({
      ...script,
      matches: script.matches?.map((m: string) =>
        m.replace("http://localhost:3000", webBase)
      ),
    })),
  };

  return {
    plugins: [react(), crx({ manifest })],
    define: {
      // Build-time constants used by background and popup scripts.
      // Using import.meta.env.VITE_* is preferred in TypeScript source files,
      // but __define__ constants work in contexts where import.meta isn't available.
      "__VITE_API_BASE__": JSON.stringify(apiBase),
      "__VITE_WEB_BASE__": JSON.stringify(webBase),
    },
  };
});
