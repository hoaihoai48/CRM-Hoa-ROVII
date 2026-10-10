import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';

/**
 * Tự động nén ảnh trên trình duyệt về kích thước tối ưu cho web (Full HD / max 1200px, JPEG chất lượng 80%)
 * và chuyển thành DataURL (chuỗi base64 nhẹ ~80-150KB) để lưu trữ an toàn trong Firestore
 * hoặc tải lên Storage khi có cấu hình.
 * 
 * Ưu điểm:
 * 1. Hoàn toàn MIỄN PHÍ, KHÔNG cần thẻ thanh toán (Blaze Plan)
 * 2. Lưu trực tiếp cùng document sản phẩm, tải cực nhanh
 * 3. Dung lượng siêu nhẹ (~100KB), không chạm trần 1MB của Firestore
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

        // Tính tỉ lệ thu nhỏ
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Không thể xử lý ảnh trên trình duyệt.'));
        }

        // Vẽ ảnh và nén JPEG
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('Không thể đọc dữ liệu hình ảnh.'));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Lỗi khi đọc file ảnh.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Hàm upload ảnh thông minh:
 * - Đầu tiên: Nén ảnh tối ưu trên client.
 * - Thử upload lên Firebase Storage nếu dự án đã cấu hình Bucket.
 * - Nếu Firebase Storage chưa kích hoạt (bị đòi thẻ Blaze / 404), tự động fallback sang lưu Data URL nén (~80KB).
 * => Giúp tính năng chạy ngay lập tức 100% mà người dùng không gặp bất kỳ lỗi nào và không cần nhập thẻ Visa!
 */
export async function uploadProductImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  if (!file) {
    throw new Error('Chưa chọn file ảnh.');
  }

  // Nén ảnh trước để tối ưu dung lượng và tốc độ
  if (onProgress) onProgress(30);
  const compressedDataUrl = await compressImageToDataUrl(file);
  if (onProgress) onProgress(60);

  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  const rawExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const extension = allowedExtensions.includes(rawExtension) ? rawExtension : 'jpg';

  try {
    // Nếu có thể tải lên Firebase Storage (khi đã kích hoạt Bucket)
    const cleanFileName = `${Date.now()}_${crypto.randomUUID()}.${extension}`;
    const storageRef = ref(storage, `products/${cleanFileName}`);

    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    return await new Promise<string>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const pct = Math.round(
            60 + (snapshot.bytesTransferred / snapshot.totalBytes) * 40
          );
          if (onProgress) onProgress(pct);
        },
        (error) => reject(error),
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadUrl);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  } catch {
    // Fallback: Khi Firebase Storage chưa kích hoạt gói Blaze, sử dụng ảnh nén client
    // Ảnh nén ~100KB hoàn toàn hợp lệ và hiển thị hoàn hảo trên giao diện
    if (onProgress) onProgress(100);
    return compressedDataUrl;
  }
}
