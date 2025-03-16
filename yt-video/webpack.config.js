const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const fs = require('fs');
const extensionName = 'YT Video';

module.exports = {
  mode: 'production',
  entry: './src/yt-video.js',
  output: {
    filename: 'yt-video.[contenthash].js',
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
    new WebpackManifestPlugin({
      fileName: path.resolve(__dirname, '../manifest.json'),
      generate: (_, files) => {
        // Try to read existing manifest or create a new one if it doesn't exist
        let manifest = [];
        try {
          manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8'));
        } catch (error) {
          console.log('Creating new manifest file');
        }
        
        files.forEach(({ _, path }) => {
          // Find existing extension entry or create a new one
          let extension = manifest.find(item => item.name === extensionName);
          if (!extension) {
            extension = {
              name: extensionName,
              description: "Watch YouTube videos for Spotify songs without ads, cookies, or tracking",
              main: "",
              readme: "yt-video/README.md"
            };
            manifest.push(extension);
          }
          
          console.log(`YT-Video: Manifest Path: ${path}`);
          extension.main = `${path}`;
        });
        
        fs.writeFileSync(path.resolve(__dirname, '../manifest.json'), JSON.stringify(manifest, null, 2));
        return manifest;
      },
    }),
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