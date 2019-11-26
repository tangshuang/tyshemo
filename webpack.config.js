const express = require('express')
const babelConfig = require('./babel.config')

// make effect
babelConfig.presets[0][1].modules = false
babelConfig.plugins[0][1] = { useESModules: true }

const config = {
  mode: 'none',
  entry: __dirname + '/src/index.js',
  output: {
    path: __dirname + '/umd',
    filename: 'tyshemo.js',
    library: 'tyshemo',
    libraryTarget: 'umd',
    globalObject: `typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : this`,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        options: babelConfig,
      },
    ],
  },
  optimization: {
    usedExports: true,
    sideEffects: true,
  },
  devtool: 'source-map',

  devServer: {
    contentBase: __dirname + '/examples',
    index: 'index.html',
    port: 9000,
    before(app) {
      app.use(express.static(__dirname + '/src'))
    },
  },
}

const mini = {
  ...config,
  output: {
    ...config.output,
    filename: 'tyshemo.min.js',
  },
  optimization: {
    ...config.optimization,
    minimize: true,
  },
}

module.exports = [
  config,
  mini,
]
