/**
 * Client-side image compression.
 *
 * Resizes the longest edge to `maxDimension` (default 1080px) and re-encodes
 * as JPEG at `quality` (default 0.8). This keeps the base64 payload small so
 * it stays under Vercel's serverless request body limit before it is uploaded
 * to external storage.
 *
 * Accepts either a File/Blob (from an <input type="file">) or an existing
 * data URL string (e.g. a camera capture preview).
 */
export async function compressImageToDataUrl(
  input: File | Blob | string,
  options: { maxDimension?: number; quality?: number } = {}
): Promise<string> {
  const maxDimension = options.maxDimension ?? 1080;
  const quality = options.quality ?? 0.8;

  const isString = typeof input === 'string';
  const objectUrl = isString ? input : URL.createObjectURL(input);

  try {
    const img = new Image();
    img.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('تعذر تحميل الصورة.'));
    });

    const { width, height } = img;

    let targetWidth = width;
    let targetHeight = height;

    if (width > height && width > maxDimension) {
      targetHeight = Math.round((height * maxDimension) / width);
      targetWidth = maxDimension;
    } else if (height >= width && height > maxDimension) {
      targetWidth = Math.round((width * maxDimension) / height);
      targetHeight = maxDimension;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return isString ? input : objectUrl;

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    if (!isString) URL.revokeObjectURL(objectUrl);
  }
}
