const DeepScope = require('webpack-deep-scope-plugin').default

const babelConfig = {
  presets: [
    ['@babel/preset-env', { modules: false, loose: true }],
  ],
  plugins: [
    '@babel/plugin-proposal-class-properties',
  ],
}

// umd
const basic = {
  mode: 'none',
  entry: __dirname + '/src/index.js',
  output: {
    path: __dirname + '/dist',
    filename: 'tyshemo.umd.js',
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
  plugins: [
    new DeepScope(),
  ],
  externals: {
    'ts-fns': true,
  },
  optimization: {
    usedExports: true,
    sideEffects: true,
  },
  devtool: 'source-map',
}

// umd.min
const mini = {
  ...basic,
  mode: 'production',
  output: {
    ...basic.output,
    filename: 'tyshemo.umd.min.js',
  },
  optimization: {
    ...basic.optimization,
    minimize: true,
  },
}

// bundle
const bundle = {
  ...basic,
  output: {
    ...basic.output,
    path: __dirname + '/dist',
    filename: 'tyshemo.js',
  },
  resolve: undefined,
  externals: undefined,
}

// bundle.min
const dist = {
  ...mini,
  output: {
    ...mini.output,
    path: __dirname + '/dist',
    filename: 'tyshemo.min.js',
  },
  resolve: undefined,
  externals: undefined,
}

module.exports = [
  basic,
  mini,
  bundle,
  dist,
]
