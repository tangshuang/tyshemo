const DeepScope = require('webpack-deep-scope-plugin').default

const core = {
  mode: 'none',
  entry: __dirname + '/src/index.js',
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
  entry: __dirname + '/src/ty/index.js',
  output: {
    ...core.output,
    library: 'ty',
    filename: 'ty.js',
  },
}

const tyMini = {
  ...coreMini,
  entry: __dirname + '/src/ty/index.js',
  output: {
    ...coreMini.output,
    library: 'ty',
    filename: 'ty.min.js',
  },
}

const store = {
  ...core,
  entry: __dirname + '/src/store.js',
  output: {
    ...core.output,
    library: 'store',
    filename: 'store.js',
  },
}

const storeMini = {
  ...coreMini,
  entry: __dirname + '/src/store.js',
  output: {
    ...coreMini.output,
    library: 'store',
    filename: 'store.min.js',
  },
}

const complete = {
  ...core,
  entry: __dirname + '/src/complete/index.js',
  output: {
    ...core.output,
    library: 'tyshemo',
    filename: 'tyshemo.js',
  },
}

const completeMini = {
  ...coreMini,
  entry: __dirname + '/src/complete/index.js',
  output: {
    ...core.output,
    library: 'tyshemo',
    filename: 'tyshemo.min.js',
  },
}

module.exports = [
  core,
  coreMini,
  ty,
  tyMini,
  store,
  storeMini,
  complete,
  completeMini,
]
