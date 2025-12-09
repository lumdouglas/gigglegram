import React from 'react';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: () => void; // Connects to Lemon Squeezy later
}

export default function PaywallModal({ isOpen, onClose, onPurchase }: PaywallModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Close Button (Top Right) */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header Image / Hook */}
        <div className="bg-gradient-to-r from-teal-500 to-emerald-500 p-6 text-center">
          <div className="text-4xl mb-2">🎄✨</div>
          <h2 className="text-2xl font-bold text-white leading-tight">
            Unlock the Christmas<br/>Family Pack
          </h2>
        </div>

        {/* Value Props - The "Why" */}
        <div className="p-6 space-y-4">
          <p className="text-lg text-gray-600 text-center leading-relaxed">
            You found a <b>Premium Magic</b> template! Unlock everything to make the holidays hilarious.
          </p>

          <ul className="space-y-3 mt-4">
            <li className="flex items-center gap-3 text-gray-700 font-medium">
              <span className="text-emerald-500 text-xl">✅</span>
              Unlock <b>Sleigh Ride & Carolers</b>
            </li>
            <li className="flex items-center gap-3 text-gray-700 font-medium">
              <span className="text-emerald-500 text-xl">✅</span>
              <b>Add Grandkids</b> to Group Videos
            </li>
            <li className="flex items-center gap-3 text-gray-700 font-medium">
              <span className="text-emerald-500 text-xl">✅</span>
              Remove Watermarks Forever
            </li>
          </ul>
        </div>

        {/* The Offer & CTA */}
        <div className="p-6 pt-0 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center justify-center gap-2 mb-4 mt-4">
            <span className="text-3xl font-bold text-gray-900">$29.99</span>
            <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-200">
              One-time only
            </span>
          </div>

          <button
            onClick={onPurchase}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xl font-bold py-4 rounded-xl shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span>Get Christmas Access</span>
            <span>🎁</span>
          </button>

          {/* Trust Footer */}
          <div className="mt-4 flex items-center justify-center gap-1 text-xs text-gray-400">
            <span>🔒</span>
            <span>Secure payment. No subscription. Money-back guarantee.</span>
          </div>
        </div>
      </div>
    </div>
  );
}