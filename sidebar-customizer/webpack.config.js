const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const fs = require('fs');
const path = require('path');
const extensionName = 'Sidebar Customizer';

module.exports = {
  mode: 'production',
  entry: './src/sidebar-customizer.js',
  output: {
    filename: 'sidebar-customizer.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'sidebar-customizer/dist/'
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: false,
            pure_funcs: [],
            passes: 1,
            unsafe: false,
            unsafe_math: false,
            unsafe_methods: false,
            reduce_vars: true,
            reduce_funcs: true,
          },
          mangle: true,
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
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
};