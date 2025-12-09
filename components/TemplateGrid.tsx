import React, { useState } from 'react';
import templates from '@/config/templates.json'; // The JSON we just made
import PaywallModal from './PaywallModal';
import { useRouter } from 'next/navigation';
import { getCheckoutUrl } from '@/lib/lemonSqueezy';

export default function TemplateGrid({ userIsPremium, userId, userEmail }: { userIsPremium: boolean, userId: string, userEmail: string }) {
  const [showPaywall, setShowPaywall] = useState(false);
  const router = useRouter();

  const handleTemplateClick = (template: any) => {
    // THE GATEKEEPER LOGIC
    if (template.isPremium && !userIsPremium) {
      // If it's locked and she hasn't paid -> Show the "Christmas Upsell"
      setShowPaywall(true);
    } else {
      // If free OR she paid -> Go to Magic Editor
      router.push(`/create/${template.id}`);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
        {templates.map((t) => (
          <div 
            key={t.id} 
            onClick={() => handleTemplateClick(t)}
            className="relative cursor-pointer group rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all"
          >
            {/* Thumbnail */}
            <img src={t.previewImage} alt={t.name} className="w-full h-auto object-cover aspect-square" />
            
            {/* The Label */}
            <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
              <p className="text-white font-bold text-sm truncate">{t.name}</p>
            </div>

            {/* The Lock Badge (Psychological Trigger) */}
            {t.isPremium && !userIsPremium && (
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md rounded-full p-1.5 border border-white/20">
                <span className="text-lg">🔒</span> 
              </div>
            )}
            
            {/* Free Badge (To guide the "Princess" grandmas) */}
            {!t.isPremium && (
              <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
                TRY FREE
              </div>
            )}
          </div>
        ))}
      </div>

      {/* The Upsell Modal */}
      <PaywallModal 
        isOpen={showPaywall} 
        onClose={() => setShowPaywall(false)}
        onPurchase={() => window.location.href = getCheckoutUrl(userId, userEmail)} 
      />
    </>
  );
}