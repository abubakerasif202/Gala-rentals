import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const post = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { create: () => ({ post, interceptors: { response: { use: vi.fn() } } }) } }));
import { prepareDirectUploads } from './api';

beforeEach(() => {
  post.mockResolvedValue({ data: { manifest: 'signed-manifest', uploads: [{ field: 'license_photo', url: 'https://storage.example.test/signed-upload' }] } });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
describe('application uploads outside function request limits', () => {
  const payload = () => {
    const form = new FormData();
    form.append('name', 'Gala staging applicant');
    form.append('license_photo', new File([new Uint8Array([255, 216, 255])], 'licence.jpg', { type: 'image/jpeg' }));
    return form;
  };
  it('sends file bytes only to the signed storage URL and preserves applicant fields', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const original = payload();
    const result = await prepareDirectUploads(original, '/applications/upload-intent');
    expect(post.mock.calls[0][1].files).toEqual([{ field: 'license_photo', type: 'image/jpeg', size: 3 }]);
    expect(fetch.mock.calls[0][0]).toBe('https://storage.example.test/signed-upload');
    expect(result.get('name')).toBe('Gala staging applicant');
    expect(result.get('upload_manifest')).toBe('signed-manifest');
    expect(result.has('license_photo')).toBe(false);
    expect(original.get('license_photo')).toBeInstanceOf(File);
  });
  it('stops before submitting the application if storage rejects a file', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(prepareDirectUploads(payload(), '/applications/upload-intent')).rejects.toThrow('Document upload failed');
  });
});
