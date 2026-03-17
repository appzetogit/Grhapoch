import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Remove", 
  cancelText = "Cancel",
  type = "danger"
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-[360px] bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header/Icon */}
          <div className="pt-6 px-6 pb-2 text-center">
            <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
              type === 'danger' ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
            }`}>
              {type === 'danger' ? <Trash2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {title}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="p-6 flex flex-col gap-2">
            <Button
              onClick={onConfirm}
              className={`w-full py-6 rounded-xl font-bold text-base transition-all active:scale-[0.98] ${
                type === 'danger' 
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20' 
                  : 'bg-primary-orange hover:opacity-90 text-white'
              }`}
            >
              {confirmText}
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
              className="w-full py-6 rounded-xl font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {cancelText}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConfirmationModal;
