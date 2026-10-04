const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const fs = require('fs');
const extensionName = 'YT Video';

module.exports = {
  mode: 'production',
  entry: './src/yt-video.js',
  output: {
    filename: 'yt-video.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'yt-video/dist/'
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: false, // Keep console for debugging
            drop_debugger: true,
            pure_funcs: ['console.info'],
            passes: 2,
            unsafe: true,
            unsafe_math: true,
            unsafe_methods: true,
            reduce_vars: true,
            reduce_funcs: true,
          },
          mangle: {
            properties: {
              regex: /^_/,
            },
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
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
      },
    ],
  },
}; 