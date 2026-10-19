/**
 * Zero-cost image handling for Firebase Spark:
 * compress images in the browser and store the resulting Data URL in Firestore.
 * This module intentionally does not import or call Firebase Storage.
 *
 * Keep images reasonably small because Firestore documents have a 1 MiB limit.
 */
export async function compressImageToDataUrl(
  file: File,
  maxWidth: number = 1000,
  maxHeight: number = 1000,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File được chọn không phải là hình ảnh hợp lệ.'));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Không thể xử lý ảnh trên trình duyệt.'));
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };

      img.onerror = () => reject(new Error('Không thể đọc dữ liệu hình ảnh.'));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Lỗi khi đọc file ảnh.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Compress and return an image Data URL. The caller stores it in the product
 * document; no bucket, Storage Rules deployment, or billing-enabled Storage
 * configuration is required.
 */
export async function uploadProductImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  if (!file) {
    throw new Error('Chưa chọn file ảnh.');
  }

  if (onProgress) onProgress(30);
  const compressedDataUrl = await compressImageToDataUrl(file);
  if (onProgress) onProgress(100);
  return compressedDataUrl;
}
