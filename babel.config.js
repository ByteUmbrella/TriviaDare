module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      '@babel/plugin-transform-export-namespace-from',
      '@babel/plugin-proposal-optional-chaining',
      '@babel/plugin-proposal-nullish-coalescing-operator',
      ['module-resolver', {
        extensions: [
          '.js',
          '.jsx',
          '.ts',
          '.tsx',
          '.json'
        ],
        root: ['.'],
        alias: {
          '@packs': './Packs'
        }
      }]
    ]
  };
};