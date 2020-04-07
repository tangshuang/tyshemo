const [
  basic,
  mini,
  bundle,
  dist,
] = require('../webpack.config')

const config = {
  ...bundle,
  devServer: {
    contentBase: __dirname,
    index: 'index.html',
    port: 9001,
  },
}

module.exports = config
