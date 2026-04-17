import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Share2, MessageCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { shareContent } from '../../../lib/utils/share';

const ShareSheet = ({ isOpen, onClose, shareData }) => {
  if (!shareData) return null;

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
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    onClose();
  };

  const handleNativeShare = async () => {
    try {
      await shareContent({
        title,
        text,
        url
      });
      onClose();
    } catch (err) {
      toast.error("Sharing failed");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] rounded-t-[32px] z-[101] px-6 pb-10 pt-4 shadow-2xl safe-area-bottom"
          >
            {/* Handle */}
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6" />

            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Share</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{title}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* WhatsApp */}
              <button
                onClick={handleWhatsAppShare}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-14 h-14 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center text-green-600 dark:text-green-500 group-hover:scale-110 transition-transform">
                  <MessageCircle className="w-7 h-7 fill-current opacity-20" />
                  <MessageCircle className="w-7 h-7 absolute" />
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">WhatsApp</span>
              </button>

              {/* Copy Link */}
              <button
                onClick={handleCopyLink}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-500 group-hover:scale-110 transition-transform">
                  <Copy className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Copy Link</span>
              </button>

              {/* More / Native */}
              <button
                onClick={handleNativeShare}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-14 h-14 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-gray-600 dark:text-gray-400 group-hover:scale-110 transition-transform">
                  <Share2 className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">More</span>
              </button>
            </div>

            {/* Preview Area */}
            <div className="mt-8 p-4 bg-gray-50 dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-[#1a1a1a] rounded-lg shadow-sm">
                  <ExternalLink className="w-4 h-4 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Preview Link</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 truncate mt-0.5">{url}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ShareSheet;
