import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();

/**
 * Read .env without adding a dependency. `process.loadEnvFile` is available
 * in the Node versions used by the development workflow.
 */
export function loadEnv() {
  try {
    process.loadEnvFile(path.join(root, '.env'));
  } catch {
    // .env is optional; building without it is supported.
  }
}

/**
 * Copy build artifacts into the test vault plugin directory.
 * Returns false when OBSIDIAN_PLUGIN_DIR is not configured.
 */
export async function syncToVault() {
  loadEnv();
  const target = process.env.OBSIDIAN_PLUGIN_DIR;

  if (!target) {
    console.warn(
      '[all-in-one] OBSIDIAN_PLUGIN_DIR is not set; skip syncing to vault.',
    );
    return false;
  }

  await mkdir(target, { recursive: true });

  for (const file of ['main.js', 'manifest.json', 'styles.css']) {
    const source = path.join(root, file);
    if (!existsSync(source)) {
      continue;
    }
    await copyFile(source, path.join(target, file));
  }

  console.log(`[all-in-one] synced build artifacts to ${target}`);
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await syncToVault();
}
