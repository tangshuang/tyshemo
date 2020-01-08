module.exports = {
  presets: [
    ['@babel/preset-env', { loose: true }],
  ],
  plugins: [
    '@babel/plugin-proposal-class-properties',
  ],
  env: {
    test: {
      plugins: [
        '@babel/plugin-transform-runtime',
        '@babel/plugin-proposal-class-properties',
      ],
    },
  },
}
