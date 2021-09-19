const path = require('path');
const webpack = require('webpack');
const ChmodWebpackPlugin = require("chmod-webpack-plugin");
module.exports = {
  mode: 'production',
  entry: './src/cli.ts',
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'bin'),
    filename: 'tsquery'
  },
  module: {
    rules: [{
      test: /\.ts$/,
      use: 'ts-loader'
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