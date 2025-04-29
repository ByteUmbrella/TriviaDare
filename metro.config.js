const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  ...defaultConfig,
  resolver: {
    ...defaultConfig.resolver,
    extraNodeModules: {
      // You can add any additional node modules here if needed
    },
    assetExts: [
      ...defaultConfig.resolver.assetExts.filter(ext => ext !== 'svg'),
      'json',  // Add JSON to asset extensions
      'ttf',   // Explicitly add font formats for Android compatibility
      'otf',
      'png',
      'jpg',
      'jpeg'
    ],
    sourceExts: [
      ...defaultConfig.resolver.sourceExts,
      'json',
      'svg'  // Add SVG support
    ],
    // Block specific directories without using exclusionList
    blacklistRE: /.*\.git\/.*/
  },
  transformer: {
    ...defaultConfig.transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
    assetPlugins: ['expo-asset/tools/hashAssetFiles'],
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  }
};

module.exports = config;