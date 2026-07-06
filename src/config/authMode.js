// Switch to "production" later to re-enable Supabase Auth without removing demo mode.
export const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || "demo";

export const isProductionAuthMode = AUTH_MODE === "production";
