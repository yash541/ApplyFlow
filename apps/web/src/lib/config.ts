// Single source of truth for runtime configuration in the web app.
// All components should import from here rather than using process.env directly.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";
