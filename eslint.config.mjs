import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
  {
    ignores: [
      'node_modules/**',
      'main.js',
      'styles.css',
      'coverage/**',
      'docs/**',
      'tests/**',
      'scripts/**',
      'esbuild.config.mjs',
      'vitest.config.ts',
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'obsidianmd/sample-names': 'off',
    },
  },
]);
