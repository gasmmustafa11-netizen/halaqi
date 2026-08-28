/**
 * saveImage — download an arbitrary image URL to the device.
 *
 * Works for cross-origin URLs (e.g. Supabase public buckets) by fetching the
 * blob and triggering a client-side download. Falls back to opening the URL in
 * a new tab if the fetch is blocked by CORS or any other error.
 */

function extensionFromUrl(url: string): string {
  try {
    const path = new URL(url, window.location.origin).pathname;
    const ext = path.split('.').pop();
    if (ext && /^[a-z0-9]{1,5}$/i.test(ext)) return ext.toLowerCase();
  } catch {
    /* ignore */
  }
  return 'jpg';
}

export async function saveImage(
  url: string,
  filename?: string
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !url) {
    return { success: false, error: 'رابط الصورة غير صالح.' };
  }

  const name = filename || `halaqi-image.${extensionFromUrl(url)}`;

  try {
    const res = await fetch(url, { mode: 'cors' });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = name;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // Give the browser a tick to start the download before revoking.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);

    return { success: true };
  } catch (error) {
    console.error('[SAVE IMAGE]', error);

    // Graceful fallback: open in a new tab so the user can save manually.
    try {
      window.open(url, '_blank', 'noopener');
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'تعذر حفظ الصورة. حاول يدوياً بفتح الصورة في تبويب جديد.',
      };
    }
  }
}
