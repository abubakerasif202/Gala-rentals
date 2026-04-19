import React, { useCallback, useMemo, useState } from 'react';
import { ImagePlus, Loader2, RefreshCw, Trash2, UploadCloud } from 'lucide-react';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1800;
const JPEG_QUALITY = 0.82;

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
  onRemoveImage: () => void;
}

const formatFileSize = (bytes: number) => `${Math.round(bytes / (1024 * 1024))}MB`;

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
  const shouldCompress = file.size > MAX_FILE_SIZE_BYTES * 0.8;

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
  const blob = await canvasToBlob(canvas, nextType, nextType === 'image/jpeg' ? JPEG_QUALITY : undefined);
  const extension = nextType === 'image/png' ? 'png' : 'jpg';
  const safeName = file.name.replace(/\.[^.]+$/, '');

  return new File([blob], `${safeName}.${extension}`, {
    type: nextType,
    lastModified: Date.now(),
  });
};

export async function prepareVehicleImageFile(file: File): Promise<FilePickResult> {
  if (!file.type.startsWith('image/')) {
    return { error: 'Choose a JPG, PNG, or WebP image.' };
  }

  if (file.size > MAX_FILE_SIZE_BYTES * 3) {
    return {
      error: `This image is too large. Please choose a file under ${formatFileSize(
        MAX_FILE_SIZE_BYTES * 3
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
  onRemoveImage,
}: VehicleImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const pickerLabel = useMemo(() => {
    if (isUploading) {
      return 'Uploading image';
    }

    return hasCustomImage ? 'Replace image' : 'Choose image';
  }, [hasCustomImage, isUploading]);

  const handleFileSelection = useCallback(
    async (file: File | null | undefined) => {
      if (!file) {
        return;
      }

      setLocalError(null);
      const result = await prepareVehicleImageFile(file);

      if (!result.file || !result.previewUrl) {
        setLocalError(result.error || 'Unable to use that image.');
        return;
      }

      onFileReady({
        file: result.file,
        previewUrl: result.previewUrl,
      });
    },
    [onFileReady]
  );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-brand-grey">
              Vehicle Image
            </p>
            <p className="mt-1 text-sm text-white">
              {hasCustomImage ? 'Current vehicle photo' : 'Default Maple Rentals placeholder'}
            </p>
          </div>
          {isUploading && (
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Uploading
            </div>
          )}
        </div>

        <div className="aspect-[4/3] bg-brand-navy/50">
          <img src={currentImageUrl} alt="Vehicle preview" className="h-full w-full object-cover" />
        </div>
      </div>

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={async (event) => {
          event.preventDefault();
          setIsDragging(false);
          const droppedFile = event.dataTransfer.files?.[0];
          await handleFileSelection(droppedFile);
        }}
        className={`rounded-[28px] border border-dashed px-5 py-6 transition-all ${
          isDragging
            ? 'border-brand-gold bg-brand-gold/10'
            : 'border-white/15 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]'
        }`}
      >
        <div className="flex flex-col items-start gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-brand-gold">
            <UploadCloud className="h-5 w-5" />
          </div>

          <div>
            <h4 className="text-lg font-semibold text-white">Drag and drop a vehicle image</h4>
            <p className="mt-2 text-sm leading-7 text-brand-grey">
              Upload JPG, PNG, or WebP. Maple Rentals will optimise large images for easier admin
              management. Recommended maximum upload size: {formatFileSize(MAX_FILE_SIZE_BYTES)}.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-brand-gold px-5 py-4 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-navy transition-all hover:bg-brand-gold-light">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  await handleFileSelection(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              {hasCustomImage ? <RefreshCw className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
              {pickerLabel}
            </label>

            <button
              type="button"
              onClick={onRemoveImage}
              disabled={!hasCustomImage}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-[10px] font-bold uppercase tracking-[0.22em] text-brand-grey transition-all hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Remove image
            </button>
          </div>

          {localError && <p className="text-sm text-red-300">{localError}</p>}
        </div>
      </div>
    </div>
  );
}
