const [
    config,
    mini,
    bundle,
    dist,
] = require('../webpack.config')

module.exports = {
  ...dist,
  devServer: {
    contentBase: __dirname + '/examples',
    index: 'index.html',
    port: 9001,
  },
}