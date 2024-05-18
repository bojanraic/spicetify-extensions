const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: './src/side-hide.js',
  output: {
    filename: 'side-hide.js',
    path: __dirname + '/dist',
  },
  optimization: {
    minimizer: [new TerserPlugin()],
  },
};