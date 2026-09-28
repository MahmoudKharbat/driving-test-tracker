/**
 * Native side of the backend switch (see metro.config.js).
 *
 * app.json describes the Firebase build. For the default phone-only build the
 * Firebase config plugins and google-services files are stripped, so a native
 * build needs no Firebase project at all.
 *
 * `expo-build-properties` (static iOS frameworks) stays in both builds: the
 * RNFBApp pod is still linked on iOS (see react-native.config.js), and its
 * Firebase dependencies only install as static frameworks.
 */
const FIREBASE = process.env.EXPO_PUBLIC_BACKEND === 'firebase';

const isFirebaseOnly = (plugin) => {
  const name = Array.isArray(plugin) ? plugin[0] : plugin;
  return name.startsWith('@react-native-firebase/');
};

module.exports = ({ config }) => {
  if (FIREBASE) return config;

  const { googleServicesFile: _ios, ...ios } = config.ios ?? {};
  const { googleServicesFile: _android, ...android } = config.android ?? {};

  return {
    ...config,
    ios,
    android,
    plugins: (config.plugins ?? []).filter((p) => !isFirebaseOnly(p)),
  };
};
