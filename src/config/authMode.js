// Switch to "production" later to re-enable Supabase Auth without removing demo mode.
export const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || "demo";
// Leave auth test tools on by default so onboarding can be tested from the Admin Users area
// without enabling full production login on the live demo.
export const ENABLE_AUTH_TEST_TOOLS =
  import.meta.env.VITE_ENABLE_AUTH_TEST_TOOLS === "false" ? false : true;

export const isProductionAuthMode = AUTH_MODE === "production";
