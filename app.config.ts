import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Miga — Expo app config.
 *
 * Native modules that require a development build (not Expo Go):
 *  - react-native-purchases (RevenueCat)
 *  - HealthKit / Health Connect (when enabled, see docs/health-integrations.md)
 * Everything else (camera, barcode scanning, auth, i18n) works in Expo Go.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: 'pablobrasero',
  name: 'Miga',
  slug: 'miga',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'miga',
  userInterfaceStyle: 'automatic',
  updates: {
    url: 'https://u.expo.dev/eefda936-d3df-430c-99cc-92079c0ff550',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  ios: {
    bundleIdentifier: 'com.pablobrasero.miga',
    supportsTablet: false,
    // Uses the shared PNG `icon` above. The Apple Icon Composer (`.icon`)
    // bundle from the template is intentionally not used: Expo Go can't serve
    // it and it errors on SDK 56. Re-add via a config plugin for store builds.
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
    },
  },
  android: {
    package: 'com.pablobrasero.miga',
    adaptiveIcon: {
      backgroundColor: '#050706',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  locales: {
    en: './assets/locales/en.json',
    es: './assets/locales/es.json',
  },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    'expo-web-browser',
    'expo-apple-authentication',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#050706',
        image: './assets/images/splash-icon.png',
        imageWidth: 96,
        dark: { backgroundColor: '#050706' },
      },
    ],
    [
      'expo-camera',
      {
        // User-facing permission copy lives in assets/locales/*.json (localized);
        // these values are the English defaults required by the plugin.
        cameraPermission:
          'Miga uses the camera to scan barcodes, receipts and photos of your meals. Images are analyzed and then deleted.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Miga accesses your photo library so you can attach a photo of a meal, receipt or nutrition label for analysis.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: 'eefda936-d3df-430c-99cc-92079c0ff550',
    },
  },
});
