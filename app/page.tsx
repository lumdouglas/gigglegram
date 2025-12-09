'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid'; 
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import TEMPLATES from '@/config/templates.json'; 

// 🎅 THE WAITING ROOM (Narrative Loader - 6s Intervals)
const LOADING_MESSAGES = [
  "Connecting to the North Pole... 📡❄️",
  "The elves are finding the magic dust... ✨",
  "Santa is checking the list (twice!)... 📜🎅",
  "Oh my goodness, the cuteness levels are HIGH! 👶🥰",
  "Sprinkling extra holiday cheer... 🎄❤️",
  "Almost there! Wrapping it up... 🎁",
  "The reindeer are landing... 🦌🔔",
  "HERE IT IS! ✨"
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
  const [hasChristmasPass, setHasChristmasPass] = useState(false); 
  const [freeUsed, setFreeUsed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null); 
  const [paywallReason, setPaywallReason] = useState('pass'); 
  
  // PASSWORD STATE
  const [isLocked, setIsLocked] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');

  // 0. CHECK PASSWORD
  useEffect(() => {
    const isUnlocked = localStorage.getItem('site_unlocked');
    if (isUnlocked === 'true') {
        setIsLocked(false);
    }
  }, []);

  const handleUnlock = () => {
      if (passwordInput.toLowerCase() === 'doug') {
          setIsLocked(false);
          localStorage.setItem('site_unlocked', 'true');
      } else {
          alert('Wrong password! Ask Doug.');
      }
  };

  // 1. IDENTITY & PASS CHECK
  useEffect(() => {
    if (isLocked) return;

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

      const lookupId = session?.user?.email ? session.user.email : currentId;
      const lookupCol = session?.user?.email ? 'email' : 'device_id';

      const { data: user } = await supabase
          .from('users').select('*').eq(lookupCol, lookupId!).single();

      if (user) {
          setHasChristmasPass(user.christmas_pass || false);
          setFreeUsed(user.free_swap_used || false);
          if (session?.user?.email) setUserEmail(session.user.email);
      } else {
          if (!session?.user?.email) {
            await supabase.from('users').insert([{ device_id: currentId }]);
          }
      }
    };
    initUser();
  }, [isLocked]);

  // 2. THE WAITING ROOM ANIMATION (Strict 6s Interval)
  useEffect(() => {
    if (!isLoading) return;
    let msgIndex = 0;
    setLoadingMessage(LOADING_MESSAGES[0]); 

    const interval = setInterval(() => {
      msgIndex++;
      // Stop at the last message, don't loop endlessly
      if (msgIndex < LOADING_MESSAGES.length) {
          setLoadingMessage(LOADING_MESSAGES[msgIndex]);
      }
    }, 6000); 

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

    // 🛑 PREMIUM GATEKEEPER
    if (selectedTemplate.isPremium && !hasChristmasPass) {
        setPaywallReason('premium');
        setShowPaywall(true); 
        return;
    }

    // 🛑 SOFT LOCK
    if (!selectedTemplate.isPremium && freeUsed && !hasChristmasPass) {
        setPaywallReason('free_limit');
        setShowPaywall(true); 
        return; 
    }

    setIsLoading(true);
    setError(null);

    try {
      const filename = `${deviceId}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads') 
        .upload(filename, selectedFile);
      
      if (uploadError) throw new Error("Upload failed: " + uploadError.message);

      const startRes = await fetch('/api/swap', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-device-id': fingerprint || 'unknown'
        },
        body: JSON.stringify({ 
            sourceImage: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/uploads/${filename}`,
            targetVideo: selectedTemplate.url 
        }),
      });
      
      const startData = await startRes.json();
      if (startRes.status === 402) {
          setIsLoading(false);
          setFreeUsed(true); 
          setPaywallReason('free_limit');
          setShowPaywall(true); 
          return;
      }
      
      if (!startData.success) throw new Error(startData.error || 'Failed to start magic');
      const predictionId = startData.id;

      while (true) {
        await new Promise(r => setTimeout(r, 3000));
        const checkRes = await fetch(`/api/swap?id=${predictionId}`);
        const checkData = await checkRes.json();

        if (checkData.status === 'succeeded') {
            if (!hasChristmasPass) {
                setFreeUsed(true);
                await supabase.from('users').update({ free_swap_used: true }).eq('device_id', deviceId);
            }

            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }

            setResultVideoUrl(checkData.output);
            setIsLoading(false);
            break;
        } else if (checkData.status === 'failed') {
            throw new Error(checkData.error || 'Magic failed');
        }
      }

    } catch (err: any) {
      console.error("Swap Error:", err);
      setIsLoading(false);
      const errorMsg = (err.message || '').toLowerCase();
      if (errorMsg.includes('face') || errorMsg.includes('detect')) {
          setError("Uh oh! We couldn't see a face. Try a closer photo! 🧐");
      } else {
          setError('The magic fizzled out! Try again. ✨');
      }
    }
  };

  const handleSmartShare = async () => {
    if (!resultVideoUrl) return;
    setIsSharing(true);
    
    // 🎄 1. THE MESSAGE PAYLOAD
    // We add the video link directly in the text so WhatsApp generates a preview card.
    const babyName = "my grandbaby"; 
    const shareText = `I made a little magic with ${babyName}'s photo! ✨👶\n\n👇 Watch it here:\n${resultVideoUrl}\n\nTry it yourself at MyGiggleGram.com`;

    try {
        // ATTEMPT A: Native Share Sheet (Sends actual file if supported)
        if (navigator.share) {
            // Fetch the video blob to share it as a FILE (Highest Quality)
            const response = await fetch(resultVideoUrl);
            const blob = await response.blob();
            const file = new File([blob], 'my-giggle-gram.mp4', { type: 'video/mp4' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'My GiggleGram',
                    text: shareText
                });
                return; // Success!
            }
        }

        // ATTEMPT B: Fallback (Link Sharing)
        // If native file share fails, we open WhatsApp with the text + video link
        window.open(`whatsapp://send?text=${encodeURIComponent(shareText)}`, '_blank');

    } catch (err) {
        // Fallback for errors (e.g., user cancelled share)
        console.error("Share failed:", err);
        window.open(`whatsapp://send?text=${encodeURIComponent(shareText)}`, '_blank');
    } finally {
        setIsSharing(false);
    }
  };

  const handleDownload = () => {
      if (resultVideoUrl) {
          window.open(resultVideoUrl, '_blank');
      }
  };

  if (isLocked) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm w-full">
                <h1 className="text-4xl mb-4">🚧</h1>
                <input type="password" placeholder="Password" className="w-full p-4 border-2 border-gray-200 rounded-xl mb-4 text-center text-xl" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
                <button onClick={handleUnlock} className="w-full bg-pink-500 text-white py-4 rounded-xl font-bold text-xl hover:bg-pink-600 transition-colors">Unlock</button>
            </div>
        </div>
      );
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-b from-pink-50 to-white relative">
      
      <div className="absolute top-4 right-4 z-10">
        {userEmail ? (
            <span className="text-xs font-medium text-teal-800 bg-white/80 px-3 py-1 rounded-full border border-teal-100 backdrop-blur-sm">👤 {userEmail.split('@')[0]}</span>
        ) : (
            <a href="/login" className="text-sm font-bold text-teal-700 hover:text-teal-900 underline decoration-2 decoration-pink-300">Log In</a>
        )}
      </div>

      <div className="max-w-md mx-auto pt-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-2 text-teal-900 tracking-tight">My Grandbaby Runs The World!</h1>
        <p className="text-center text-gray-600 mb-8 text-lg font-medium">The favorite grandbaby magic, just for you ✨</p>

        {hasChristmasPass && (
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full font-bold text-center mb-6 border-2 border-yellow-300 animate-bounce shadow-sm">✨ Christmas VIP Pass Active</div>
        )}

        <div className="bg-white rounded-3xl shadow-xl p-6 border border-pink-100">
          
          {/* TEMPLATE SELECTOR */}
          <div className="mb-6">
            <span className="text-xl font-bold mb-3 block text-gray-700">👇 Pick a Magic Scene</span>
            <div className="flex overflow-x-auto gap-3 pb-4 snap-x px-1 scrollbar-hide">
                {TEMPLATES.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => {
                            if (t.isPremium && !hasChristmasPass) { setPaywallReason('premium'); setShowPaywall(true); } 
                            else { setSelectedTemplate(t); }
                        }}
                        className={`flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden border-4 transition-all duration-200 relative snap-center group ${selectedTemplate.id === t.id ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] scale-105 z-10' : 'border-transparent shadow-sm hover:scale-105 opacity-90'}`}
                    >
                        <img src={t.thumb} alt={t.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        {t.isPremium && !hasChristmasPass && <div className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full shadow-md z-20 backdrop-blur-sm"><span className="text-xs">🔒</span></div>}
                        {!t.isPremium && <span className="absolute top-0 right-0 text-[10px] font-black px-2 py-1 rounded-bl-lg shadow-sm z-20 bg-emerald-500 text-white">FREE</span>}
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1"><span className="text-[10px] font-bold text-white block text-center leading-tight truncate">{t.name}</span></div>
                    </button>
                ))}
            </div>
          </div>

          {/* UPLOAD & ACTION AREA */}
          <div className="mb-8">
             <label className="block w-full cursor-pointer relative group transition-transform active:scale-95">
                <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                <div className={`w-full h-48 rounded-3xl shadow-xl flex flex-col items-center justify-center overflow-hidden transition-all duration-300 ${selectedFile ? 'bg-white border-4 border-teal-400' : 'bg-white hover:shadow-2xl border border-gray-100'}`}>
                    {selectedFile ? (
                    <div className="relative w-full h-full">
                        <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover opacity-90" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px]"><span className="bg-white px-6 py-3 rounded-full font-black text-teal-600 shadow-2xl flex items-center gap-2 transform scale-110">✅ Photo Ready</span></div>
                    </div>
                    ) : (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><span className="text-3xl">📸</span></div>
                        <span className="text-2xl font-black text-gray-800">Pick a Photo</span>
                        <span className="text-sm text-gray-400 mt-1">Tap to open camera roll</span>
                    </div>
                    )}
                </div>
             </label>
          </div>

          <div className="flex items-center justify-start gap-1 mb-6 text-xs text-gray-400 pl-2"><span>🔒</span><span>Photo deleted automatically.</span></div>

          <button onClick={handleSwap} disabled={!selectedFile || isLoading} className={`w-full py-6 rounded-2xl text-2xl font-black text-white shadow-2xl transition-all duration-300 transform ${selectedFile && !isLoading ? 'bg-pink-500 hover:bg-pink-400 scale-[1.02] animate-pulse cursor-pointer shadow-pink-500/50' : 'bg-teal-500 hover:bg-teal-400 opacity-100'}`}>
             {isLoading ? <span className="flex items-center justify-center gap-3"><span className="animate-spin text-2xl">⏳</span>{loadingMessage}</span> : (selectedFile ? '✨ Make the Magic ✨' : 'Select a Photo First 👆')}
          </button>

          {error && <div className="mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-center gap-3 animate-shake"><span className="text-2xl">🧐</span><p className="text-red-700 font-medium leading-tight">{error}</p></div>}

          {/* 3. THE MOMENT OF TRUTH (Success Screen) */}
          {resultVideoUrl && (
            <div className="mt-8 pt-8 border-t-2 border-dashed border-gray-100">
              <h2 className="text-2xl font-black text-center mb-4 text-teal-800 leading-tight">✨ It Worked! Look at the magic! ✨</h2>
              
              <div className="relative rounded-2xl shadow-2xl overflow-hidden border-4 border-white ring-4 ring-pink-100 aspect-square bg-black">
                <video 
                    src={`${resultVideoUrl}?t=${Date.now()}`} 
                    controls 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className="w-full h-full object-cover" 
                />
              </div>

              {/* PRIMARY BUTTON: The Money Maker */}
              <button 
                onClick={handleSmartShare} 
                disabled={isSharing} 
                className="block mt-6 w-full h-[80px] bg-[#25D366] hover:bg-[#20BA5A] text-white text-xl font-black text-center shadow-xl rounded-2xl flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] active:scale-95"
              >
                <span className="text-3xl">🚀</span>
                {isSharing ? 'Opening WhatsApp...' : 'Send to Family Group'}
              </button>

              {/* SECONDARY BUTTON: Save */}
              <button 
                onClick={handleDownload}
                className="block w-full mt-4 text-gray-500 underline text-sm text-center hover:text-gray-700"
              >
                ⬇️ Save to my phone
              </button>

              {/* TRUST FOOTER */}
              <div className="mt-6 text-xs text-gray-400 flex items-center justify-center gap-1">
                <span>🔒</span>
                <span>Privacy Lock: We are deleting your photo right now.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPaywall && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-4 border-emerald-200 relative overflow-hidden">
             <button onClick={() => setShowPaywall(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            <div className="text-6xl mb-4">🎄</div>
            <h3 className="text-2xl font-black text-gray-800 mb-2 leading-tight">{paywallReason === 'premium' ? 'Unlock Premium Magic!' : 'Unlock 10 More Videos!'}</h3>
            <p className="text-gray-600 mb-8 font-medium">Get the Christmas Family Pack!<br/>Unlock everything for just $29.99.</p>
            {/* ⚠️ REPLACE WITH YOUR REAL LINK */}
            <a href={`https://mygigglegram.lemonsqueezy.com/buy/adf30529-5df7-4758-8d10-6194e30b54c7?checkout[custom][device_id]=${deviceId}`} className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl text-xl font-black mb-4 shadow-lg shadow-emerald-200 transform transition-transform hover:scale-105 flex items-center justify-center gap-2"><span>Get Christmas Pass</span></a>
            <div className="border-t border-gray-100 pt-4"><p className="text-gray-400 text-sm mb-1">Already have credits?</p><a href="/login" className="text-teal-600 font-bold underline hover:text-teal-800">Log in to restore them</a></div>
            <button onClick={() => setShowPaywall(false)} className="block mt-6 text-gray-400 text-sm hover:text-gray-600 underline mx-auto">Maybe later</button>
          </div>
        </div>
      )}
    </main>
  );
}