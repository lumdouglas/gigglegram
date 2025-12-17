'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid'; 
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import TEMPLATES from '@/config/templates.json'; 

const LOADING_MESSAGES = [
  "Connecting to the North Pole... 📡",                  // 0s
  "The elves are finding the magic dust... ✨",          // 6s
  "Santa is checking the list (twice!)... 📜",           // 12s
  "Oh my goodness, the cuteness levels are HIGH! 👶",    // 18s
  "Sprinkling extra holiday cheer... 🎄",                // 24s
  "Almost there! Wrapping it up... 🎁",                  // 30s
  "The reindeer are landing... 🦌",                      // 36s
  "HERE IT IS! ✨"                                       // 42s
];

export default function Home() {
  // --- STATE ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]); 
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  
  // MONETIZATION
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [hasChristmasPass, setHasChristmasPass] = useState(false); 
  const [credits, setCredits] = useState(0); 
  const [freeUsed, setFreeUsed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null); 
  const [paywallReason, setPaywallReason] = useState('pass'); 
  
  // UI
  const [errorModal, setErrorModal] = useState<any>(null);

  // --- EFFECTS ---

  useEffect(() => {
    const checkUser = async (sessionUser: any = null) => {
      try {
        try {
            const fp = await FingerprintJS.load();
            const result = await fp.get();
            setFingerprint(result.visitorId);
        } catch (e) { console.warn("FP failed"); }

        const { data: { session } } = await supabase.auth.getSession();
        
        let currentId = localStorage.getItem('giggle_device_id');
        if (!currentId) {
            currentId = uuidv4();
            localStorage.setItem('giggle_device_id', currentId!);
        }
        setDeviceId(currentId);

        const localFreeUsed = localStorage.getItem('giggle_free_used');
        if (localFreeUsed === 'true') setFreeUsed(true);

        const lookupId = sessionUser ? sessionUser.id : currentId;
        const lookupCol = sessionUser ? 'id' : 'device_id';

        if (sessionUser?.email) setUserEmail(sessionUser.email);

        const { data: user } = await supabase
            .from('magic_users').select('*').eq(lookupCol, lookupId!).maybeSingle();

        if (user) {
            if (user.christmas_pass) {
                setHasChristmasPass(true);
                setFreeUsed(false); 
            } else {
                if (user.remaining_credits > 0) setCredits(user.remaining_credits);
                if (user.free_swap_used) {
                    setFreeUsed(true);
                    localStorage.setItem('giggle_free_used', 'true');
                }
            }
            if (sessionUser?.email && user.device_id) {
                setDeviceId(user.device_id);
                localStorage.setItem('giggle_device_id', user.device_id);
            }
        } else {
            if (!sessionUser?.email) {
                await supabase.from('magic_users').insert([{ device_id: currentId, remaining_credits: 1 }]);
            }
        }
      } catch (err: any) {
          console.error("Init Error:", err);
      } finally {
          setIsInitializing(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
        checkUser(session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            setIsInitializing(true);
            checkUser(session.user);
        }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    let msgIndex = 0;
    setLoadingMessage(LOADING_MESSAGES[0]); 
    const interval = setInterval(() => {
      msgIndex++;
      if (msgIndex < LOADING_MESSAGES.length) {
          setLoadingMessage(LOADING_MESSAGES[msgIndex]);
      }
    }, 8000); 
    return () => clearInterval(interval);
  }, [isLoading]);

  // --- HANDLERS ---

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorModal(null);
    }
  };

  const handleSwap = async () => {
    if (!selectedFile) return;

    // 1. Check Permissions
    if (selectedTemplate.isPremium && !hasChristmasPass && credits <= 0) {
        setPaywallReason('premium');
        setShowPaywall(true); 
        return;
    }
    const isAllowed = hasChristmasPass || credits > 0 || !freeUsed;
    if (!isAllowed) {
        setPaywallReason('free_limit');
        setShowPaywall(true); 
        return; 
    }

    setIsLoading(true);
    setErrorModal(null);

    try {
      // 2. Upload Photo
      const filename = `${deviceId}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('uploads').upload(filename, selectedFile);
      
      if (uploadError) {
          throw { type: 'UPLOAD_FAIL', message: `Upload Failed: ${uploadError.message}` };
      }

      // 3. Call API
      // DIAGNOSTIC: Log the URL we are sending
      const sourceUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/uploads/${filename}`;
      console.log("🚀 Sending to API:", sourceUrl);

      const startRes = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-id': deviceId || 'unknown' },
        body: JSON.stringify({ 
            sourceImage: sourceUrl,
            targetVideo: selectedTemplate.url 
        }),
      });
      
      // DIAGNOSTIC: Catch 404/500 immediately
      if (!startRes.ok) {
          const text = await startRes.text(); // Read raw text in case it's HTML
          console.error("🔥 API Error Raw:", text);
          throw { 
              type: 'SERVER_HICCUP', 
              message: `API Error ${startRes.status}: ${text.substring(0, 50)}...` 
          };
      }

      const startData = await startRes.json();
      
      if (startRes.status === 402) {
          setIsLoading(false);
          setFreeUsed(true); 
          localStorage.setItem('giggle_free_used', 'true'); 
          await supabase.from('magic_users').update({ free_swap_used: true }).eq('device_id', deviceId);
          setPaywallReason('free_limit');
          setShowPaywall(true); 
          return;
      }

      if (!startData.success) throw { type: 'MELTDOWN', message: startData.error || "Unknown API Error" };
      
      const predictionId = startData.id;

      // 4. Poll for Result
      while (true) {
        await new Promise(r => setTimeout(r, 3000));
        const checkRes = await fetch(`/api/swap?id=${predictionId}`);
        const checkData = await checkRes.json();

        if (checkData.status === 'succeeded') {
            if (!hasChristmasPass) {
                if (credits > 0) {
                    setCredits(prev => prev - 1); 
                } else {
                    setFreeUsed(true);
                    localStorage.setItem('giggle_free_used', 'true'); 
                    await supabase.from('magic_users').update({ free_swap_used: true }).eq('device_id', deviceId);
                }
            }
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
            
            // FIX: Handle Array or String output from Replicate
            let finalUrl = checkData.output;
            if (Array.isArray(finalUrl)) {
                finalUrl = finalUrl[0]; // Grab the first link if it's a list
            }
            
            setResultVideoUrl(finalUrl); 
            setIsLoading(false);
            break;
        }
      }
    } catch (err: any) {
      console.error("Swap Error:", err);
      setIsLoading(false);
      
      // DIAGNOSTIC: Show the REAL error in the modal
      const debugMessage = err.message || JSON.stringify(err);
      
      let modal = {
          title: "🍪 The elves are on a cookie break!",
          message: `DEBUG ERROR: ${debugMessage}`, // <--- THIS WILL TELL US THE TRUTH
          btnText: "Refresh Page",
          btnColor: "bg-gray-500 text-white",
          action: () => window.location.reload()
      };
      
      const type = err.type || 'MELTDOWN';
      if (type === 'USER_ERROR') {
          modal = {
              title: "🎅 No face found!",
              message: "Please pick a clearer photo where they are looking at the camera!",
              btnText: "Try Again",
              btnColor: "bg-teal-600 text-white",
              action: () => { setErrorModal(null); setSelectedFile(null); }
          };
      }
      setErrorModal(modal);
    }
  };

  const handleSmartShare = async () => {
    if (!resultVideoUrl) return;
    setIsSharing(true);
    if (deviceId) {
        const { data } = await supabase.from('magic_users').select('shares_count').eq('device_id', deviceId).single();
        if (data) {
             await supabase.from('magic_users').update({ shares_count: (data.shares_count || 0) + 1 }).eq('device_id', deviceId);
        }
    }
    const shareText = `I made a little magic! ✨\n\n👇 Watch it here:\n${resultVideoUrl}\n\nTry it at MyGiggleGram.com`;
    try {
        if (navigator.share) {
            const response = await fetch(resultVideoUrl);
            const blob = await response.blob();
            const file = new File([blob], 'magic.mp4', { type: 'video/mp4' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'My GiggleGram', text: shareText });
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
        alert("Saving failed. Try long-pressing the video!");
      } finally {
        setIsDownloading(false);
      }
  };

  // --- RENDER ---

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-b from-pink-50 to-white relative pb-20">
      
      {/* HEADER WITH LOGOUT */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        {userEmail ? (
            <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-medium text-teal-800 bg-white/80 px-3 py-1 rounded-full border border-teal-100">👤 {userEmail.split('@')[0]}</span>
                <button onClick={handleLogout} className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-white/80 px-3 py-1 rounded-full border border-rose-100 shadow-sm transition-colors cursor-pointer">Log Out</button>
            </div>
        ) : (
            <a href="/login" className="text-sm font-bold text-teal-700 underline decoration-pink-300">Log In</a>
        )}
      </div>

      <div className="max-w-md mx-auto pt-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-2 text-teal-900 tracking-tight">Make Christmas Magic! 🎄✨</h1>
        
        {hasChristmasPass && (
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full font-bold text-center mb-6 border-2 border-yellow-300 animate-bounce">✨ Christmas VIP Pass Active</div>
        )}

        {/* CREDIT DISPLAY LOGIC */}
        {!hasChristmasPass && (
            <div className="w-full text-center py-4 mb-2 min-h-[60px] flex items-center justify-center">
                {isInitializing ? (
                    <span className="text-gray-400 text-sm font-bold flex items-center gap-2"><span className="animate-spin">⏳</span> Connecting...</span>
                ) : credits > 0 ? (
                    // 🟢 CHANGED: Now a button so users can buy more even if they have credits
                    <button 
                        onClick={() => { setPaywallReason('free_limit'); setShowPaywall(true); }} 
                        className="bg-teal-100 text-teal-800 text-lg font-bold px-6 py-2 rounded-full shadow-sm hover:bg-teal-200 transition-colors flex items-center gap-2 active:scale-95 border-2 border-teal-200"
                    >
                        <span>✨ {credits === 1 ? "1 Free Magic Video" : `${credits} Magic Videos`}</span>
                        <span className="text-xs bg-white/60 text-teal-900 px-2 py-0.5 rounded-full font-bold">+ Add</span>
                    </button>
                ) : !freeUsed ? (
                    <span className="bg-emerald-100 text-emerald-800 text-lg font-bold px-6 py-2 rounded-full shadow-sm animate-pulse">🎁 1 Free Magic Gift</span>
                ) : (
                    <button onClick={() => { setPaywallReason('free_limit'); setShowPaywall(true); }} className="bg-rose-100 text-rose-800 text-lg font-bold px-6 py-2 rounded-full shadow-md animate-pulse border border-rose-200">🔓 Unlock Unlimited Magic</button>
                )}
            </div>
        )}

        <div className="bg-white rounded-3xl shadow-xl p-6 border border-pink-100">
          <div className="mb-6 flex overflow-x-auto gap-3 pb-4 snap-x px-1 scrollbar-hide">
            {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => { if (t.isPremium && !hasChristmasPass && credits <= 0) { setPaywallReason('premium'); setShowPaywall(true); } else { setSelectedTemplate(t); } }} className={`flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden border-4 transition-all duration-200 relative snap-center ${selectedTemplate.id === t.id ? 'border-yellow-400 scale-105 z-10' : 'border-transparent opacity-90'}`}>
                    <img src={t.thumb} alt={t.name} className={`w-full h-full object-cover ${(t.isPremium && !hasChristmasPass && credits <= 0) ? 'grayscale opacity-80' : ''}`} />
                    {(t.isPremium && !hasChristmasPass && credits <= 0) && <div className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full text-xs">🔒</div>}
                </button>
            ))}
          </div>

          <div className="mb-8">
             <label className="block w-full cursor-pointer relative group active:scale-95 transition-transform">
                <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                <div className={`w-full h-64 rounded-3xl shadow-xl flex flex-col items-center justify-center overflow-hidden border-4 transition-all duration-300 relative ${selectedFile ? 'bg-black border-teal-400' : 'bg-white hover:shadow-2xl border-gray-100'}`}>
                    {selectedFile ? (
                        <>
                            <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover object-[50%_20%]" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px] pointer-events-none">
                                <span className="bg-white px-6 py-3 rounded-full font-black text-teal-600 shadow-2xl flex items-center gap-2 transform scale-110">
                                    ✅ Photo Ready
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mb-3"><span className="text-3xl">📸</span></div>
                            <span className="text-2xl font-black text-gray-800">Pick a Photo</span>
                        </div>
                    )}
                </div>
             </label>
          </div>

          <div className="flex items-center justify-start gap-1 mb-6 text-xs text-gray-400 pl-2"><span>🔒</span><span>Powered by AI Magic. Photo deleted immediately.</span></div>

          <button onClick={handleSwap} disabled={!selectedFile || isLoading || isInitializing} className={`w-full py-6 rounded-2xl text-2xl font-black shadow-xl transition-all ${(!selectedFile || isInitializing) ? 'bg-gray-300' : isLoading ? 'bg-pink-500 animate-pulse' : 'bg-[#25D366] active:scale-95 text-white'}`}>
             {isLoading ? loadingMessage : isInitializing ? 'Loading...' : !selectedFile ? 'Select a Photo Above 👆' : 'Make the Magic! ✨'}
          </button>

          {errorModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
                <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center">
                    <h3 className="text-xl font-bold mb-2">{errorModal.title}</h3>
                    <p className="mb-4">{errorModal.message}</p>
                    <button onClick={errorModal.action} className={`w-full py-3 rounded-xl font-bold ${errorModal.btnColor}`}>{errorModal.btnText}</button>
                </div>
            </div>
          )}

          {resultVideoUrl && (
            <div className="mt-8 pt-8 border-t-2 border-dashed border-gray-100">
              <div className="relative rounded-2xl shadow-2xl overflow-hidden aspect-square bg-black">
                <video src={`${resultVideoUrl}?t=${Date.now()}`} controls autoPlay loop playsInline className="w-full h-full object-cover" />
              </div>
              <button onClick={handleSmartShare} disabled={isSharing} className="block mt-6 w-full h-[80px] bg-[#25D366] text-white text-xl font-black text-center shadow-xl rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform">
                🚀 {isSharing ? 'Opening...' : 'Send to Family'}
              </button>
              <button onClick={handleDownload} disabled={isDownloading} className="block w-full mt-4 text-gray-500 underline text-sm text-center">⬇️ Save to phone</button>
              
              <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 text-center shadow-sm">
                <p className="text-sm text-amber-900 font-bold mb-1">⚠️ Don&apos;t lose your magic!</p>
                <p className="text-xs text-amber-800 leading-snug">To protect your privacy, we do not keep a copy.<br/><strong className="font-black">Send it to your family now to save it forever!</strong></p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative p-6">
             <button onClick={() => setShowPaywall(false)} className="absolute top-4 right-4 p-2 bg-gray-200 rounded-full">✕</button>
             <div className="text-center mb-6"><div className="text-5xl mb-2">🎄</div><h3 className="text-xl font-bold text-black text-center mb-2">Woah! You loved that one?</h3><p className="text-gray-500">Choose a pass to keep going!</p></div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a href={`https://mygigglegram.lemonsqueezy.com/buy/adf30529-5df7-4758-8d10-6194e30b54c7?checkout[custom][device_id]=${deviceId}`} className="border-2 border-gray-200 rounded-2xl p-4 active:border-rose-500 active:scale-95 transition-all bg-white text-center block">
                    <h4 className="font-bold text-lg text-black">🍪 10 Magic Videos</h4><div className="font-bold text-xl text-black">$4.99</div><div className="mt-4 bg-rose-500 text-white font-bold py-3 rounded-xl">Get 10 Videos</div>
                </a>
                <a href={`https://mygigglegram.lemonsqueezy.com/buy/675e173b-4d24-4ef7-94ac-2e16979f6615?checkout[custom][device_id]=${deviceId}`} className="border-4 border-yellow-400 rounded-2xl p-4 active:scale-95 transition-all relative text-center block">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-xs font-black px-3 py-1 rounded-full">BEST VALUE</div>
                    <h4 className="font-bold text-lg text-black">🎅 Super Grandma Pass</h4><div className="font-bold text-xl text-black">$29.99</div><div className="mt-4 bg-[#25D366] text-white font-black py-3 rounded-xl animate-pulse">Get Unlimited Magic</div>
                </a>
             </div>
             <div className="mt-6 text-center text-xs text-gray-400"><a href="/login" className="underline text-teal-600">Restore Purchase</a><br/>One-time payment. No subscription.</div>
          </div>
        </div>
      )}
    </main>
  );
}