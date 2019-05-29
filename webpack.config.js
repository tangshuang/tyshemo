module.exports = {
  mode: 'none',
  entry: __dirname + '/src/index.js',
  output: {
    path: __dirname + '/dist',
    filename: 'bundle.js',
    library: 'tyshemo',
    libraryTarget: 'umd',
    globalObject: 'typeof window !== undefined ? window : typeof global !== undefined ? global : typeof self !== undefined ? self : this',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        options: {
          presets: [
            ['@babel/preset-env', {
              targets: {
                ie: '8',
              },
              modules: false,
            }]
          ],
        },
      },
    ],
  },
  optimization: {
    usedExports: true,
    sideEffects: true,
  },

  devServer: {
    contentBase: __dirname + '/examples',
    index: 'index.html',
    port: 9000,
  },
}
