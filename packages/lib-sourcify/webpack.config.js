const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './src/index.ts', // starting point of your library
  output: {
    path: path.resolve(__dirname, 'browser'), // where the bundle will be saved
    filename: 'lib-sourcify.js', // name of the bundled file
    library: 'LibSourcify', // name of the global variable when used in the browser
    libraryTarget: 'umd', // supports commonjs, amd and as globals
    umdNamedDefine: true, // uses human-readable names
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  // Needed as npm workspaces hoists node_modules to the root directory
  // https://github.com/nestjs/nest/issues/8857
  externals: [nodeExternals({ modulesDir: '../../node_modules' })],
};
