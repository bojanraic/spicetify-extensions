const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const fs = require('fs');
const path = require('path');
const extensionName = 'Pinned Sidebar Panel';

module.exports = {
  mode: 'production', // or 'development' for more detailed output
  entry: './src/pinned-sidebar-panel.js',
  output: {
    filename: 'pinned-sidebar-panel.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'pinned-sidebar-panel/dist/'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader', // Optional: if you want to use Babel for transpilation
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js']
  },
  // Optimization settings
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: false,
            pure_funcs: ['utils.log'],
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
  // Disable source maps for cleaner output
  devtool: false,
  // External dependencies that should not be bundled (if any)
  // externals: {
  //   // Example: if you were using React and wanted to rely on Spotify's React
  //   'react': 'React',
  //   'react-dom': 'ReactDOM'
  // },
  performance: {
    hints: false // Disables performance hints during build if they are noisy
  },
  plugins: [
    new CleanWebpackPlugin(),
  ]
}; 