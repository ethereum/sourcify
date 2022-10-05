module.exports = {
  parserOptions: {
    ecmaVersion: 2020,
  },
  env: {
    es6: true,
    mocha: true,
    node: true,
  },
  rules: {
    '@typescript-eslint/no-var-requires': "off"
  },
  parser: "espree", // disable typescript in test
};
