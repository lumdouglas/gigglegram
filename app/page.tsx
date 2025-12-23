'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid'; 
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import TEMPLATES from '@/config/templates.json'; 

const LOADING_MESSAGES = [
  "Connecting to the North Pole... 📡",                  
  "The elves are finding the magic dust... ✨",          
  "Santa is checking the list (twice!)... 📜",           
  "Oh my goodness, the cuteness levels are HIGH! 👶",    
  "Sprinkling extra holiday cheer... 🎄",                
  "Almost there! Wrapping it up... 🎁",                  
  "The reindeer are landing... 🦌",                      
  "HERE IT IS! ✨"                                       
];

export default function Home() {
  // --- STATE ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]); 
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); 
  const [isInitializing, setIsInitializing] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [session, setSession] = useState<any>(null);
  
  // MONETIZATION
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [hasChristmasPass, setHasChristmasPass] = useState(false); 
  const [credits, setCredits] = useState(0);
  const [purchasedPacks, setPurchasedPacks] = useState(0); 
  const [freeUsed, setFreeUsed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null); 
  const [paywallReason, setPaywallReason] = useState('pass'); 
  
  // NEW: Email Capture State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [pendingBuyUrl, setPendingBuyUrl] = useState(''); 
  const [emailInput, setEmailInput] = useState('');

  // Silent Disco Logic
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const toggleMute = () => {
    if (videoRef.current) {
      const nextState = !videoRef.current.muted;
      videoRef.current.muted = nextState;
      setIsMuted(nextState);
      if (!nextState) {
        videoRef.current.currentTime = 0;
        videoRef.current.play(); 
      }
    }
  };

  // UI
  const [errorModal, setErrorModal] = useState<any>(null);

  // --- USER SYNC LOGIC ---
  const checkUser = async (sessionUser: any = null) => {
      try {
        let currentId = localStorage.getItem('giggle_device_id');
        if (!currentId) {
            currentId = uuidv4();
            localStorage.setItem('giggle_device_id', currentId!);
        }
        setDeviceId(currentId);
        
        const localFreeUsed = localStorage.getItem('giggle_free_used');
        if (localFreeUsed === 'true') setFreeUsed(true);

        if (sessionUser?.email) {
            setUserEmail(sessionUser.email);
        } else {
            setUserEmail(null); 
        }

        let user = null;
        if (sessionUser?.email) {
            const { data: emailUser } = await supabase
                .from('magic_users')
                .select('*, purchased_packs')
                .eq('email', sessionUser.email)
                .maybeSingle();
            
            if (emailUser) {
                user = emailUser;
            } else {
                const { data: ghostUser } = await supabase
                    .from('magic_users')
                    .select('*')
                    .eq('device_id', currentId)
                    .is('email', null) 
                    .maybeSingle();

                if (ghostUser) {
                    const { data: mergedUser } = await supabase
                        .from('magic_users')
                        .update({ email: sessionUser.email })
                        .eq('id', ghostUser.id)
                        .select()
                        .single();
                    if (mergedUser) user = mergedUser;
                }
            }
        } 
        
        if (!user) {
             const { data: deviceUser } = await supabase
                .from('magic_users')
                .select('*, purchased_packs')
                .eq('device_id', currentId)
                .maybeSingle();
             user = deviceUser;
        }

        if (user) {
            if (user.email) setUserEmail(user.email);
            if (user.christmas_pass) {
                setHasChristmasPass(true);
                setFreeUsed(false); 
            } else {
                if (user.remaining_credits > 0) setCredits(user.remaining_credits);
                if (user.purchased_packs) setPurchasedPacks(user.purchased_packs);
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
                // Try Update First (Ghost Fix)
                const { data: existingRow } = await supabase
                   .from('magic_users')
                   .update({ device_id: currentId })
                   .eq('id', sessionUser.id)
                   .select()
                   .maybeSingle();

                if (!existingRow) {
                   const { error: insertError } = await supabase
                    .from('magic_users')
                    .insert([{ 
                        id: sessionUser.id,
                        device_id: currentId, 
                        remaining_credits: 1, 
                        swap_count: 0
                    }]);
                   if (!insertError) setCredits(1);
                   else setCredits(0);
                } else {
                   setCredits(1);
                }
            }
        }
      } catch (err: any) {
          console.error("Init Error:", err);
      } finally {
          setIsInitializing(false);
      }
    };

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        let activeSession = existingSession;
        if (!activeSession) {
            const { data, error } = await supabase.auth.signInAnonymously();
            if (error) throw error;
            activeSession = data.session;
        }
        setSession(activeSession);
        if (activeSession?.user) {
            await checkUser(activeSession.user);
        } else {
            setIsInitializing(false);
        }
      } catch (err) {
        console.error("Auth Init Failed:", err);
        setIsInitializing(false);
      }
    };
    initSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(session);
        checkUser(session?.user);
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
    const newId = uuidv4();
    localStorage.setItem('giggle_device_id', newId);
    setDeviceId(newId);
    setUserEmail(null);
    setCredits(0);
    setPurchasedPacks(0);
    setHasChristmasPass(false);
    window.location.reload();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorModal(null);
    }
  };

  const handleSafeBuy = (buyUrl: string) => {
    if (userEmail) {
       const finalUrl = `${buyUrl}&checkout[email]=${encodeURIComponent(userEmail)}`;
       window.open(finalUrl, '_blank');
    } else {
       setPendingBuyUrl(buyUrl);
       setShowEmailModal(true);
    }
  };

  const saveEmailAndBuy = async () => {
    if (!emailInput.includes('@')) {
        alert("Please enter a valid email address.");
        return;
    }
    if (deviceId) {
        const { error } = await supabase
            .from('magic_users')
            .update({ email: emailInput }) 
            .eq('device_id', deviceId);
    }
    const { error: authError } = await supabase.auth.signInWithOtp({
        email: emailInput,
        options: { emailRedirectTo: window.location.origin }
    });
    setUserEmail(emailInput);
    setShowEmailModal(false);
    const finalUrl = `${pendingBuyUrl}&checkout[email]=${encodeURIComponent(emailInput)}`;
    window.open(finalUrl, '_blank');
  };

  // --- MAIN SWAP LOGIC ---
  const handleSwap = async () => {
    if (!selectedFile || !session?.user) return;

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
    setLoadingMessage("Connecting to the North Pole... 📡");
    setErrorModal(null); 

    try {
      const filename = `${session.user.id}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filename, selectedFile, { upsert: true });

      if (uploadError) throw new Error("Upload failed: " + uploadError.message);

      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/uploads/${filename}`;

      const startRes = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-id': deviceId || 'unknown' },
        body: JSON.stringify({
          userId: session.user.id,
          sourceImage: publicUrl,
          targetVideo: selectedTemplate.url 
        }),
      });

      if (startRes.status === 402) {
          setIsLoading(false);
          setCredits(0);
          setFreeUsed(true);
          localStorage.setItem('giggle_free_used', 'true');
          setPaywallReason('free_limit');
          setShowPaywall(true);
          return;
      }

      if (!startRes.ok) throw new Error("Processing failed");

      const data = await startRes.json();
      
      // Smart Video Selector
      let finalUrl = "";
      if (Array.isArray(data.output)) {
          finalUrl = data.output.find((url: string) => url.endsWith('.mp4')) || data.output[0];
      } else {
          finalUrl = data.output;
      }
      
      setResultVideoUrl(finalUrl);
      
      if (!hasChristmasPass) {
          setCredits(prev => Math.max(0, prev - 1));
          setFreeUsed(true);
          localStorage.setItem('giggle_free_used', 'true');
      }

    } catch (err: any) {
      console.error("Swap failed:", err);
      // GENERIC SNOWFLAKE ERROR MODAL
      setErrorModal({
          title: "❄️ Oh no! The magic fizzled.",
          message: "The elves hit a snag while making your video. Please try again!",
          btnText: "Try Again",
          btnColor: "bg-teal-600 text-white",
          action: () => setErrorModal(null)
      });
    } finally {
      setIsLoading(false);
    }
  };

  // --- SHARE HELPERS ---
  const handleSmartShare = async () => {
    if (!resultVideoUrl) return;
    setIsSharing(true);
    try {
        if (deviceId) {
            const { data } = await supabase.from('magic_users').select('shares_count').eq('device_id', deviceId).maybeSingle();
            if (data) await supabase.from('magic_users').update({ shares_count: (data.shares_count || 0) + 1 }).eq('device_id', deviceId);
        }
        const response = await fetch(resultVideoUrl);
        const blob = await response.blob();
        const fileName = "GiggleGram_Magic.mp4"; 
        const file = new File([blob], fileName, { type: "video/mp4" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: "My GiggleGram Magic! ✨",
                text: "I made a little magic with my favorite little star! ✨🌟\n\n👇 Try it here:\nhttps://MyGiggleGram.com"
            });
        } else {
            const a = document.createElement('a');
            a.href = window.URL.createObjectURL(blob);
            a.download = fileName; 
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            alert("✨ Magic saved to your Downloads folder!");
        }
    } catch (err) {
        console.error("Share failed:", err);
        try {
            const response = await fetch(resultVideoUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "GiggleGram_Magic.mp4";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            alert("Could not share. Please try the 'Save to Photos' button!");
        }
    } finally {
        setIsSharing(false);
    }
  };

  const handleDownload = async () => {
      if (!resultVideoUrl) return;
      setSaveStatus('saving'); 
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
        setSaveStatus('saved'); 
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (err) {
        setSaveStatus('idle'); 
        alert("Saving failed. You can right-click the video to save it!");
      }
  };

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-b from-pink-50 to-white relative pb-20">
      
      {/* HEADER */}
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
          <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full font-bold text-center mb-6 border-2 border-yellow-300 animate-bounce w-fit mx-auto">
            ✨ Christmas VIP Pass Active
          </div>
        )}

        {!hasChristmasPass && (
            <div className="w-full text-center py-4 mb-2 min-h-[60px] flex items-center justify-center">
                {isInitializing ? (
                    <span className="text-gray-400 text-sm font-bold flex items-center gap-2"><span className="animate-spin">⏳</span> Connecting...</span>
                ) : credits > 0 ? (
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

        {/* TEMPLATE GRID */}
          <div className="bg-white rounded-3xl shadow-xl p-6 border border-pink-100">
            <div className="mb-6 flex overflow-x-auto gap-3 pb-4 snap-x px-1 scrollbar-hide">
              {TEMPLATES.map((t, index) => {
                  const isPremiumUser = hasChristmasPass || purchasedPacks > 0 || credits > 1;
                  const isLocked = t.isPremium && !isPremiumUser;

                  let badge = { text: "", color: "", position: "" };
                  if (isLocked) {
                       badge = { text: "🔒 LOCKED", color: "bg-black/60 text-white backdrop-blur-md", position: "top" };
                  } 
                  else if (hasChristmasPass) {
                      badge = { text: "✨ UNLIMITED", color: "bg-amber-400 text-black", position: "bottom" };
                  } 
                  else if (credits === 1 && !freeUsed && purchasedPacks === 0) {
                      if (!t.isPremium) {
                          badge = { text: "🎁 FREE", color: "bg-teal-500 text-white animate-pulse", position: "bottom" };
                      } else {
                          badge = { text: "🔒 LOCKED", color: "bg-black/60 text-white backdrop-blur-md", position: "top" };
                      }
                  } 
                  else if (credits > 0) {
                      badge = { text: "🍪 1 CREDIT", color: "bg-gray-100 text-gray-800 border-gray-200", position: "bottom" };
                  }
                  else {
                      if (!t.isPremium) {
                           badge = { text: "🎁 FREE", color: "bg-teal-500 text-white animate-pulse", position: "bottom" };
                      } else {
                           badge = { text: "🔒 LOCKED", color: "bg-black/60 text-white backdrop-blur-md", position: "top" };
                      }
                  }

                  return (
                      <button 
                          key={t.id} 
                          onClick={() => { 
                              if (isLocked) { 
                                  setPaywallReason('premium'); 
                                  setShowPaywall(true); 
                              } else { 
                                  setSelectedTemplate(t); 
                              } 
                          }} 
                          className={`
                              flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden border-4 transition-all duration-200 relative snap-center group
                              ${selectedTemplate.id === t.id ? 'border-yellow-400 scale-105 z-10' : 'border-transparent opacity-90'}
                          `}
                      >
                          <img 
                              src={t.thumb} 
                              alt={t.name} 
                              className={`w-full h-full object-cover ${isLocked ? 'grayscale opacity-80' : ''}`} 
                          />
                          {badge.text && (
                              <div className={`absolute z-20 w-max ${
                                  badge.position === 'top' ? 'top-2 right-2' : 'bottom-2 left-1/2 -translate-x-1/2'
                              }`}>
                                  <div className={`${badge.color} text-[9px] font-black px-2 py-0.5 rounded-full shadow-md border border-white/30 flex items-center gap-1`}>
                                      <span>{badge.text}</span>
                                  </div>
                              </div>
                          )}
                      </button>
                  );
              })}
            </div>

          {/* PHOTO UPLOAD */}
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

          <button 
            onClick={handleSwap} 
            disabled={!selectedFile || isLoading || isInitializing} 
            className={`w-full py-6 rounded-2xl text-2xl font-black shadow-xl transition-all ${
                (!selectedFile || isInitializing) 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : isLoading 
                        ? 'bg-pink-500 animate-pulse text-white' 
                        : 'bg-teal-600 active:scale-95 text-white hover:bg-teal-700'
            }`}
          >
             {isLoading 
                ? loadingMessage 
                : isInitializing 
                    ? 'Loading...' 
                    : !selectedFile 
                        ? 'Select a Photo First 👆' 
                        : 'Make the Magic! ✨'}
          </button>

          {/* ERROR MODAL */}
          {errorModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
                <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center">
                    <h3 className="text-xl font-bold mb-2">{errorModal.title}</h3>
                    <p className="mb-4">{errorModal.message}</p>
                    <button onClick={errorModal.action} className={`w-full py-3 rounded-xl font-bold ${errorModal.btnColor}`}>{errorModal.btnText}</button>
                </div>
            </div>
          )}

          {/* RESULT VIDEO */}
          {resultVideoUrl && (
            <div className="mt-8 pt-8 border-t-2 border-dashed border-gray-100">
              <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl aspect-square bg-black group">
                <video 
                  ref={videoRef}
                  src={`${resultVideoUrl}?t=${Date.now()}`} 
                  poster={selectedTemplate.thumb}
                  autoPlay 
                  loop 
                  muted={isMuted} 
                  playsInline 
                  onClick={toggleMute}
                  className="w-full h-full object-cover cursor-pointer" 
                />
                {isMuted && (
                  <button 
                    onClick={toggleMute}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 text-teal-900 px-6 py-3 rounded-full font-black shadow-[0_0_20px_rgba(0,0,0,0.3)] flex items-center gap-2 animate-bounce z-20 backdrop-blur-md border-4 border-teal-500 hover:scale-110 transition-transform"
                  >
                    <span className="text-2xl">🔊</span>
                    <span className="text-lg">Tap for Music!</span>
                  </button>
                )}
                <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold pointer-events-none">
                  {isMuted ? '🔇 Muted' : '🔊 Sound On'}
                </div>
              </div>

              <button onClick={handleSmartShare} disabled={isSharing} className="block mt-6 w-full h-[80px] bg-[#25D366] text-white text-xl font-black text-center shadow-xl rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform">
                🚀 {isSharing ? 'Opening...' : 'Send to Family'}
              </button>

              <button 
                onClick={handleDownload}
                disabled={saveStatus !== 'idle'}
                className={`
                  w-full py-4 rounded-xl font-bold text-lg shadow-sm border-2 transition-all mt-3
                  ${saveStatus === 'saved' 
                    ? 'bg-green-100 border-green-500 text-green-800 scale-105' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' 
                  }
                `}
              >
                {saveStatus === 'idle' && "⬇️ Save to Photos"}
                {saveStatus === 'saving' && "⏳ Saving..."}
                {saveStatus === 'saved' && "✅ Saved to Photos!"}
              </button>

              <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 text-center shadow-sm">
                <p className="text-sm text-amber-900 font-bold mb-1">⚠️ Don&apos;t lose your magic!</p>
                <p className="text-xs text-amber-800 leading-snug">To protect your privacy, we do not keep a copy.<br/><strong className="font-black">Send it to your family now to save it forever!</strong></p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PAYWALL MODAL */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative p-6">
             <button onClick={() => setShowPaywall(false)} className="absolute top-4 right-4 p-2 bg-gray-200 rounded-full">✕</button>
             <div className="text-center mb-6"><div className="text-5xl mb-2">🎄</div><h3 className="text-xl font-bold text-black text-center mb-2">Woah! You loved that one?</h3><p className="text-gray-500">Choose a pass to keep going!</p></div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                    onClick={() => handleSafeBuy(`https://mygigglegram.lemonsqueezy.com/buy/adf30529-5df7-4758-8d10-6194e30b54c7?checkout[custom][device_id]=${deviceId}`)} 
                    className="border-2 border-gray-200 rounded-2xl p-4 active:scale-95 transition-all bg-white text-center block w-full"
                >
                    <h4 className="font-bold text-lg text-gray-700">🍪 10 Magic Videos</h4>
                    <div className="font-bold text-xl text-gray-900">$4.99</div>
                    <div className="mt-4 w-full py-4 rounded-xl font-bold bg-gray-200 text-gray-900 hover:bg-gray-300 transition-all">
                        Get 10 Videos
                    </div>
                </button>
                <button 
                    onClick={() => handleSafeBuy(`https://mygigglegram.lemonsqueezy.com/buy/675e173b-4d24-4ef7-94ac-2e16979f6615?checkout[custom][device_id]=${deviceId}`)} 
                    className="border-4 border-yellow-400 rounded-2xl p-4 active:scale-95 transition-all relative text-center block w-full shadow-lg transform scale-105"
                >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">BEST VALUE</div>
                    <h4 className="font-bold text-lg text-black">🎅 Super Grandma Pass</h4>
                    <div className="font-bold text-xl text-teal-700">$29.99</div>
                    <div className="mt-4 w-full bg-teal-600 text-white font-black py-4 rounded-xl animate-pulse shadow-xl ring-4 ring-teal-100">
                        Get Unlimited Magic
                    </div>
                </button>
             </div>
             <div className="mt-6 text-center text-xs text-gray-400"><a href="/login" className="underline text-teal-600">Restore Purchase</a><br/>One-time payment. No subscription.</div>
          </div>
        </div>
      )}

      {/* EMAIL CAPTURE MODAL */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="text-center">
              <div className="text-4xl mb-4">🛡️</div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Wait! Don&apos;t lose it!</h3>
              <p className="text-slate-600 mb-6 leading-snug">
                Please enter your email so we can restore your credits if you ever lose your phone.
              </p>
              <input 
                type="email" 
                placeholder="nana@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full text-lg p-4 bg-slate-50 border-2 border-slate-200 rounded-xl mb-4 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 outline-none transition-all"
              />
              <button 
                onClick={saveEmailAndBuy}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg py-4 rounded-xl shadow-lg active:scale-95 transition-transform"
              >
                Secure & Continue to Pay ➔
              </button>
              <button 
                onClick={() => setShowEmailModal(false)}
                className="mt-4 text-slate-400 font-medium text-sm hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}