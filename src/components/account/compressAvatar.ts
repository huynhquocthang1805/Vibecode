// Owner: data-engineer (Huy) — ACC-05: Nén avatar 256 px bằng canvas & xoá EXIF/GPS
import { LIMITS_ACCOUNT } from '@/types/domain';

export async function compressAvatar(
  file: File,
  maxDimension: number = LIMITS_ACCOUNT.AVATAR_SIZE_PX,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Không thể khởi tạo canvas context 2D'));
        return;
      }

      // Xoá canvas và vẽ lại ảnh (tự động loại bỏ metadata EXIF/GPS)
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Thử xuất ra WebP, fallback JPEG
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            // Fallback sang jpeg
            canvas.toBlob(
              (jpegBlob) => {
                if (jpegBlob) resolve(jpegBlob);
                else reject(new Error('Nén ảnh canvas thất bại.'));
              },
              'image/jpeg',
              0.85,
            );
          }
        },
        'image/webp',
        0.85,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Không thể tải file ảnh để nén.'));
    };

    img.src = objectUrl;
  });
}
