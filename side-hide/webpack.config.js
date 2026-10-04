const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const fs = require('fs');
const path = require('path');
const extensionName = 'Side Hide'

module.exports = {
  mode: 'production',
  entry: './src/side-hide.js',
  output: {
    filename: 'side-hide.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'side-hide/dist/'
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
            unsafe: false,
            unsafe_math: false,
            unsafe_methods: false,
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