'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UploadCloud, X, Loader2, Star } from 'lucide-react';
import { uploadProductImage } from '@/lib/services';
import { MAX_PRODUCT_IMAGES } from '@/lib/services/products';

interface MultiImageUploaderProps {
  imageUrls: string[];
  onImagesChanged: (urls: string[]) => void;
  disabled?: boolean;
  maxImages?: number;
}

export function MultiImageUploader({
  imageUrls,
  onImagesChanged,
  disabled = false,
  maxImages = MAX_PRODUCT_IMAGES,
}: MultiImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [urls, setUrls] = useState<string[]>(imageUrls);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync when parent passes a new list (e.g. switching edited product).
  useEffect(() => {
    if (!isUploading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrls(imageUrls);
    }
  }, [imageUrls, isUploading]);

  const emit = (next: string[]) => {
    setUrls(next);
    onImagesChanged(next);
  };

  const handleFiles = async (files: FileList | File[]) => {
    const picked = Array.from(files);
    if (picked.length === 0) return;

    const slotsLeft = maxImages - urls.length;
    if (slotsLeft <= 0) {
      setErrorMessage(`Tối đa ${maxImages} ảnh cho mỗi sản phẩm.`);
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const next = [...urls];
      for (const file of picked.slice(0, slotsLeft)) {
        if (!file.type.startsWith('image/')) {
          throw new Error('Vui lòng chỉ chọn file hình ảnh (JPG, PNG, WebP,...).');
        }
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('Kích thước mỗi ảnh không được vượt quá 10MB.');
        }
        const downloadUrl = await uploadProductImage(file, (progress) => {
          setUploadProgress(progress);
        });
        next.push(downloadUrl);
      }
      emit(next);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Tải ảnh lên thất bại.'
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = (index: number) => {
    emit(urls.filter((_, i) => i !== index));
    setErrorMessage(null);
  };

  const handleSetCover = (index: number) => {
    if (index <= 0) return;
    const next = [...urls];
    const [cover] = next.splice(index, 1);
    emit([cover, ...next]);
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-stone-700">
        Hình ảnh sản phẩm ({urls.length}/{maxImages})
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
          }
        }}
        disabled={disabled || isUploading || urls.length >= maxImages}
        className="hidden"
      />

      {urls.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {urls.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="relative group rounded-xl border border-stone-200 overflow-hidden bg-stone-50 aspect-square"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Hình ảnh sản phẩm ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {index === 0 && (
                <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-amber-950">
                  <Star className="w-3 h-3" /> Bìa
                </span>
              )}
              {!isUploading && !disabled && (
                <div className="absolute inset-x-0 bottom-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                  {index !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleSetCover(index)}
                      title="Đặt làm ảnh bìa"
                      className="p-1 bg-white text-stone-800 rounded-md hover:bg-stone-100 transition-colors"
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    title="Xóa ảnh"
                    className="p-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {urls.length < maxImages && (
        <div
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (disabled || isUploading) return;
            if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && !isUploading) setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          className={`border-2 border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/50'
              : 'border-stone-200 hover:border-rose-300 bg-stone-50/50'
          } ${disabled || isUploading ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center py-1">
              <Loader2 className="w-7 h-7 text-emerald-600 animate-spin mb-2" />
              <p className="text-xs font-semibold text-stone-700">Đang tải ảnh lên ({uploadProgress}%)</p>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-2">
                <UploadCloud className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-stone-800">
                Nhấn để chọn ảnh hoặc kéo thả vào đây
              </p>
              <p className="text-[11px] text-stone-400 mt-1">
                Hỗ trợ JPG, PNG, WebP (Tối đa 10MB/ảnh, {maxImages} ảnh/sản phẩm). Ảnh đầu tiên là ảnh bìa.
              </p>
            </>
          )}
        </div>
      )}

      {errorMessage && (
        <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
      )}
    </div>
  );
}
