import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Share2, MessageCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { shareContent } from '../../../lib/utils/share';
import { createPortal } from 'react-dom';

const ShareSheet = ({ isOpen, onClose, shareData }) => {
  if (!shareData || typeof document === 'undefined') return null;

  const { title, text, url } = shareData;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
      onClose();
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handleWhatsAppShare = () => {
    const shareText = `${text}\n\n${url}`;
    const encodedText = encodeURIComponent(shareText);
    const whatsappUrl = `https://wa.me/?text=${encodedText}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-[4px] z-[999999]"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] rounded-t-[32px] z-[1000000] px-6 pb-12 pt-4 shadow-[0_-8px_30px_rgb(0,0,0,0.25)] safe-area-bottom"
          >
            {/* Handle */}
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6" />

            <div className="flex justify-between items-start mb-8">
              <div className="flex-1 mr-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Share</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{title}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 active:scale-95 transition-transform"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-8 max-w-sm mx-auto">
              {/* WhatsApp */}
              <button
                onClick={handleWhatsAppShare}
                className="flex flex-col items-center gap-3 group"
              >
                <div className="w-16 h-16 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-lg shadow-green-500/20 active:scale-90 transition-transform">
                  <svg viewBox="0 0 24 24" className="w-9 h-9 fill-current">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.634 1.437h.005c6.558 0 11.897-5.335 11.9-11.894a11.83 11.83 0 00-3.486-8.422z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">WhatsApp</span>
              </button>

              {/* Copy Link */}
              <button
                onClick={handleCopyLink}
                className="flex flex-col items-center gap-3 group"
              >
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-500 shadow-lg shadow-blue-500/10 active:scale-90 transition-transform">
                  <Copy className="w-7 h-7" />
                </div>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Copy Link</span>
              </button>
            </div>

            {/* Preview Area */}
            <a 
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-10 block p-4 bg-gray-50 dark:bg-[#111111] rounded-[24px] border border-gray-100 dark:border-gray-800 active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                  <ExternalLink className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest leading-none">Tap to Open</p>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300 truncate mt-1">{url}</p>
                </div>
              </div>
            </a>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ShareSheet;
