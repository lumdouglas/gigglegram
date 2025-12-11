'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid'; 
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import TEMPLATES from '@/config/templates.json'; 

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
  // --- STATE ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]); 
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [debugStatus, setDebugStatus] = useState('Initializing...');
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
  const [isLocked, setIsLocked] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');

  // --- EFFECTS ---

  useEffect(() => {
    const isUnlocked = localStorage.getItem('site_unlocked');
    if (isUnlocked === 'true') setIsLocked(false);
  }, []);

  useEffect(() => {
    if (isLocked) return;

    const checkUser = async (sessionUser: any = null) => {
      try {
        setDebugStatus('Checking ID...');
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

        const lookupId = sessionUser?.email || currentId;
        const lookupCol = sessionUser?.email ? 'email' : 'device_id';

        if (sessionUser?.email) setUserEmail(sessionUser.email);

        const { data: user } = await supabase
            .from('users').select('*').eq(lookupCol, lookupId!).single();

        if (user) {
            setDebugStatus('✅ User Found');
            if (user.christmas_pass) {
                setHasChristmasPass(true);
                setFreeUsed(false); 
            } else {
                if (user.credits_remaining > 0) setCredits(user.credits_remaining);
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
                setDebugStatus('Creating User...');
                await supabase.from('users').insert([{ device_id: currentId, credits_remaining: 0 }]);
            }
        }
      } catch (err: any) {
          setDebugStatus(`Error: ${err.message}`);
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
  }, [isLocked]);

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

  const handleUnlock = () => {
      if (passwordInput.toLowerCase() === 'doug') {
          setIsLocked(false);
          localStorage.setItem('site_unlocked', 'true');
      } else {
          alert('Wrong password!');
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorModal(null);
    }
  };

  const handleSwap = async () => {
    if (!selectedFile) return;

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
      const filename = `${deviceId}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('uploads').upload(filename, selectedFile);
      if (uploadError) throw { type: 'UPLOAD_FAIL', message: uploadError.message };

      const startRes = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-id': fingerprint || 'unknown' },
        body: JSON.stringify({ 
            sourceImage: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/uploads/${filename}`,
            targetVideo: selectedTemplate.url 
        }),
      });
      
      const startData = await startRes.json();
      
      if (startRes.status === 402) {
          setIsLoading(false);
          setFreeUsed(true); 
          localStorage.setItem('giggle_free_used', 'true'); 
          await supabase.from('users').update({ free_swap_used: true }).eq('device_id', deviceId);
          setPaywallReason('free_limit');
          setShowPaywall(true); 
          return;
      }

      if (startRes.status === 400) throw { type: 'USER_ERROR' };
      if (startRes.status === 504 || startRes.status === 500) throw { type: 'SERVER_HICCUP' };
      if (startRes.status === 429) throw { type: 'MELTDOWN' };
      if (!startData.success) throw { type: 'MELTDOWN', message: startData.error };
      
      const predictionId = startData.id;

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
                    await supabase.from('users').update({ free_swap_used: true }).eq('device_id', deviceId);
                }
            }
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
            setResultVideoUrl(checkData.output);
            setIsLoading(false);
            break;
        } else if (checkData.status === 'failed' || checkData.status === 'canceled') {
            const errText = (checkData.error || '').toLowerCase();
            if (errText.includes('face') || errText.includes('detect')) throw { type: 'USER_ERROR' };
            throw { type: 'MELTDOWN' };
        }
      }
    } catch (err: any) {
      console.error("Swap Error:", err);
      setIsLoading(false);
      let modal = {
          title: "🍪 The elves are on a cookie break!",
          message: "Please come back in 10 minutes!",
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
        supabase.rpc('increment_shares', { row_device_id: deviceId }).then(() => {});
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

  if (isLocked) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm w-full">
                <h1 className="text-4xl mb-4">🚧</h1>
                <input type="password" placeholder="Password" className="w-full p-4 border-2 border-gray-200 rounded-xl mb-4 text-center text-xl" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
                <button onClick={handleUnlock} className="w-full bg-pink-500 text-white py-4 rounded-xl font-bold text-xl hover:bg-pink-600">Unlock</button>
            </div>
        </div>
      );
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-b from-pink-50 to-white relative pb-20">
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
        {userEmail ? (
            <span className="text-xs font-medium text-teal-800 bg-white/80 px-3 py-1 rounded-full border border-teal-100">👤 {userEmail.split('@')[0]}</span>
        ) : (
            <a href="/login" className="text-sm font-bold text-teal-700 underline decoration-pink-300">Log In</a>
        )}
      </div>

      <div className="max-w-md mx-auto pt-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-2 text-teal-900 tracking-tight">Make Christmas Magic! 🎄✨</h1>
        
        {hasChristmasPass && (
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full font-bold text-center mb-6 border-2 border-yellow-300 animate-bounce">✨ Christmas VIP Pass Active</div>
        )}

        {!hasChristmasPass && (
            <div className="w-full text-center py-4 mb-2 min-h-[60px] flex items-center justify-center">
                {isInitializing ? (
                    <span className="text-gray-400 text-sm font-bold flex items-center gap-2"><span className="animate-spin">⏳</span> Connecting...</span>
                ) : credits > 0 ? (
                    <span className="bg-blue-100 text-blue-800 text-lg font-bold px-6 py-2 rounded-full shadow-sm">🍪 {credits} Cookies Left</span>
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
                <div className={`w-full h-48 rounded-3xl shadow-xl flex flex-col items-center justify-center overflow-hidden border-4 ${selectedFile ? 'border-teal-400' : 'border-gray-100'}`}>
                    {selectedFile ? <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" /> : <span className="text-2xl">📸 Pick a Photo</span>}
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
              
              {/* RETENTION WARNING (ESCAPED) */}
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
             <button onClick={() => setShowPaywall(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full">✕</button>
             <div className="text-center mb-6"><div className="text-5xl mb-2">🎄</div><h3 className="text-2xl font-black">Woah! You loved that one?</h3><p className="text-gray-500">Choose a pass to keep going!</p></div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a href={`https://mygigglegram.lemonsqueezy.com/buy/adf30529-5df7-4758-8d10-6194e30b54c7?checkout[custom][device_id]=${deviceId}`} className="border-2 border-gray-200 rounded-2xl p-4 active:border-rose-500 active:scale-95 transition-all bg-white text-center block">
                    <h4 className="font-bold">🍪 10 Magic Videos</h4><div className="text-3xl font-black mt-2">$4.99</div><div className="mt-4 bg-rose-500 text-white font-bold py-3 rounded-xl">Get 10 Videos</div>
                </a>
                <a href={`https://mygigglegram.lemonsqueezy.com/buy/675e173b-4d24-4ef7-94ac-2e16979f6615?checkout[custom][device_id]=${deviceId}`} className="border-4 border-yellow-400 rounded-2xl p-4 active:scale-95 transition-all relative text-center block">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-xs font-black px-3 py-1 rounded-full">BEST VALUE</div>
                    <h4 className="font-black text-emerald-900">🎅 Super Grandma Pass</h4><div className="text-4xl font-black mt-2">$29.99</div><div className="mt-4 bg-[#25D366] text-white font-black py-3 rounded-xl animate-pulse">Get Unlimited Magic</div>
                </a>
             </div>
             <div className="mt-6 text-center text-xs text-gray-400"><a href="/login" className="underline text-teal-600">Restore Purchase</a><br/>One-time payment. No subscription.</div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-black/90 text-green-400 text-[10px] font-mono p-2 text-center z-50">STATUS: {debugStatus} | ID: {deviceId?.slice(0,8)}...</div>
    </main>
  );
}