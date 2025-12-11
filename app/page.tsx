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
  // Removed old simple 'error' state, replaced with 'errorModal'
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);

  // MONETIZATION STATE
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [hasChristmasPass, setHasChristmasPass] = useState(false); 
  const [freeUsed, setFreeUsed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null); 
  const [paywallReason, setPaywallReason] = useState('pass'); 
  
  // ERROR MODAL STATE
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
    btnText: string;
    btnColor: string;
    action: () => void;
  } | null>(null);

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

    const checkUser = async (sessionUser: any = null) => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setFingerprint(result.visitorId);
      } catch (e) { console.warn("Fingerprint failed"); }

      const { data: { session } } = await supabase.auth.getSession();
      let currentId = localStorage.getItem('giggle_device_id');

      if (!currentId) {
        currentId = uuidv4();
        localStorage.setItem('giggle_device_id', currentId!);
      }
      setDeviceId(currentId);

      const lookupId = sessionUser?.email || currentId;
      const lookupCol = sessionUser?.email ? 'email' : 'device_id';

      if (sessionUser?.email) {
          setUserEmail(sessionUser.email);
      }

      const { data: user } = await supabase
          .from('users').select('*').eq(lookupCol, lookupId!).single();

      if (user) {
          if (user.christmas_pass) setHasChristmasPass(true);
          if (user.free_swap_used) setFreeUsed(true);
          
          if (sessionUser?.email && user.device_id) {
              setDeviceId(user.device_id);
              localStorage.setItem('giggle_device_id', user.device_id);
          }
      } else {
          if (!sessionUser?.email) {
            await supabase.from('users').insert([{ device_id: currentId }]);
          }
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
        checkUser(session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            checkUser(session.user);
        }
    });

    return () => subscription.unsubscribe();
  }, [isLocked]);

  // 2. THE WAITING ROOM ANIMATION
  useEffect(() => {
    if (!isLoading) return;
    let msgIndex = 0;
    setLoadingMessage(LOADING_MESSAGES[0]); 

    const interval = setInterval(() => {
      msgIndex++;
      if (msgIndex < LOADING_MESSAGES.length) {
          setLoadingMessage(LOADING_MESSAGES[msgIndex]);
      }
    }, 6000); 

    return () => clearInterval(interval);
  }, [isLoading]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorModal(null);
    }
  };

  const handleSwap = async () => {
    if (!selectedFile) return;

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
    setErrorModal(null);

    try {
      const filename = `${deviceId}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads') 
        .upload(filename, selectedFile);
      
      if (uploadError) throw { type: 'UPLOAD_FAIL', message: uploadError.message };

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
      
      // Handle Paywall Trigger
      if (startRes.status === 402) {
          setIsLoading(false);
          setFreeUsed(true); 
          setPaywallReason('free_limit');
          setShowPaywall(true); 
          return;
      }

      // Handle User Errors (400)
      if (startRes.status === 400) throw { type: 'USER_ERROR' };
      
      // Handle Server Errors (500/504)
      if (startRes.status === 504 || startRes.status === 500) throw { type: 'SERVER_HICCUP' };
      
      if (!startData.success) throw { type: 'MELTDOWN', message: startData.error };
      
      const predictionId = startData.id;

      // POLLING LOOP
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
        } else if (checkData.status === 'failed' || checkData.status === 'canceled') {
            // Check for specific Replicate error text
            const errText = (checkData.error || '').toLowerCase();
            if (errText.includes('face') || errText.includes('detect')) {
                throw { type: 'USER_ERROR' };
            }
            throw { type: 'MELTDOWN' };
        }
      }

    } catch (err: any) {
      console.error("Swap Error:", err);
      setIsLoading(false);
      
      // DEFAULT: Total Meltdown (500)
      let modalState = {
          title: "🍪 The elves are on a cookie break!",
          message: "We are making so much magic right now that the workshop is full. Please come back in 10 minutes! ⏰",
          btnText: "Refresh Page",
          btnColor: "bg-gray-500 hover:bg-gray-600 text-white",
          action: () => window.location.reload()
      };

      const errorType = err.type || 'MELTDOWN';
      const errorMsg = (err.message || '').toLowerCase();

      // ERROR STATE A: USER ERROR (400)
      if (errorType === 'USER_ERROR' || errorMsg.includes('face') || errorMsg.includes('detect')) {
          modalState = {
              title: "🎅 The elves are scratching their heads!",
              message: "We couldn't find a face in that photo. Please pick a clearer photo where your star is looking right at the camera! 📸",
              btnText: "Pick a Different Photo",
              btnColor: "bg-teal-600 hover:bg-teal-700 text-white",
              action: () => { 
                  setErrorModal(null); 
                  setSelectedFile(null); // Force them to re-select
              }
          };
      } 
      // ERROR STATE B: SERVER HICCUP (504/Network)
      else if (errorType === 'SERVER_HICCUP' || errorType === 'UPLOAD_FAIL' || errorMsg.includes('fetch')) {
          modalState = {
              title: "❄️ Whoops! A snowflake got stuck in the gears.",
              message: "The magic stuttered just for a second. Please tap the button one more time! 🔄",
              btnText: "Try Again",
              btnColor: "bg-[#25D366] hover:bg-[#20BA5A] text-white",
              action: () => {
                  setErrorModal(null);
                  handleSwap(); // Retry immediately
              }
          };
      }

      setErrorModal(modalState);
    }
  };

  const handleSmartShare = async () => {
    if (!resultVideoUrl) return;
    setIsSharing(true);
    
    const babyName = "my grandbaby"; 
    const shareText = `I made a little magic with ${babyName}'s photo! ✨👶\n\n👇 Watch it here:\n${resultVideoUrl}\n\nTry it yourself at MyGiggleGram.com`;

    try {
        if (navigator.share) {
            const response = await fetch(resultVideoUrl);
            const blob = await response.blob();
            const file = new File([blob], 'my-giggle-gram.mp4', { type: 'video/mp4' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'My GiggleGram',
                    text: shareText
                });
                return; 
            }
        }
        window.open(`whatsapp://send?text=${encodeURIComponent(shareText)}`, '_blank');
    } catch (err) {
        window.open(`whatsapp://send?text=${encodeURIComponent(shareText)}`, '_blank');
    } finally {
        setIsSharing(false);
    }
  };

  const handleDownload = async () => {
      if (!resultVideoUrl) return;
      setIsDownloading(true);
      try {
        const response = await fetch(resultVideoUrl);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `GiggleGram-${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error("Download failed", err);
        alert("Saving failed. Try long-pressing the video to save!");
      } finally {
        setIsDownloading(false);
      }
  };

  if (isLocked) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm w-full">
                <h1 className="text-4xl mb-4">🚧</h1>
                <h2 className="text-xl font-bold mb-4 text-gray-700">Site Locked</h2>
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
        <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-2 text-teal-900 tracking-tight">Make Christmas Magic! 🎄✨</h1>
        <p className="text-center text-gray-600 mb-8 text-lg font-medium">Choose a scene below to start! 👇</p>

        {hasChristmasPass && (
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full font-bold text-center mb-6 border-2 border-yellow-300 animate-bounce shadow-sm">✨ Christmas VIP Pass Active</div>
        )}

        <div className="bg-white rounded-3xl shadow-xl p-6 border border-pink-100">
          
          <div className="mb-6">
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
                        <img 
                            src={t.thumb} 
                            alt={t.name} 
                            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 
                                ${t.isPremium && !hasChristmasPass ? 'grayscale-[50%] opacity-80' : ''}`} 
                        />
                        
                        {t.isPremium && !hasChristmasPass && (
                            <div className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full shadow-md z-20 backdrop-blur-sm"><span className="text-xs">🔒</span></div>
                        )}
                        {!t.isPremium && (
                            <span className="absolute top-0 right-0 text-[10px] font-black px-2 py-1 rounded-bl-lg shadow-sm z-20 bg-emerald-500 text-white">FREE</span>
                        )}
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1"><span className="text-[10px] font-bold text-white block text-center leading-tight truncate">{t.name}</span></div>
                    </button>
                ))}
            </div>
          </div>

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

          <button 
            onClick={handleSwap} 
            disabled={!selectedFile || isLoading} 
            className={`w-full py-6 rounded-2xl text-2xl font-black shadow-2xl transition-all duration-300 transform
                ${!selectedFile 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : isLoading 
                        ? 'bg-pink-500 text-white cursor-wait animate-pulse' 
                        : 'bg-[#25D366] hover:bg-[#20BA5A] text-white hover:scale-[1.02] active:scale-95 cursor-pointer'
                }`}
          >
             {isLoading ? (
                <span className="flex items-center justify-center gap-3">
                    <span className="animate-spin text-2xl">⏳</span>
                    {loadingMessage}
                </span>
             ) : (
                !selectedFile ? 'Select a Photo Above 👆' : 'Make the Magic! ✨'
             )}
          </button>

          {/* NEW ERROR MODAL IMPLEMENTATION */}
          {errorModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl border-4 border-gray-100">
                    <div className="text-5xl mb-4 animate-bounce">
                        {errorModal.title.includes("elves") ? "🤔" : errorModal.title.includes("cookie") ? "🍪" : "❄️"}
                    </div>
                    <h3 className="text-xl font-black text-gray-800 mb-2">{errorModal.title}</h3>
                    <p className="text-gray-600 mb-6 font-medium">{errorModal.message}</p>
                    <button 
                        onClick={errorModal.action}
                        className={`w-full py-4 rounded-xl font-bold shadow-lg transform active:scale-95 transition-all ${errorModal.btnColor}`}
                    >
                        {errorModal.btnText}
                    </button>
                </div>
            </div>
          )}

          {resultVideoUrl && (
            <div className="mt-8 pt-8 border-t-2 border-dashed border-gray-100">
              <h2 className="text-2xl font-black text-center mb-4 text-teal-800 leading-tight">✨ It Worked! Look at the magic! ✨</h2>
              <div className="relative rounded-2xl shadow-2xl overflow-hidden border-4 border-white ring-4 ring-pink-100 aspect-square bg-black">
                <video src={`${resultVideoUrl}?t=${Date.now()}`} controls autoPlay loop muted playsInline className="w-full h-full object-cover" />
              </div>
              <button onClick={handleSmartShare} disabled={isSharing} className="block mt-6 w-full h-[80px] bg-[#25D366] hover:bg-[#20BA5A] text-white text-xl font-black text-center shadow-xl rounded-2xl flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] active:scale-95">
                <span className="text-3xl">🚀</span>
                {isSharing ? 'Opening WhatsApp...' : 'Send to Family Group'}
              </button>
              
              <button 
                onClick={handleDownload}
                disabled={isDownloading}
                className="block w-full mt-4 text-gray-500 underline text-sm text-center hover:text-gray-700 disabled:opacity-50"
              >
                {isDownloading ? (
                    <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin text-lg">⏳</span> Saving...
                    </span>
                ) : "⬇️ Save to my phone"}
              </button>

              <div className="mt-6 text-xs text-gray-400 flex items-center justify-center gap-1"><span>🔒</span><span>Privacy Lock: We are deleting your photo right now.</span></div>
            </div>
          )}
        </div>
      </div>

      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative">
             
             <button 
                onClick={() => setShowPaywall(false)} 
                className="absolute top-4 right-4 z-20 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
             >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>

            <div className="text-center p-6 pb-2">
                <div className="text-5xl mb-2">🎄</div>
                <h3 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">
                    {paywallReason === 'premium' ? '🔒 Premium Magic!' : 'Woah! You loved that one?'}
                </h3>
                <p className="text-gray-500 mt-2">
                    {paywallReason === 'premium' 
                        ? "That scene is locked! Choose a pass to continue."
                        : "You've used your free magic! Choose a pass to keep going."
                    }
                </p>
            </div>

            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="border-2 border-gray-100 rounded-2xl p-4 flex flex-col justify-between hover:border-gray-200 transition-colors bg-white">
                    <div>
                        <h4 className="text-lg font-bold text-gray-700">🍪 10 Magic Videos</h4>
                        <div className="text-3xl font-black text-gray-900 mt-2">$4.99</div>
                        <p className="text-sm text-gray-500 mt-1">Perfect for a small family.</p>
                    </div>
                    <a 
                        href={`https://mygigglegram.lemonsqueezy.com/buy/adf30529-5df7-4758-8d10-6194e30b54c7?checkout[custom][device_id]=${deviceId}`}
                        className="block w-full bg-pink-200 hover:bg-pink-300 text-pink-900 font-bold py-3 rounded-xl text-center mt-6 transition-transform active:scale-95"
                    >
                        Get 10 Videos
                    </a>
                </div>

                <div className="border-4 border-yellow-400 rounded-2xl p-4 flex flex-col justify-between bg-yellow-50 relative shadow-lg transform sm:scale-105 z-10">
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-yellow-900 text-xs font-black px-3 py-1 rounded-full shadow-sm tracking-wider uppercase">
                        Best Value
                    </div>

                    <div>
                        <h4 className="text-xl font-black text-emerald-900">🎅 "Super Grandma" Pass</h4>
                        <div className="text-4xl font-black text-gray-900 mt-2">$29.99</div>
                        <p className="text-xs font-bold text-emerald-700 bg-emerald-100 inline-block px-2 py-1 rounded-md mt-1 mb-3">
                            ONE-TIME PAYMENT
                        </p>
                        
                        <ul className="text-sm space-y-2 text-emerald-900 font-medium">
                            <li className="flex items-center gap-2">✅ <b>Unlimited</b> Videos</li>
                            <li className="flex items-center gap-2">✅ Cheaper than stamps!</li>
                            <li className="flex items-center gap-2">✅ Send to everyone</li>
                            <li className="flex items-center gap-2 text-gray-500">❌ <span className="font-bold text-gray-700">NO</span> Monthly Fees</li>
                        </ul>
                    </div>

                    <a 
                        href={`https://mygigglegram.lemonsqueezy.com/buy/675e173b-4d24-4ef7-94ac-2e16979f6615?checkout[custom][device_id]=${deviceId}`}
                        className="block w-full bg-[#25D366] hover:bg-[#20BA5A] text-white font-black py-4 rounded-xl text-center mt-6 shadow-xl animate-pulse hover:animate-none transition-transform hover:scale-[1.02] active:scale-95"
                    >
                        Get Unlimited Magic
                    </a>
                </div>

            </div>

            <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                <a href="/login" className="text-teal-600 font-bold underline hover:text-teal-800 text-sm">
                    Already purchased? Restore Pass
                </a>
                <div className="mt-2 text-[10px] text-gray-400 flex items-center justify-center gap-1">
                    <span>🔒</span> One-time payment. No monthly fees. No subscription.
                </div>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}