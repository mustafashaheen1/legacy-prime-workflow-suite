// Load environment variables from .env file
require('dotenv').config();

module.exports = {
  expo: {
    name: "Legacy Prime Workflow Suite",
    slug: "legacy-prime-workflow-suite",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/logo.png",
    scheme: "legacyprime",
    splash: {
      image: "./assets/images/logo.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    userInterfaceStyle: "light",
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "app.rork.legacy-prime-workflow-suite",
      icon: "./assets/images/logo.png"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/logo.png",
        backgroundColor: "#ffffff"
      },
      icon: "./assets/images/logo.png",
      package: "app.rork.legacy_prime_workflow_suite"
    },
    web: {
      favicon: "./assets/images/favicon.png",
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
