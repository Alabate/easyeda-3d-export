const path = require("path");

module.exports = {
  mode: "development",
  entry: "./src/main.js",
  output: {
    filename: "main.js",
    path: path.resolve(__dirname, "dist"),
  },
  watch: true,
  watchOptions: {
    aggregateTimeout: 200,
    poll: 1000,
  },
  devServer: {
    watchContentBase: true,
    contentBase: [
      path.join(__dirname, "src/dev"),
      path.join(__dirname, "dist"),
    ],
    contentBasePublicPath: ["/", "/dist"],
    index: "index.html",
    port: 9000,
    writeToDisk: true,
    proxy: {
      "/analyzer/api/3dmodel": {
        target: "https://easyeda.com",
        changeOrigin: true,
      },
    },
  },
};
