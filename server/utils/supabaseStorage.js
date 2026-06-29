const path = require('path');

const DEFAULT_BUCKET = 'uploads';

function getSupabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL || process.env.SUPABASE_API_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;

  if (!rawUrl || !key) {
    return null;
  }

  let baseUrl = rawUrl.trim();
  baseUrl = baseUrl.replace(/\/rest\/v1\/?$/i, '');
  baseUrl = baseUrl.replace(/\/+$/, '');

  return { baseUrl, key, bucket };
}

function isSupabaseStorageEnabled() {
  return Boolean(getSupabaseConfig());
}

function getSupabaseStorageNotice() {
  const rawUrl = process.env.SUPABASE_URL || process.env.SUPABASE_API_URL || '';
  if (rawUrl && process.env.SUPABASE_ANON_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return 'Supabase Storage uploads need SUPABASE_SERVICE_ROLE_KEY on the server. Falling back to local uploads because anon keys are blocked by Storage RLS.';
  }
  return null;
}

function encodeObjectPath(objectPath) {
  return objectPath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function createObjectPath({ cardId, originalName }) {
  const ext = path.extname(originalName || '');
  const baseName = path
    .basename(originalName || 'upload', ext)
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'upload';
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `cards/${cardId}/${suffix}-${baseName}${ext}`;
}

async function uploadToSupabaseStorage({ cardId, file }) {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error('Supabase storage is not configured');
  }

  const objectPath = createObjectPath({ cardId, originalName: file.originalname });
  const encodedPath = encodeObjectPath(objectPath);
  const uploadUrl = `${config.baseUrl}/storage/v1/object/${config.bucket}/${encodedPath}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': file.mimetype || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: file.buffer,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Supabase upload failed (${response.status}): ${details || response.statusText}`);
  }

  return {
    objectPath,
    publicUrl: `${config.baseUrl}/storage/v1/object/public/${config.bucket}/${encodedPath}`,
  };
}

async function deleteFromSupabaseStorage(objectPath) {
  const config = getSupabaseConfig();
  if (!config || !objectPath) {
    return;
  }

  const response = await fetch(`${config.baseUrl}/storage/v1/object/${config.bucket}`, {
    method: 'DELETE',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: [objectPath] }),
  });

  if (!response.ok && response.status !== 404) {
    const details = await response.text().catch(() => '');
    console.warn(`Supabase delete failed (${response.status}): ${details || response.statusText}`);
  }
}

module.exports = {
  isSupabaseStorageEnabled,
  getSupabaseStorageNotice,
  uploadToSupabaseStorage,
  deleteFromSupabaseStorage,
};
