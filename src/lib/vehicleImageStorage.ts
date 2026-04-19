import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const VEHICLE_IMAGES_BUCKET =
  (import.meta.env.VITE_SUPABASE_VEHICLE_IMAGES_BUCKET as string | undefined)?.trim() ||
  'vehicle-images';

let client: SupabaseClient | null = null;

const readEnv = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const getClient = () => {
  if (client) {
    return client;
  }

  const supabaseUrl = readEnv(import.meta.env.VITE_SUPABASE_URL);
  const supabaseAnonKey = readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase upload is not configured for this admin environment.');
  }

  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return client;
};

const sanitizeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '');

const createVehicleImagePath = (file: File) => {
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const safeExtension = sanitizeFileName(extension || 'jpg') || 'jpg';
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

  return `admin-uploads/${id}.${safeExtension}`;
};

export const uploadVehicleImage = async (file: File) => {
  const supabase = getClient();
  const path = createVehicleImagePath(file);

  const { error: uploadError } = await supabase.storage
    .from(VEHICLE_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(VEHICLE_IMAGES_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error('Vehicle image uploaded but no public URL was returned.');
  }

  return {
    path,
    publicUrl: data.publicUrl,
  };
};

export const getVehicleImagesBucket = () => VEHICLE_IMAGES_BUCKET;
