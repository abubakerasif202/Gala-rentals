import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db/index.js';
const APPLICATIONS_BUCKET = 'applications';
import { MAX_APPLICATION_UPLOAD_BYTES, MAX_APPLICATION_TOTAL_UPLOAD_BYTES } from '../../shared/applicationSubmission.js';

const fields = ['license_photo', 'license_back_photo', 'passport_or_uber_profile_screenshot', 'proof_of_address_document', 'additional_document'] as const;
const descriptor = z.object({
  field: z.string(),
  type: z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']),
  size: z.number().int().positive(),
}).strict();
const intentSchema = z.object({ files: z.array(descriptor).min(1).max(5) }).strict();
const manifestSchema = z.object({
  scope: z.enum(['application', 'vehicle']),
  bucket: z.string().min(1).max(63).regex(/^[a-zA-Z0-9_-]+$/),
  expires: z.number().int(),
  files: z.array(descriptor.extend({ path: z.string().regex(/^staging\/[0-9a-f-]{36}\/[a-z_]+$/) })).min(1).max(5),
}).strict();
export type UploadScope = 'application' | 'vehicle';
const rejectUpload = (message: string) => Object.assign(new Error(message), { status: 400 });
const secret = () => {
  const value = process.env.CHECKOUT_LINK_SECRET?.trim();
  if (!value || value.length < 32) throw new Error('CHECKOUT_LINK_SECRET must contain at least 32 characters for direct uploads.');
  return value;
};
const sign = (payload: string) => crypto.createHmac('sha256', secret()).update(`gala-upload:${payload}`).digest('base64url');

export const validateUploadDescriptors = (input: unknown, scope: UploadScope) => {
  const { files } = intentSchema.parse(input);
  if (new Set(files.map(file => file.field)).size !== files.length) throw rejectUpload('Duplicate upload fields.');
  if (scope === 'vehicle' && (files.length !== 1 || files[0].field !== 'image')) throw rejectUpload('One vehicle image is required.');
  for (const file of files) {
    if (scope === 'application' && (!fields.includes(file.field as typeof fields[number]) || file.type === 'image/webp')) throw rejectUpload('Invalid application document.');
    if (file.size > (scope === 'application' ? MAX_APPLICATION_UPLOAD_BYTES : 15 * 1024 * 1024)) throw rejectUpload('Upload file is too large.');
  }
  if (scope === 'application' && files.reduce((sum, file) => sum + file.size, 0) > MAX_APPLICATION_TOTAL_UPLOAD_BYTES) throw rejectUpload('Application upload is too large.');
  return files;
};

export const createDirectUploadIntent = async (input: unknown, scope: UploadScope) => {
  const files = validateUploadDescriptors(input, scope).map(file => ({ ...file, type: file.type === 'image/jpg' ? 'image/jpeg' as const : file.type }));
  secret();
  const bucketName = process.env.SUPABASE_UPLOAD_STAGING_BUCKET?.trim() || APPLICATIONS_BUCKET;
  const { data: bucket, error: bucketError } = await db.storage.getBucket(bucketName);
  if (bucketError || !bucket || bucket.public) throw new Error('Direct uploads require the private applications bucket.');
  if (bucket.file_size_limit && files.some(file => file.size > bucket.file_size_limit)) {
    throw Object.assign(new Error('The private staging bucket cannot accept this file size. Configure SUPABASE_UPLOAD_STAGING_BUCKET with the required size limit.'), { status: 503 });
  }
  if (bucket.allowed_mime_types?.length && files.some(file => !bucket.allowed_mime_types.includes(file.type))) {
    throw Object.assign(new Error('The private staging bucket does not allow this document type.'), { status: 503 });
  }
  const id = crypto.randomUUID();
  const manifests = [];
  const uploads = [];
  for (const file of files) {
    const path = `staging/${id}/${file.field}`;
    const { data, error } = await db.storage.from(bucketName).createSignedUploadUrl(path, { upsert: false });
    if (error || !data) throw new Error('Unable to prepare private document upload.');
    manifests.push({ ...file, path });
    uploads.push({ field: file.field, url: data.signedUrl, type: file.type });
  }
  const payload = Buffer.from(JSON.stringify({ scope, bucket: bucketName, expires: Date.now() + 30 * 60 * 1000, files: manifests })).toString('base64url');
  return { manifest: `${payload}.${sign(payload)}`, uploads };
};

export const verifyUploadManifest = (token: unknown, scope: UploadScope) => {
  if (typeof token !== 'string' || token.length > 12000) throw rejectUpload('Invalid upload manifest.');
  const parts = token.split('.');
  if (parts.length !== 2) throw rejectUpload('Invalid upload manifest.');
  const [payload, signature] = parts;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw rejectUpload('Invalid upload signature.');
  let decoded: unknown;
  try { decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw rejectUpload('Invalid upload manifest.'); }
  const manifest = manifestSchema.parse(decoded);
  if (manifest.scope !== scope || manifest.expires <= Date.now()) throw rejectUpload('Upload manifest expired or has the wrong scope.');
  validateUploadDescriptors({ files: manifest.files.map(({ path: _path, ...file }) => file) }, scope);
  return manifest;
};

// Stream with a hard bound: never trust the MIME, size, or path sent by a browser.
export const readDirectUploads = async (token: unknown, scope: UploadScope) => {
  const manifest = verifyUploadManifest(token, scope);
  const files = [];
  const signal = AbortSignal.timeout(25000);
  for (const file of manifest.files) {
    const { data, error } = await db.storage.from(manifest.bucket).createSignedUrl(file.path, 60);
    if (error || !data) throw rejectUpload('Uploaded document was not found.');
    const response = await fetch(data.signedUrl, { signal });
    if (!response.ok || !response.body) throw rejectUpload('Uploaded document was not found.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > file.size) throw rejectUpload('Uploaded document exceeds its declared size.');
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    if (size !== file.size) throw rejectUpload('Uploaded document size does not match.');
    files.push({ ...file, buffer: Buffer.concat(chunks), size });
  }
  return files;
};

export const removeDirectUploads = async (token: unknown, scope: UploadScope) => {
  const { files, bucket } = verifyUploadManifest(token, scope);
  const { error } = await db.storage.from(bucket).remove(files.map(file => file.path));
  if (error) console.warn('Staged upload cleanup failed; retention cleanup is required.');
};
