// @ts-check
import eslint from '@eslint/js'
import configPrettier from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginVitest from '@vitest/eslint-plugin'

export default tseslint.config(
  { ignores: ['dist/**', 'eslint.config.mjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...pluginVue.configs['flat/recommended'],
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ['vite.config.ts', 'vitest.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['src/**/*.test.ts', 'src/test/**'],
    ...pluginVitest.configs.recommended,
    rules: {
      ...pluginVitest.configs.recommended.rules,
      // Fixtures and mock replies are deliberately loose `unknown`/`any` shapes.
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    // Plain tsc cannot resolve `.vue` imports, so any value read off an SFC
    // (createApp(App), InstanceType<typeof Component>) is error-typed here and
    // these three misfire. `vue-tsc -b` is the real type gate for that code.
    rules: {
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    // shadcn-vue registry components: single-word names and bare optional props
    // are how upstream ships them, so `shadcn-vue add` stays a clean overwrite.
    files: ['src/components/ui/**'],
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
    },
  },
  configPrettier,
)
