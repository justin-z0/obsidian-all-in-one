import esbuild from 'esbuild';
import { syncToVault } from './scripts/sync-to-vault.mjs';

const production = process.argv.includes('production');

const syncPlugin = {
  name: 'sync-to-vault',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length > 0) {
        return;
      }
      try {
        await syncToVault();
      } catch (error) {
        console.error('[all-in-one] failed to sync build artifacts', error);
      }
    });
  },
};

const common = {
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  logLevel: 'info',
  plugins: [syncPlugin],
};

const jsContext = await esbuild.context({
  ...common,
  entryPoints: ['src/main.ts'],
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
  format: 'cjs',
  sourcemap: production ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
});

const cssContext = await esbuild.context({
  ...common,
  entryPoints: ['src/styles/index.css'],
  outfile: 'styles.css',
});

if (production) {
  await jsContext.rebuild();
  await cssContext.rebuild();
  await jsContext.dispose();
  await cssContext.dispose();
} else {
  await jsContext.watch();
  await cssContext.watch();
  console.log('[all-in-one] watching main.js and styles.css ...');
}
