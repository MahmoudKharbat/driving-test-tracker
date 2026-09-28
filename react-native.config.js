/**
 * Keeps the Firebase native modules out of the default phone-only build
 * (see metro.config.js and app.config.js). They stay installed for the
 * EXPO_PUBLIC_BACKEND=firebase build, which links them as normal.
 *
 * `null` is not enough on its own: Expo's autolinking deep-merges this override
 * into each library's own react-native.config.js and treats `null` as an empty
 * object whenever the library declares that platform. So on Android the source
 * dir is pointed at a directory that does not exist, which the resolver treats
 * as "nothing to link". On iOS `null` does unlink auth and firestore, but the
 * RNFBApp pod is found by scanning and stays linked — inert: nothing configures
 * Firebase without the Firebase config plugin, and its build script only warns
 * without firebase.json.
 */
const FIREBASE = process.env.EXPO_PUBLIC_BACKEND === 'firebase';

const unlinked = {
  platforms: { android: { sourceDir: 'unlinked-in-phone-only-build' }, ios: null },
};

module.exports = FIREBASE
  ? {}
  : {
      dependencies: {
        '@react-native-firebase/app': unlinked,
        '@react-native-firebase/auth': unlinked,
        '@react-native-firebase/firestore': unlinked,
      },
    };
