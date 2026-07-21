// Production login is now the permanent access flow.
export const AUTH_MODE = "production";
// Leave auth test tools on by default so onboarding can be tested from the Admin Users area.
export const ENABLE_AUTH_TEST_TOOLS =
  import.meta.env.VITE_ENABLE_AUTH_TEST_TOOLS === "false" ? false : true;

export const isProductionAuthMode = AUTH_MODE === "production";
