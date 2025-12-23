// Load environment variables from .env file
require('dotenv').config();

module.exports = {
  expo: {
    name: "Legacy Prime Workflow Suite",
    slug: "legacy-prime-workflow-suite",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.legacyprime.workflowsuite"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.legacyprime.workflowsuite"
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro"
    },
    extra: {
      // Make environment variables available to the app
      openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      rorkApiBaseUrl: process.env.EXPO_PUBLIC_RORK_API_BASE_URL,
    }
  }
};
