const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const fs = require('fs');
const path = require('path');
const extensionName = 'Private Session'

module.exports = {
  mode: 'production',
  entry: './src/private-session.js',
  output: {
    filename: 'private-session.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'private-session/dist/'
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
};