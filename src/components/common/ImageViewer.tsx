import React from 'react';
import { X, Download, Trash2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { saveImage } from '../../utils/saveImage';

interface ImageViewerProps {
  url: string | null;
  onClose: () => void;
  /** Render a video (Reel) instead of an image. */
  video?: boolean;
  /** Show a "Save Image" action inside the viewer. */
  allowSave?: boolean;
  /** Show a "Delete" action (only when the viewer can mutate the photo). */
  allowDelete?: boolean;
  /** Called when the owner deletes the photo. */
  onDelete?: () => void;
}

/**
 * Reusable full-screen image lightbox. Mobile-first, Halaqi glass style.
 * Tapping the backdrop or the close button closes it; tapping the image
 * itself does not. Reused by profile posted-image grids (Feature 4) and can
 * replace the inline viewer in MessagesView.
 */
export const ImageViewer: React.FC<ImageViewerProps> = ({
  url,
  onClose,
  video = false,
  allowSave = true,
  allowDelete = false,
  onDelete,
}) => {
  const { isRtl } = useLanguage();

  if (!url) return null;

  const canDelete = allowDelete && Boolean(onDelete);

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/95 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        title={isRtl ? 'إغلاق' : 'Close'}
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {video ? (
        <video
          src={url}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-xl object-contain"
          controls
          autoPlay
          loop
          playsInline
        />
      ) : (
        <img
          src={url}
          alt=""
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-xl object-contain"
        />
      )}

      <div
        className={`absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 ${
          isRtl ? 'flex-row-reverse' : ''
        }`}
      >
        {allowSave && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              saveImage(url);
            }}
            className="flex items-center gap-2 rounded-full bg-[#D4AF37] px-4 py-2.5 text-sm font-bold text-black transition-all hover:bg-[#B8962D]"
          >
            <Download className="h-4 w-4" />
            {isRtl ? 'حفظ الصورة' : 'Save Image'}
          </button>
        )}

        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-red-500"
          >
            <Trash2 className="h-4 w-4" />
            {isRtl ? 'حذف الصورة' : 'Delete Photo'}
          </button>
        )}
      </div>
    </div>
  );
};
