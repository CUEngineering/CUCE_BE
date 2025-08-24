import antfu from '@antfu/eslint-config';
import eslintConfigPrettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default antfu({
  lessOpinionated: true,
  stylistic: {
    indent: 2,
    quotes: 'single',
    jsx: true,
    semi: true,
  },
  typescript: true,
  vue: false,
  jsonc: true,
  yaml: true,
  toml: true,
  test: true,
})
  .override('antfu/stylistic/rules', {
    rules: {
      'style/operator-linebreak': 'off',
      'style/brace-style': 'off',
      'style/indent': 'off',
      'style/quote-props': 'off',
      'style/arrow-parens': 'off',
      'style/indent-binary-ops': 'off',
    },
  })
  .override('antfu/typescript/rules', {
    rules: {
      'ts/ban-types': 'off',
      'ts/explicit-function-return-type': 'off',
      'ts/explicit-module-boundary-types': 'off',
      'ts/no-explicit-any': 'off',
    },
  })
  .append({
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      ...eslintConfigPrettier.rules,
      ...eslintPluginPrettierRecommended.rules,
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'lf',
          singleQuote: true,
          singleAttributePerLine: true,
          trailingComma: 'all',
          tabWidth: 2,
          printWidth: 120,
          useTabs: false,
          bracketSpacing: true,
          jsxBracketSameLine: false,
          semi: true,
        },
      ],
    },
  })
  .overrideRules({
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-imports-ts': 'error',
    'unused-imports/no-unused-vars-ts': 'error',
    'unused-imports/no-unused-vars': 'error',
    'no-console': 'warn',
    'no-labels': 'off',
    'no-restricted-syntax': 'off',
    'no-async-promise-executor': 'off',
    'antfu/consistent-list-newline': 'off',
    'ts/consistent-type-imports': 'off',
  });
