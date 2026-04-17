import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'registry.json');
const RAW_PREFIX = 'https://raw.githubusercontent.com/choko510/customRapid-plugin/main/';
const ALLOWED_KINDS = new Set(['data', 'ui', 'operation']);

function fail(message) {
  throw new Error(message);
}

function toLocalPathFromRawURL(url) {
  if (!url.startsWith(RAW_PREFIX)) return null;
  const relative = url.slice(RAW_PREFIX.length).replace(/\//g, path.sep);
  return path.join(REPO_ROOT, relative);
}

function ensureHTTPURL(value, fieldName) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${fieldName} must be a valid URL: ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(`${fieldName} must use http/https: ${value}`);
  }
}

function sha256Base64(text) {
  return createHash('sha256').update(text, 'utf8').digest('base64');
}

function ensureString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${fieldName} must be a non-empty string`);
  }
}

function ensureStringArray(value, fieldName) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${fieldName} must be a non-empty array`);
  }
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') {
      fail(`${fieldName} must contain non-empty strings`);
    }
  }
}

function ensureOptionalHTTPURL(value, fieldName) {
  if (value === undefined || value === null || value === '') return;
  ensureString(value, fieldName);
  ensureHTTPURL(value, fieldName);
}

function ensureOptionalStringArray(value, fieldName) {
  if (value === undefined || value === null) return;
  ensureStringArray(value, fieldName);
}

async function readJSON(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`Invalid JSON in ${path.relative(REPO_ROOT, filePath)}: ${err.message}`);
  }
}

async function validateManifest(manifestPath, entry) {
  const manifest = await readJSON(manifestPath);
  ensureString(manifest.id, `manifest.id (${manifestPath})`);
  ensureString(manifest.name, `manifest.name (${manifestPath})`);
  ensureString(manifest.entrypoint, `manifest.entrypoint (${manifestPath})`);
  ensureStringArray(manifest.kinds, `manifest.kinds (${manifestPath})`);
  ensureOptionalHTTPURL(manifest.docsURL, `manifest.docsURL (${manifestPath})`);
  ensureOptionalStringArray(manifest.usage, `manifest.usage (${manifestPath})`);
  ensureOptionalStringArray(manifest['ja-usage'], `manifest.ja-usage (${manifestPath})`);

  for (const kind of manifest.kinds) {
    if (!ALLOWED_KINDS.has(kind)) {
      fail(`Unsupported kind "${kind}" in ${manifestPath}`);
    }
  }

  if (manifest.id !== entry.id) {
    fail(`Registry id "${entry.id}" does not match manifest id "${manifest.id}" in ${manifestPath}`);
  }
  ensureHTTPURL(manifest.entrypoint, `manifest.entrypoint (${manifestPath})`);
}

async function validate() {
  const registry = await readJSON(REGISTRY_PATH);
  if (Number(registry.version) !== 1) {
    fail('registry.version must be 1');
  }
  if (!Array.isArray(registry.plugins)) {
    fail('registry.plugins must be an array');
  }
  if (!Array.isArray(registry.revoked)) {
    fail('registry.revoked must be an array');
  }

  const seen = new Set();
  for (const entry of registry.plugins) {
    ensureString(entry?.id, 'plugins[].id');
    ensureString(entry?.manifestURL, `plugins[${entry.id}].manifestURL`);
    ensureHTTPURL(entry.manifestURL, `plugins[${entry.id}].manifestURL`);

    if (seen.has(entry.id)) {
      fail(`Duplicate plugin id found in registry.plugins: ${entry.id}`);
    }
    seen.add(entry.id);

    const hasHash = typeof entry.manifestHash === 'string' && entry.manifestHash.trim() !== '';
    const hasSignature = typeof entry.signature === 'string' && entry.signature.trim() !== '';
    const hasKeyID = typeof entry.keyID === 'string' && entry.keyID.trim() !== '';
    const signedCount = [hasHash, hasSignature, hasKeyID].filter(Boolean).length;

    if (signedCount !== 0 && signedCount !== 3) {
      fail(`plugins[${entry.id}] must provide all of manifestHash/signature/keyID together`);
    }

    const manifestPath = toLocalPathFromRawURL(entry.manifestURL);
    if (manifestPath) {
      await fs.access(manifestPath);
      const manifestText = await fs.readFile(manifestPath, 'utf8');
      if (hasHash) {
        const computedHash = sha256Base64(manifestText);
        if (computedHash !== entry.manifestHash) {
          fail(`manifestHash mismatch for ${entry.id}`);
        }
      }
      await validateManifest(manifestPath, entry);
    }
  }

  for (const revokedEntry of registry.revoked) {
    if (typeof revokedEntry === 'string') {
      ensureString(revokedEntry, 'revoked[]');
      continue;
    }
    ensureString(revokedEntry?.id, 'revoked[].id');
  }

  console.log(`Registry validation passed (${registry.plugins.length} plugins).`);
}

validate().catch(err => {
  console.error(err.message);
  process.exit(1);
});
