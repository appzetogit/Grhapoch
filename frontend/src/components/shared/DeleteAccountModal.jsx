import { useState, useEffect, useRef } from 'react';
import { X, Trash2, AlertTriangle, ShieldAlert, IndianRupee } from 'lucide-react';

/**
 * DeleteAccountModal
 * Props:
 *   isOpen        - boolean
 *   onClose       - () => void
 *   onConfirm     - async () => void  (called after "DELETE" typed and confirmed)
 *   loading       - boolean
 *   module        - 'user' | 'restaurant' | 'delivery'
 *   walletBalance - number | null (show withdraw warning if > 0)
 */
const DeleteAccountModal = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  module = 'user',
  walletBalance = null,
}) => {
  const [typed, setTyped] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTyped('');
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasBalance = walletBalance != null && walletBalance > 0;
  const canConfirm = typed === 'DELETE' && !loading;

  const moduleLabels = {
    user: 'your user account',
    restaurant: 'your restaurant account',
    delivery: 'your delivery partner account',
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-6 pb-[74px] sm:pb-6"
      onClick={handleBackdrop}
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-100px)]"
        style={{ animation: 'modalAppear 0.3s cubic-bezier(.22,.68,0,1.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-red-600 px-5 py-4 flex items-center gap-3 shrink-0">
          <div className="bg-red-500 rounded-full p-2">
            <Trash2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-bold text-base leading-tight">Delete Account</h2>
            <p className="text-red-200 text-xs">This action is permanent and irreversible</p>
          </div>
          <button
            onClick={onClose}
            className="text-red-200 hover:text-white transition-colors p-1 rounded-full hover:bg-red-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 custom-scrollbar">
          {/* Main Warning */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">You are about to permanently delete {moduleLabels[module]}.</p>
              <ul className="mt-2 text-xs text-red-700 space-y-1 list-disc list-inside">
                <li>All your personal data will be deleted from our system</li>
                <li>Your order history and preferences will be removed</li>
                {module === 'restaurant' && <li>Your restaurant menu, timings, and listings will be removed</li>}
                {module === 'delivery' && <li>Your trip history and earnings records will be removed</li>}
                <li>This action <strong>cannot be undone</strong></li>
              </ul>
            </div>
          </div>

          {/* Wallet Warning */}
          {hasBalance && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <IndianRupee className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Wallet Balance: ₹{walletBalance.toFixed(2)}</p>
                <p className="text-xs text-amber-700 mt-1">
                  You have an unsettled wallet balance. Please withdraw your funds before deleting your account to avoid losing them permanently.
                </p>
              </div>
            </div>
          )}

          {/* Security Badge */}
          <div className="flex items-center gap-2 text-gray-500">
            <ShieldAlert className="w-4 h-4" />
            <p className="text-xs">To confirm deletion, type <strong className="text-gray-800 font-mono">DELETE</strong> in the field below.</p>
          </div>

          {/* Confirmation Input */}
          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="w-full border-2 rounded-xl px-4 py-3 text-sm font-mono tracking-widest outline-none transition-all"
            style={{
              borderColor: typed === 'DELETE' ? '#ef4444' : typed.length > 0 ? '#fbbf24' : '#e5e7eb',
              background: typed === 'DELETE' ? '#fef2f2' : 'white',
            }}
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        {/* Footer */}
        <div className="px-5 pb-6 pt-2 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              background: canConfirm ? '#dc2626' : '#f1a1a1',
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Deleting…
              </span>
            ) : (
              'Delete Account'
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalAppear {
          from { transform: scale(0.9) translateY(20px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default DeleteAccountModal;
