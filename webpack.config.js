const path = require('path');
const webpack = require('webpack');
const ChmodWebpackPlugin = require("chmod-webpack-plugin");
module.exports = {
  mode: 'production',
  entry: './cli.js',
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'bin'),
    filename: 'tsquery'
  },
  module: {
    rules: [{
      test: /\.js$/,
      use: 'babel-loader'
    }]
  },
  plugins: [new webpack.BannerPlugin({
    banner: '#!/usr/bin/env node',
    raw: true
  }), new ChmodWebpackPlugin([{
    path: './bin/tsquery',
    mode: 755
  }])]
}