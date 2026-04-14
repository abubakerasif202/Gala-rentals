/**
 * Upload car images to Supabase Storage and update car image URLs in the database.
 *
 * Usage:
 *   node scripts/upload-car-images.js
 *
 * Reads all *.jpeg files from car images/cars/ (named <PLATE>.jpeg),
 * uploads them to the 'cars' Storage bucket, then updates the matching
 * car row's image column with the public URL.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const IMAGE_DIR = resolve(import.meta.dirname, '..', 'car images', 'cars');
const BUCKET = 'cars';

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) throw new Error(`Failed to create bucket: ${error.message}`);
    console.log(`Created public bucket '${BUCKET}'`);
  } else {
    console.log(`Bucket '${BUCKET}' already exists`);
  }
}

async function uploadImage(plate, filePath) {
  const fileBytes = readFileSync(filePath);
  const storagePath = `${plate}.jpeg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBytes, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) throw new Error(`Upload failed for ${plate}: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function updateCarImage(plate, publicUrl) {
  const { data, error } = await supabase
    .from('cars')
    .update({ image: publicUrl })
    .ilike('name', `%(${plate})`)
    .select('id, name');

  if (error) throw new Error(`DB update failed for ${plate}: ${error.message}`);
  return data;
}

async function main() {
  console.log('=== Car Image Upload ===\n');

  await ensureBucket();
  console.log('');

  const files = readdirSync(IMAGE_DIR).filter((f) => f.endsWith('.jpeg'));
  console.log(`Found ${files.length} images in ${IMAGE_DIR}\n`);

  let successCount = 0;
  let failCount = 0;
  let noMatchCount = 0;

  for (const file of files) {
    const plate = basename(file, '.jpeg');
    const filePath = resolve(IMAGE_DIR, file);

    try {
      process.stdout.write(`${plate}: uploading... `);
      const publicUrl = await uploadImage(plate, filePath);
      const updated = await updateCarImage(plate, publicUrl);

      if (!updated || updated.length === 0) {
        console.log(`⚠  uploaded but no matching car found in DB`);
        noMatchCount++;
      } else {
        console.log(`✓  ${updated[0].name}`);
        successCount++;
      }
    } catch (err) {
      console.log(`✗  ${err.message}`);
      failCount++;
    }
  }

  console.log(`\n=== Done: ${successCount} updated, ${noMatchCount} no DB match, ${failCount} failed ===`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
