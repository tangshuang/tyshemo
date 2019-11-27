const express = require('express')

const babelConfig = {
  presets: [
    ['@babel/preset-env', { modules: false }],
  ],
  plugins: [
    ['@babel/plugin-transform-runtime', { useESModules: true }],
  ],
}

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
  resolve: {
    alias: {
      'ts-fns': 'ts-fns/es/index.js',
    },
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
  externals: {
    'ts-fns': true,
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

const bundle = {
  ...config,
  output: {
    ...config.output,
    path: __dirname + '/dist',
  },
  externals: undefined,
}

const dist = {
  ...mini,
  output: {
    ...mini.output,
    path: __dirname + '/dist',
  },
  externals: undefined,
}

module.exports = [
  config,
  mini,
  bundle,
  dist,
]
