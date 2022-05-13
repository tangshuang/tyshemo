module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es6: true,
  },
  globals: {
    importScripts: 'readonly',
    describe: 'readonly',
    test: 'readonly',
    expect: 'readonly',
    jest: 'readonly',
    process: 'readonly',
    __dirname: 'readonly',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      experimentalObjectRestSpread: true,
      jsx: true,
    },
    sourceType: 'module',
  },
  plugins: [
    'react',
  ],
  extends: "eslint:recommended",
  rules: {
    indent: ['error', 2],
    semi: ['error', 'never', {
      beforeStatementContinuationChars: 'always',
    }],
    'comma-dangle': ['error', 'always-multiline'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
  },
}
