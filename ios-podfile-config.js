module.exports = ({ config }) => {
    return {
      ...config,
      podfileProperties: {
        ...config.podfileProperties,
        // Add use_modular_headers! to fix Firebase Swift module issue
        'use_modular_headers!': true,
      },
    };
  };