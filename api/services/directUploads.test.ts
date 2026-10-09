import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  createSignedUploadUrl: vi.fn(), createSignedUrl: vi.fn(), remove: vi.fn(),
  getBucket: vi.fn(),
}));
vi.mock('../db/index.js', () => ({ db: { storage: { from: () => storage, getBucket: storage.getBucket } } }));
import { createDirectUploadIntent, readDirectUploads, validateUploadDescriptors, verifyUploadManifest } from './directUploads.js';

beforeEach(() => {
  vi.stubEnv('CHECKOUT_LINK_SECRET', 'gala-upload-unit-test-secret-with-32-characters');
  storage.createSignedUploadUrl.mockResolvedValue({ data: { signedUrl: 'https://upload.example.test' }, error: null });
  storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://download.example.test' }, error: null });
  storage.getBucket.mockResolvedValue({ data: { public: false }, error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('private direct upload authorization', () => {
  const files = [{ field: 'license_photo', type: 'image/jpeg', size: 3 }];
  it('refuses to stage identity documents in a public bucket', async () => {
    storage.getBucket.mockResolvedValue({ data: { public: true }, error: null });
    await expect(createDirectUploadIntent({ files }, 'application')).rejects.toThrow('private');
    expect(storage.createSignedUploadUrl).not.toHaveBeenCalled();
  });
  it('refuses a 15 MB vehicle when the staging bucket caps uploads at 10 MB', async () => {
    storage.getBucket.mockResolvedValue({ data: { public: false, file_size_limit: 10 * 1024 * 1024 }, error: null });
    await expect(createDirectUploadIntent({ files: [{ field: 'image', type: 'image/jpeg', size: 15 * 1024 * 1024 }] }, 'vehicle')).rejects.toThrow('required size limit');
    expect(storage.createSignedUploadUrl).not.toHaveBeenCalled();
  });
  it('binds the separately configured private bucket to the signed manifest', async () => {
    vi.stubEnv('SUPABASE_UPLOAD_STAGING_BUCKET', 'gala-upload-staging');
    storage.getBucket.mockResolvedValue({ data: { public: false, file_size_limit: 15 * 1024 * 1024, allowed_mime_types: ['image/jpeg'] }, error: null });
    const intent = await createDirectUploadIntent({ files }, 'application');
    expect(verifyUploadManifest(intent.manifest, 'application').bucket).toBe('gala-upload-staging');
    expect(storage.getBucket).toHaveBeenCalledWith('gala-upload-staging');
  });
  it('rejects oversized files, duplicate fields, and vehicle fields in application uploads', () => {
    expect(() => validateUploadDescriptors({ files: [{ ...files[0], size: 8 * 1024 * 1024 }] }, 'application')).toThrow('too large');
    expect(() => validateUploadDescriptors({ files: [...files, ...files] }, 'application')).toThrow('Duplicate');
    expect(() => validateUploadDescriptors({ files: [{ ...files[0], field: 'image' }] }, 'application')).toThrow('Invalid');
  });
  it('authorizes only signed random paths with the matching purpose', async () => {
    const intent = await createDirectUploadIntent({ files }, 'application');
    expect(verifyUploadManifest(intent.manifest, 'application').files[0].path).toMatch(/^staging\/[0-9a-f-]+\/license_photo$/);
    expect(() => verifyUploadManifest(intent.manifest, 'vehicle')).toThrow('wrong scope');
    const [payload, signature] = intent.manifest.split('.');
    const forged = Buffer.from(JSON.stringify({ scope: 'application', expires: Date.now() + 1000, files: [{ ...files[0], path: 'existing-customer-document' }] })).toString('base64url');
    expect(() => verifyUploadManifest(`${forged}.${signature}`, 'application')).toThrow('signature');
    expect(() => verifyUploadManifest(`${payload}.invalid`, 'application')).toThrow('signature');
  });
  it('expires abandoned intents and rejects a file larger than its declared size', async () => {
    const intent = await createDirectUploadIntent({ files }, 'application');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3, 4]))));
    await expect(readDirectUploads(intent.manifest, 'application')).rejects.toThrow('exceeds');
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 31 * 60 * 1000);
    expect(() => verifyUploadManifest(intent.manifest, 'application')).toThrow('expired');
    vi.restoreAllMocks();
  });
  it('preserves the 15 MB vehicle limit while rejecting application WebP files', () => {
    expect(validateUploadDescriptors({ files: [{ field: 'image', type: 'image/webp', size: 15 * 1024 * 1024 }] }, 'vehicle')).toHaveLength(1);
    expect(() => validateUploadDescriptors({ files: [{ ...files[0], type: 'image/webp' }] }, 'application')).toThrow('Invalid');
  });
});
