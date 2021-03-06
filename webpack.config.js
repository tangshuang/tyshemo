const DeepScope = require('webpack-deep-scope-plugin').default

const basic = {
  mode: 'none',
  entry: __dirname + '/src/index.js',
  output: {
    path: __dirname + '/dist',
    filename: 'tyshemo.js',
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

const mini = {
  ...basic,
  mode: 'production',
  output: {
    ...basic.output,
    filename: 'tyshemo.min.js',
  },
  optimization: {
    ...basic.optimization,
    minimize: true,
  },
}

const ty = {
  ...basic,
  entry: __dirname + '/src/ty/index.js',
  output: {
    ...basic.output,
    library: 'ty',
    filename: 'ty.js',
  },
}

const tymini = {
  ...mini,
  entry: __dirname + '/src/ty/index.js',
  output: {
    ...mini.output,
    library: 'ty',
    filename: 'ty.min.js',
  },
}

const store = {
  ...basic,
  entry: __dirname + '/src/store.js',
  output: {
    ...basic.output,
    library: 'store',
    filename: 'store.js',
  },
}

const storemini = {
  ...mini,
  entry: __dirname + '/src/store.js',
  output: {
    ...mini.output,
    library: 'store',
    filename: 'store.min.js',
  },
}

module.exports = [
  basic,
  mini,
  ty,
  tymini,
  store,
  storemini,
]
