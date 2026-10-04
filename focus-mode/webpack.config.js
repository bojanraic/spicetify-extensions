const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const fs = require('fs');
const path = require('path');
const extensionName = 'Focus Mode';

module.exports = {
  mode: 'production',
  entry: './src/focus-mode.js',
  output: {
    filename: 'focus-mode.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'focus-mode/dist/'
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.debug', 'console.log', 'console.info'],
          },
          format: {
            comments: false,
          },
          ecma: 2020,
          module: true,
        },
        extractComments: false,
      }),
    ],
    usedExports: true,
    sideEffects: false,
    concatenateModules: true,
  },
  plugins: [
    new CleanWebpackPlugin(),
  ],
  performance: {
    hints: false,
  },
}; 