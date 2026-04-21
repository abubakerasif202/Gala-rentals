import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, RefreshCw, Trash2, UploadCloud } from 'lucide-react';

const DEFAULT_VEHICLE_IMAGE = '/hero-camry.webp';
const MAX_RECOMMENDED_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ALLOWED_FILE_SIZE_BYTES = MAX_RECOMMENDED_FILE_SIZE_BYTES * 3;
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.84;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type FilePickResult = {
  error?: string;
  file?: File;
  previewUrl?: string;
};

interface VehicleImageUploaderProps {
  currentImageUrl: string;
  hasCustomImage: boolean;
  isUploading: boolean;
  onFileReady: (result: { file: File; previewUrl: string }) => void;
  onNotify?: (message: string, type: 'success' | 'error') => void;
  onRemoveImage: () => void;
}

const formatFileSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const getFileNameFromUrl = (value: string) => {
  try {
    const url = new URL(value, window.location.origin);
    const filename = url.pathname.split('/').pop();
    return filename || 'vehicle-image';
  } catch {
    return 'vehicle-image';
  }
};

const readImageFile = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to read the selected image.'));
    };
    image.src = objectUrl;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Image compression failed.'));
        return;
      }

      resolve(blob);
    }, type, quality);
  });

const optimiseImage = async (file: File) => {
  const image = await readImageFile(file);
  const shouldResize = image.width > MAX_DIMENSION || image.height > MAX_DIMENSION;
  const shouldCompress = file.size > MAX_RECOMMENDED_FILE_SIZE_BYTES * 0.7;

  if (!shouldResize && !shouldCompress) {
    return file;
  }

  const scale = Math.min(MAX_DIMENSION / image.width, MAX_DIMENSION / image.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Image editor could not prepare the selected image.');
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const nextType = file.type === 'image/png' && !shouldCompress ? 'image/png' : 'image/jpeg';
  const blob = await canvasToBlob(
    canvas,
    nextType,
    nextType === 'image/jpeg' ? JPEG_QUALITY : undefined
  );
  const extension = nextType === 'image/png' ? 'png' : 'jpg';
  const safeName = file.name.replace(/\.[^.]+$/, '');

  return new File([blob], `${safeName}.${extension}`, {
    type: nextType,
    lastModified: Date.now(),
  });
};

export async function prepareVehicleImageFile(file: File): Promise<FilePickResult> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { error: 'Choose a JPG, PNG, or WebP image.' };
  }

  if (file.size > MAX_ALLOWED_FILE_SIZE_BYTES) {
    return {
      error: `This image is too large. Please choose a file under ${formatFileSize(
        MAX_ALLOWED_FILE_SIZE_BYTES
      )}.`,
    };
  }

  try {
    const prepared = await optimiseImage(file);
    const previewUrl = URL.createObjectURL(prepared);
    return { file: prepared, previewUrl };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to prepare the selected image.',
    };
  }
}

export default function VehicleImageUploader({
  currentImageUrl,
  hasCustomImage,
  isUploading,
  onFileReady,
  onNotify,
  onRemoveImage,
}: VehicleImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragDepth, setDragDepth] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: string } | null>(
    hasCustomImage && !currentImageUrl.startsWith('blob:')
      ? { name: getFileNameFromUrl(currentImageUrl), size: 'Saved image' }
      : null
  );

  const hasPendingUpload = currentImageUrl.startsWith('blob:');
  const isDragActive = dragDepth > 0;

  useEffect(() => {
    if (!hasCustomImage) {
      setFileMeta(null);
      return;
    }

    if (hasPendingUpload) {
      return;
    }

    setFileMeta({
      name: getFileNameFromUrl(currentImageUrl),
      size: 'Saved image',
    });
  }, [currentImageUrl, hasCustomImage, hasPendingUpload]);

  const pickerLabel = useMemo(() => {
    if (isUploading) {
      return 'Uploading image';
    }

    return hasCustomImage ? 'Replace image' : 'Choose image';
  }, [hasCustomImage, isUploading]);

  const helperText = useMemo(() => {
    if (hasPendingUpload) {
      return 'This image is ready locally and will upload only when you save the vehicle.';
    }

    if (hasCustomImage) {
      return 'Drop a new image anywhere on this panel or use Replace to update the vehicle photo.';
    }

    return `Upload JPG, PNG, or WebP. Large images are compressed before upload. Recommended maximum size: ${formatFileSize(
      MAX_RECOMMENDED_FILE_SIZE_BYTES
    )}.`;
  }, [hasCustomImage, hasPendingUpload]);

  const handleFileSelection = useCallback(
    async (file: File | null | undefined) => {
      if (!file || isUploading) {
        return;
      }

      setLocalError(null);
      const result = await prepareVehicleImageFile(file);

      if (!result.file || !result.previewUrl) {
        const message = result.error || 'Unable to use that image.';
        setLocalError(message);
        onNotify?.(message, 'error');
        return;
      }

      setFileMeta({
        name: result.file.name,
        size: formatFileSize(result.file.size),
      });
      onFileReady({
        file: result.file,
        previewUrl: result.previewUrl,
      });
    },
    [isUploading, onFileReady, onNotify]
  );

  const openPicker = () => {
    if (isUploading) {
      return;
    }

    inputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          void handleFileSelection(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      <div
        role="button"
        tabIndex={isUploading ? -1 : 0}
        aria-disabled={isUploading}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (isUploading) {
            return;
          }

          setDragDepth((current) => current + 1);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragDepth((current) => Math.max(0, current - 1));
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragDepth(0);
          void handleFileSelection(event.dataTransfer.files?.[0]);
        }}
        className={`group relative overflow-hidden rounded-[30px] border border-dashed transition-all duration-200 ${
          isUploading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
        } ${
          isDragActive
            ? 'border-brand-gold bg-brand-gold/10 shadow-[0_0_0_1px_rgba(214,183,109,0.35)]'
            : 'border-white/15 bg-white/[0.04] hover:border-brand-gold/50 hover:bg-white/[0.06]'
        }`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(214,183,109,0.16),_transparent_48%)] opacity-70" />

        {hasCustomImage ? (
          <div className="relative aspect-[4/3]">
            <img
              src={currentImageUrl}
              alt="Vehicle image preview"
              className="h-full w-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/90 via-brand-navy/10 to-brand-navy/35" />

            <div className="absolute right-4 top-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openPicker();
                }}
                disabled={isUploading}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-brand-navy/80 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white transition-all hover:border-brand-gold hover:text-brand-gold disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Replace
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setLocalError(null);
                  setFileMeta(null);
                  onRemoveImage();
                }}
                disabled={isUploading}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-500/25 bg-brand-navy/80 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-red-200 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>

            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {fileMeta?.name || 'Vehicle image'}
                </p>
                <p className="mt-1 text-xs text-white/70">
                  {fileMeta?.size || (hasPendingUpload ? 'Ready to save' : 'Saved image')}
                </p>
              </div>
              {hasPendingUpload && !isUploading && (
                <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/25 bg-brand-gold/15 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Pending Save
                </div>
              )}
            </div>

            {isUploading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-brand-navy/72 backdrop-blur-sm">
                <div className="rounded-full border border-brand-gold/30 bg-brand-gold/10 p-4 text-brand-gold">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
                <div className="px-6 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
                    Uploading image
                  </p>
                  <p className="mt-2 text-sm text-white/80">
                    Hold on while the selected vehicle image is uploaded.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative flex aspect-[4/3] flex-col items-center justify-center px-8 py-10 text-center">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-brand-gold">
              {isUploading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <UploadCloud className="h-8 w-8" />
              )}
            </div>
            <h4 className="mt-6 text-2xl font-semibold text-white">Drag & drop image here</h4>
            <p className="mt-2 text-sm text-brand-grey">or click to upload</p>
            <p className="mt-4 max-w-md text-sm leading-7 text-brand-grey">{helperText}</p>
            <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 px-5 py-4 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold transition-all group-hover:bg-brand-gold/15">
              <ImagePlus className="h-4 w-4" />
              {pickerLabel}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-brand-grey">
        {helperText}
      </div>

      {localError && (
        <p className="text-sm text-red-300" role="alert">
          {localError}
        </p>
      )}
    </div>
  );
}
