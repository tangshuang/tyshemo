const DeepScope = require('webpack-deep-scope-plugin').default

const core = {
  mode: 'none',
  entry: __dirname + '/es/index.js',
  output: {
    path: __dirname + '/dist',
    filename: 'index.js',
    library: 'tyshemo',
    libraryTarget: 'umd',
    globalObject: `typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : this`,
  },
  resolve: {
    alias: {
      'ts-fns': 'ts-fns/es',
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
      },
    ],
  },
  plugins: [
    new DeepScope(),
  ],
  optimization: {
    usedExports: true,
    sideEffects: true,
  },
  devtool: 'source-map',
}

const coreMini = {
  ...core,
  mode: 'production',
  output: {
    ...core.output,
    filename: 'index.min.js',
  },
  optimization: {
    ...core.optimization,
    minimize: true,
  },
}

const ty = {
  ...core,
  entry: __dirname + '/es/ty/index.js',
  output: {
    ...core.output,
    library: 'ty',
    filename: 'ty.js',
  },
}

const tyMini = {
  ...coreMini,
  entry: __dirname + '/es/ty/index.js',
  output: {
    ...coreMini.output,
    library: 'ty',
    filename: 'ty.min.js',
  },
}

module.exports = [
  core,
  coreMini,
  ty,
  tyMini,
]
