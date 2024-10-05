const TerserPlugin = require('terser-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const fs = require('fs');
const path = require('path');
const extensionName = 'Private Session'

module.exports = {
  entry: './src/private-session.js',
  output: {
    filename: 'private-session.[contenthash].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'private-session/dist/'
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
          },
        },
      })
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new WebpackManifestPlugin({
      fileName: path.resolve(__dirname, '../manifest.json'),
      generate: (_, files) => {
        const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8'));
        files.forEach(({ _, path }) => {
          const extension = manifest.find(item => item.name === extensionName);
          if (extension) {
            console.log(`Private-Session: Manifest Path: ${path}`);
            extension.main = `${path}`;
          }
        });
        fs.writeFileSync(path.resolve(__dirname, '../manifest.json'), JSON.stringify(manifest, null, 2));
        return manifest;
      },
    }),
  ],
};