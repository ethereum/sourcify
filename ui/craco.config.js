// const webpack = require("webpack");
module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback, // if you have existing fallbacks
        http: require.resolve("stream-http"),
        https: require.resolve("https-browserify"),
        stream: require.resolve("stream-browserify"),
        url: false,
        assert: require.resolve("assert"),
        util: require.resolve("util"),
      };
      return webpackConfig;
    },
  },
};
