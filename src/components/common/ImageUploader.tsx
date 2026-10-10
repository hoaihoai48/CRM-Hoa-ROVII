'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UploadCloud, X, Loader2 } from 'lucide-react';
import { uploadProductImage } from '@/lib/services';

interface ImageUploaderProps {
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  onImageRemoved?: () => void;
  disabled?: boolean;
}

export function ImageUploader({
  currentImageUrl,
  onImageUploaded,
  onImageRemoved,
  disabled = false,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Sync preview when parent passes a new URL (e.g. switching edited product).
  useEffect(() => {
    if (!isUploading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl(currentImageUrl || null);
    }
  }, [currentImageUrl, isUploading]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Vui lòng chọn file hình ảnh (JPG, PNG, WebP,...).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Kích thước ảnh không được vượt quá 10MB.');
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);
    setUploadProgress(0);

    // Local preview immediately for smooth UX
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      const downloadUrl = await uploadProductImage(file, (progress) => {
        setUploadProgress(progress);
      });
      setPreviewUrl(downloadUrl);
      onImageUploaded(downloadUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Tải ảnh lên thất bại.'
      );
      // Revert preview on failure
      setPreviewUrl(currentImageUrl || null);
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewUrl(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onImageRemoved) {
      onImageRemoved();
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-stone-700">
        Hình ảnh sản phẩm
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
        className="hidden"
      />

      {previewUrl ? (
        <div className="relative group rounded-xl border border-stone-200 overflow-hidden bg-stone-50 max-w-sm h-48 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Hình ảnh sản phẩm"
            className="w-full h-full object-cover"
          />

          {isUploading && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-white">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <p className="text-xs font-medium">Đang tải ảnh lên... {uploadProgress}%</p>
              <div className="w-36 bg-white/30 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-emerald-400 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {!isUploading && !disabled && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-white text-stone-800 text-xs font-semibold rounded-lg hover:bg-stone-100 transition-colors shadow-xs"
              >
                Đổi ảnh
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-xs"
                title="Xóa ảnh"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50/50'
              : 'border-stone-200 hover:border-rose-300 bg-stone-50/50'
          } ${disabled || isUploading ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center py-2">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
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
                Hỗ trợ JPG, PNG, WebP (Tối đa 10MB)
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
