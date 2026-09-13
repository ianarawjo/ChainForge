const webpack = require("webpack");

// const dotenv = require('dotenv').config({ path: __dirname + '/.env' })
const isDevelopment = process.env.NODE_ENV !== "production";

module.exports = {
  eslint: {
    enable: false,
  },
  jest: {
    configure: {
      // Several provider SDKs ship ESM only, which CRA's CommonJS Jest cannot
      // parse -- importing them anywhere in the graph fails a whole suite.
      // Our tests cover ChainForge's own logic, so stub them out.
      moduleNameMapper: {
        "^@google/genai$":
          "<rootDir>/src/backend/__test__/__mocks__/esmStub.js",
        "^mdast-util-from-markdown$":
          "<rootDir>/src/backend/__test__/__mocks__/esmStub.js",
      },
    },
  },
  webpack: {
    // Function form (rather than an object to deep-merge) so we can patch an
    // existing CRA rule, not just add settings.
    configure: (webpackConfig) => {
      // pdf.js ships modern syntax that babel-preset-react-app cannot parse:
      // transforming it fails the build with
      // "Cannot read properties of null (reading 'declarations')".
      // webpack 5 understands it natively, so exclude it from babel-loader
      // rather than pinning an older, less-patched pdf.js -- users upload
      // untrusted PDFs, and pdf.js has had RCE-class CVEs.
      const PDFJS = /node_modules[\\/]pdfjs-dist/;
      const excludePdfjsFromBabel = (rules) => {
        for (const rule of rules ?? []) {
          if (!rule || typeof rule !== "object") continue;
          if (Array.isArray(rule.oneOf)) excludePdfjsFromBabel(rule.oneOf);
          if (Array.isArray(rule.rules)) excludePdfjsFromBabel(rule.rules);

          const loader = rule.loader ?? "";
          const isBabel =
            typeof loader === "string" && loader.includes("babel-loader");
          // Only the node_modules babel rule: the app-source rule is scoped by
          // `include`, and must keep transforming our own code.
          if (
            isBabel &&
            rule.exclude !== undefined &&
            rule.include === undefined
          )
            rule.exclude = Array.isArray(rule.exclude)
              ? [...rule.exclude, PDFJS]
              : [rule.exclude, PDFJS];
        }
      };
      excludePdfjsFromBabel(webpackConfig.module?.rules);

      // WebLLM currently publishes sourcemap references to TS sources that are
      // not included in the npm package. Ignore only those warnings.
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings ?? []),
        {
          module: /@mlc-ai\/web-llm/,
          message: /Failed to parse source map/,
        },
      ];

      // Merge into resolve rather than replacing it: CRA sets extensions,
      // modules and plugins there, and overwriting the object breaks even
      // `import App from "./App"`.
      webpackConfig.resolve = webpackConfig.resolve ?? {};
      webpackConfig.resolve.fallback = {
        ...(webpackConfig.resolve.fallback ?? {}),
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
      };

      return webpackConfig;
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
