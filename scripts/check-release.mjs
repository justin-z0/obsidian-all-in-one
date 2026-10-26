#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function readJson(file) {
  return JSON.parse(readFileSync(resolve(root, file), 'utf8'));
}

const pkg = readJson('package.json');
const manifest = readJson('manifest.json');
const versions = readJson('versions.json');
const errors = [];

if (pkg.version !== manifest.version) {
  errors.push(
    `package.json version (${pkg.version}) !== manifest.json version (${manifest.version})`,
  );
}

if (versions[pkg.version] !== manifest.minAppVersion) {
  errors.push(
    `versions.json["${pkg.version}"] should be "${manifest.minAppVersion}"`,
  );
}

const obsidianVersion = String(pkg.devDependencies?.obsidian ?? '');
if (obsidianVersion !== manifest.minAppVersion) {
  errors.push(
    `obsidian devDependency (${obsidianVersion}) should match minAppVersion (${manifest.minAppVersion})`,
  );
}

const ref =
  process.env.GITHUB_REF_NAME ??
  process.env.GITHUB_REF?.replace(/^refs\/tags\//, '');
if (ref && ref.startsWith('v') && ref.slice(1) !== pkg.version) {
  errors.push(`release tag (${ref}) does not match version (${pkg.version})`);
}

if (errors.length > 0) {
  console.error('Release metadata check failed:');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(
  `Release metadata OK: ${pkg.version} (min Obsidian ${manifest.minAppVersion})`,
);
