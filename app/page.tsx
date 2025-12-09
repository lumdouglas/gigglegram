'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid'; 
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import TEMPLATES from '@/config/templates.json'; // ✅ USES YOUR JSON SOURCE OF TRUTH

// 🎅 THE GIGGLE LOOP (Status Messages)
const LOADING_MESSAGES = [
  "🍪 Santa is baking your cookies... (Heating up the GPU)",
  "🎅 Joke: What do elves learn in school? The Elf-abet!",
  "🧝 The Elves are polishing the camera lens...",
  "🦌 Joke: What do you call a blind reindeer? No-eye-deer!",
  "✨ Adding the magic sparkles...",
  "❄️ Joke: What falls but never gets hurt? Snow!",
  "🎁 Almost ready! Don't close your phone...",
  "🎄 Here it comes!! (Just a few more seconds)"
];

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]); 
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  
  // Default to the first free template
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);

  // MONETIZATION STATE
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [hasChristmasPass, setHasChristmasPass] = useState(false); // ✅ UPDATED STRATEGY
  const [freeUsed, setFreeUsed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null); 
  
  // 1. IDENTITY & PASS CHECK
  useEffect(() => {
    const initUser = async () => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setFingerprint(result.visitorId);
      } catch (e) {
        console.warn("Fingerprint failed");
      }

      const { data: { session } } = await supabase.auth.getSession();
      let currentId = localStorage.getItem('giggle_device_id');

      if (!currentId) {
        currentId = uuidv4();
        localStorage.setItem('giggle_device_id', currentId!);
      }
      setDeviceId(currentId);

      // Check DB for this user
      const lookupId = session?.user?.email ? session.user.email : currentId;
      const lookupCol = session?.user?.email ? 'email' : 'device_id';

      // ⚠️ Make sure your 'users' table has a 'christmas_pass' boolean column!
      const { data: user } = await supabase
          .from('users').select('*').eq(lookupCol, lookupId!).single();

      if (user) {
          setHasChristmasPass(user.christmas_pass || false);
          setFreeUsed(user.free_swap_used || false);
          if (session?.user?.email) setUserEmail(session.user.email);
      } else {
          // New user
          if (!session?.user?.email) {
            await supabase.from('users').insert([{ device_id: currentId }]);
          }
      }
    };
    initUser();
  }, []);

  // 2. THE GIGGLE LOOP ANIMATION
  useEffect(() => {
    if (!isLoading) return;
    let msgIndex = 0;
    setLoadingMessage(LOADING_MESSAGES[0]); 

    const interval = setInterval(() => {
      msgIndex++;
      setLoadingMessage(LOADING_MESSAGES[msgIndex % LOADING_MESSAGES.length]);
    }, 4000); 

    return () => clearInterval(interval);
  }, [isLoading]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSwap = async () => {
    if (!selectedFile) {
        setError("Please pick a photo first! 📸");
        return;
    }

    // 🛑 PREMIUM GATEKEEPER (The Christmas Pass Logic)
    if (selectedTemplate.isPremium && !hasChristmasPass) {
        setShowPaywall(true); 
        return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // ✅ FIX: Use the 'uploads' bucket we made public in the previous step
      const filename = `${deviceId}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads') // CHANGED FROM 'user-uploads'
        .upload(filename, selectedFile);
      
      if (uploadError) throw new Error("Upload failed: " + uploadError.message);

      // 3. START THE MAGIC
      const startRes = await fetch('/api/swap', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-device-id': fingerprint || 'unknown'
        },
        body: JSON.stringify({ 
            templateId: selectedTemplate.id, // Send ID, let backend find URL
            imageKey: filename // Send filename, let backend build URL
        }),
      });
      
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || 'Failed to start magic');

      const predictionId = startData.predictionId;

      // 4. POLL FOR RESULTS
      while (true) {
        await new Promise(r => setTimeout(r, 3000));
        const checkRes = await fetch(`/api/swap?id=${predictionId}`);
        const checkData = await checkRes.json();

        if (checkData.status === 'succeeded') {
            setResultVideoUrl(checkData.output);
            setIsLoading(false);
            
            // Mark free usage if they haven't paid
            if (!hasChristmasPass) {
                setFreeUsed(true);
                await supabase.from('users').update({ free_swap_used: true }).eq('device_id', deviceId);
            }
            break;
        } else if (checkData.status === 'failed' || checkData.status === 'canceled') {
            throw new Error('The magic fizzled out! Try a different photo.');
        }
      }

    } catch (err: any) {
      console.error("Swap Error:", err);
      setIsLoading(false);
      setError('The magic fizzled out! Try again or pick a different photo. ✨');
    }
  };

  const handleSmartShare = async () => {
    if (!resultVideoUrl) return;
    setIsSharing(true);
    const shareData = {
        title: 'My GiggleGram',
        text: 'Look what I made 😂\nMyGiggleGram.com - you have to try this! 🎄',
    };
    try {
        if (navigator.share) {
            await navigator.share({ ...shareData, url: resultVideoUrl });
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(shareData.text + " " + resultVideoUrl)}`, '_blank');
        }
    } catch (err) {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareData.text + " " + resultVideoUrl)}`, '_blank');
    } finally {
        setIsSharing(false);
    }
  };

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-b from-pink-50 to-white relative"> 
      
      {/* 👤 TOP RIGHT LOGIN */}
      <div className="absolute top-4 right-4 z-10">
        {userEmail ? (
            <span className="text-xs font-medium text-teal-800 bg-white/80 px-3 py-1 rounded-full border border-teal-100 backdrop-blur-sm">
                👤 {userEmail.split('@')[0]}
            </span>
        ) : (
             <span className="text-xs font-bold text-teal-700">MyGiggleGram 🎄</span>
        )}
      </div>

      <div className="max-w-md mx-auto pt-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-2 text-teal-900 tracking-tight">
          My Grandbaby Runs The World!
        </h1>
        <p className="text-center text-gray-600 mb-8 text-lg font-medium">The favorite grandbaby magic, just for you ✨</p>

        {hasChristmasPass && (
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full font-bold text-center mb-6 border-2 border-yellow-300 animate-bounce shadow-sm">
                ✨ Christmas VIP Pass Active
            </div>
        )}

        <div className="bg-white rounded-3xl shadow-xl p-6 border border-pink-100">
          
          {/* 🎬 TEMPLATE SELECTOR (THUMBNAIL GRID) */}
          <div className="mb-6">
            <span className="text-xl font-bold mb-3 block text-gray-700">👇 Pick a Magic Scene</span>
            <div className="flex overflow-x-auto gap-3 pb-4 snap-x px-1 scrollbar-hide">
                {TEMPLATES.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => {
                            // If it's premium and they don't have pass, show paywall immediately
                            if (t.isPremium && !hasChristmasPass) {
                                setShowPaywall(true); 
                            } else {
                                setSelectedTemplate(t);
                            }
                        }}
                        className={`flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden border-4 transition-all duration-200 relative snap-center group ${
                            selectedTemplate.id === t.id 
                            ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] scale-105 z-10' 
                            : 'border-transparent shadow-sm hover:scale-105 opacity-90'
                        }`}
                    >
                        <img 
                            src={t.previewImage} 
                            alt={t.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        {t.isPremium && !hasChristmasPass && (
                            <div className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full shadow-md z-20 backdrop-blur-sm">
                                <span className="text-xs">🔒</span>
                            </div>
                        )}
                        {!t.isPremium && (
                            <span className="absolute top-0 right-0 text-[10px] font-black px-2 py-1 rounded-bl-lg shadow-sm z-20 bg-emerald-500 text-white">
                                FREE
                            </span>
                        )}
                        
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1">
                            <span className="text-[10px] font-bold text-white block text-center leading-tight truncate">
                                {t.name}
                            </span>
                        </div>
                    </button>
                ))}
            </div>
          </div>

          {/* UPLOAD & ACTION AREA */}
          <div className="mb-8">
             <label className="block w-full cursor-pointer relative group transition-transform active:scale-95">
                <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                <div className={`w-full h-48 rounded-3xl shadow-xl flex flex-col items-center justify-center overflow-hidden transition-all duration-300
                    ${selectedFile 
                    ? 'bg-white border-4 border-teal-400' 
                    : 'bg-white hover:shadow-2xl border border-gray-100'
                    }`}
                >
                    {selectedFile ? (
                    <div className="relative w-full h-full">
                        <img 
                        src={URL.createObjectURL(selectedFile)} 
                        className="w-full h-full object-cover opacity-90" 
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px]">
                            <span className="bg-white px-6 py-3 rounded-full font-black text-teal-600 shadow-2xl flex items-center gap-2 transform scale-110">
                                ✅ Photo Ready
                            </span>
                        </div>
                    </div>
                    ) : (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <span className="text-3xl">📸</span>
                        </div>
                        <span className="text-2xl font-black text-gray-800">Pick a Photo</span>
                        <span className="text-sm text-gray-400 mt-1">Tap to open camera roll</span>
                    </div>
                    )}
                </div>
             </label>
          </div>

          <button 
            onClick={handleSwap} 
            disabled={!selectedFile || isLoading} 
            className={`w-full py-6 rounded-2xl text-2xl font-black text-white shadow-2xl transition-all duration-300 transform
                ${selectedFile && !isLoading
                ? 'bg-pink-500 hover:bg-pink-400 scale-[1.02] animate-pulse cursor-pointer shadow-pink-500/50' 
                : 'bg-teal-500 hover:bg-teal-400 opacity-100' 
                }`}
          >
             {isLoading ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="animate-spin text-2xl">⏳</span>
                  {loadingMessage}
                </span>
             ) : (
                selectedFile ? '✨ Make the Magic ✨' : 'Select a Photo First 👆'
             )}
          </button>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-center gap-3 animate-shake">
              <span className="text-2xl">🧐</span>
              <p className="text-red-700 font-medium leading-tight">{error}</p>
            </div>
          )}

          {resultVideoUrl && (
            <div className="mt-8 pt-8 border-t-2 border-dashed border-gray-100">
              <h2 className="text-2xl font-black text-center mb-4 text-teal-800">🎉 Look what your grandbaby made!</h2>
              <div className="relative rounded-2xl shadow-2xl overflow-hidden border-4 border-white ring-4 ring-pink-100">
                <video 
                    src={resultVideoUrl} 
                    controls 
                    autoPlay 
                    loop 
                    playsInline 
                    className="w-full" 
                />
              </div>
              <button onClick={handleSmartShare} disabled={isSharing} className="block mt-6 w-full bg-[#25D366] hover:bg-[#20BA5A] text-white py-4 rounded-xl text-xl font-black text-center shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]">
                {isSharing ? 'Preparing...' : 'Send to Family Group 🎄❤️'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 🎄 CHRISTMAS PASS PAYWALL MODAL */}
      {showPaywall && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-4 border-emerald-200 relative overflow-hidden">
             
             {/* Close Button */}
             <button onClick={() => setShowPaywall(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>

            <div className="text-6xl mb-4">🎄</div>
            <h3 className="text-2xl font-black text-gray-800 mb-2 leading-tight">
                Unlock the<br/>Christmas Family Pack!
            </h3>
            <p className="text-gray-600 mb-8 font-medium">
              You found a <b>Premium Magic</b> template!<br/>
              Unlock Sleigh Rides, Family Carols, and remove all watermarks forever.
            </p>
            
            {/* ⚠️ REPLACE THIS LINK WITH YOUR $29.99 LEMON SQUEEZY CHECKOUT LINK */}
            <a 
              href={`https://mygigglegram.lemonsqueezy.com/buy/YOUR_VARIANT_ID_HERE?checkout[custom][device_id]=${deviceId}`}
              className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl text-xl font-black mb-4 shadow-lg shadow-emerald-200 transform transition-transform hover:scale-105 flex items-center justify-center gap-2"
            >
              <span>Get Christmas Access</span>
              <span>$29.99</span>
            </a>
            
            <p className="text-xs text-gray-400">One-time payment. Secure & Safe. 🔒</p>
          </div>
        </div>
      )}
    </main>
  );
}