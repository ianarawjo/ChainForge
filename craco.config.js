const webpack = require("webpack");

// const dotenv = require('dotenv').config({ path: __dirname + '/.env' })
const isDevelopment = process.env.NODE_ENV !== "production";

module.exports = {
  eslint: {
    enable: false,
  },
  webpack: {
    configure: {
      resolve: {
        fallback: {
          process: require.resolve("process/browser"),
          buffer: require.resolve("buffer"),
          https: require.resolve("https-browserify"),
          querystring: require.resolve("querystring-es3"),
          url: require.resolve("url/"),
          os: require.resolve("os-browserify/browser"),
          stream: require.resolve("stream-browserify"),
          path: require.resolve("path-browserify"),
          util: require.resolve("util/"),
          crypto: require.resolve("crypto-browserify"),
          assert: require.resolve("assert/"),
          http: require.resolve("stream-http"),
          net: require.resolve("net-browserify"),
          zlib: require.resolve("browserify-zlib"),
          fs: false,
          child_process: false,
        },
      },
    },

    module: {
      rules: [
        {
          test: /node_modules\/https-proxy-agent\//,
          use: "null-loader",
        },
      ],
    },

    plugins: {
      add: [
        new webpack.ProvidePlugin({
          process: "process/browser.js",
        }),

        // Work around for Buffer is undefined:
        // https://github.com/webpack/changelog-v5/issues/10
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
        }),
      ],
    },

    // plugins: {add: [
    //   new webpack.DefinePlugin({
    //     // 'process': "{}",
    //     'process.env': "{}", // JSON.stringify(dotenv.parsed),
    //     // 'process.env.NODE_ENV': JSON.stringify(isDevelopment ? 'development' : 'production'),
    //   }),
    // ]},
  },
};
