const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Backend selection.
 *
 * Default: phone-only. The two backend entry points the screens import
 * (src/backend/auth.tsx, src/backend/data.ts) are swapped for the local
 * implementations in src/backend/local/, so no Firebase code is bundled and the
 * app runs anywhere, Expo Go included.
 *
 * EXPO_PUBLIC_BACKEND=firebase: no swap — the Firebase build (accounts,
 * Firestore sync, the teacherStats Cloud Function). See app.config.js and
 * react-native.config.js for the native side of the same switch.
 */
if (process.env.EXPO_PUBLIC_BACKEND !== 'firebase') {
  const backend = path.join(__dirname, 'src', 'backend');
  const swaps = {
    [path.join(backend, 'auth.tsx')]: path.join(backend, 'local', 'auth.tsx'),
    [path.join(backend, 'data.ts')]: path.join(backend, 'local', 'data.ts'),
  };

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resolved = context.resolveRequest(context, moduleName, platform);
    const swap = resolved.type === 'sourceFile' && swaps[resolved.filePath];
    return swap ? { type: 'sourceFile', filePath: swap } : resolved;
  };
}

module.exports = config;
