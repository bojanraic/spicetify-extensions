const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: './src/private-session.js',
  output: {
    filename: 'private-session.js',
    path: __dirname + '/dist',
  },
  optimization: {
    minimizer: [new TerserPlugin()],
  },
};