import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';

/**
 * Tải ảnh sản phẩm hoa lên Firebase Storage
 * Đường dẫn lưu trữ: products/{timestamp}_{random}_{filename}
 * 
 * @param file File ảnh được chọn từ client
 * @param onProgress Callback thông báo tiến trình upload (0 - 100%)
 * @returns Public download URL của ảnh
 */
export async function uploadProductImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  if (!file) {
    throw new Error('Chưa chọn file ảnh.');
  }

  // Giới hạn kích thước ảnh tối đa 10MB
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('Dung lượng ảnh không được vượt quá 10MB.');
  }

  // Kiểm tra định dạng hợp lệ
  if (!file.type.startsWith('image/')) {
    throw new Error('File được chọn không phải là hình ảnh hợp lệ.');
  }

  const extension = file.name.split('.').pop() || 'jpg';
  const cleanFileName = `${Date.now()}_${crypto.randomUUID()}.${extension}`;
  const storageRef = ref(storage, `products/${cleanFileName}`);

  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        if (onProgress) {
          onProgress(progress);
        }
      },
      (error) => {
        reject(new Error(`Tải ảnh thất bại: ${error.message}`));
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Không lấy được đường dẫn ảnh.'));
        }
      }
    );
  });
}
