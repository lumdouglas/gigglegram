'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid'; 
import FingerprintJS from '@fingerprintjs/fingerprintjs';

// 🎬 THE CONTENT LIBRARY (Updated Filenames)
const TEMPLATES = [
  { 
    id: 'baby_ceo', 
    name: 'Baby CEO', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/1_baby_ceo.mp4',
    thumb: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/1_baby_ceo.jpg',
    badge: '🔥 POPULAR' 
  },
  { 
    id: 'cookie_thief', 
    name: 'Cookie Thief', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/2_cookie_thief.mp4', 
    thumb: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/2_cookie_thief.jpg',
    badge: '🆕 NEW' 
  },
  { 
    id: 'snowball_sniper', 
    name: 'Snowball Sniper', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/3_snowball_sniper.mp4',
    thumb: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/3_snowball_sniper.jpg',
    badge: '🎄 FESTIVE' 
  },
  { 
    id: 'disco_baby', 
    name: 'Disco Baby', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/4_disco_baby.mp4',
    thumb: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/4_disco_baby.jpg',
    badge: '' 
  },
  { 
    id: 'royal_wave', 
    name: 'Royal Wave', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/5_royal_wave.mp4',
    thumb: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/5_royal_wave.jpg',
    badge: '' 
  },
  { 
    id: 'tiny_bodybuilder', 
    name: 'Tiny Muscle', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/6_tiny_bodybuilder.mp4',
    thumb: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/6_tiny_bodybuilder.jpg',
    badge: '' 
  },
  { 
    id: 'conductor', 
    name: 'The Conductor', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/7_conductor.mp4',
    thumb: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/7_conductor.jpg',
    badge: '' 
  },
  { 
    id: 'north_pole', 
    name: 'North Pole Express', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/8_north_pole_express.mp4',
    thumb: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/8_north_pole_express.jpg',
    badge: '🚂 CHOO CHOO' 
  },
  { 
    id: 'sleigh_ride', 
    name: 'Sleigh Ride', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/9_sleigh_ride.mp4',
    thumb: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/9_sleigh_ride.jpg',
    badge: '' 
  },
  { 
    id: 'kitchen_chaos', 
    name: 'Kitchen Chaos', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/10_kitchen_chaos.mp4',
    thumb: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/10_kitchen_chaos.jpg',
    badge: '' 
  },
  { 
    id: 'carolers', 
    name: 'Carolers', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/11_carolers.mp4',
    thumb: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/11_carolers.jpg',
    badge: '' 
  }
  { 
    id: 'cloud_angel', 
    name: 'Cloud Angel', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/12_cloud_angel.mp4',
    thumb: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/12_cloud_angel.jpg',
    badge: '' 
  }
];

// 🎅 THE GIGGLE LOOP (Jokes + Status)
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
  
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);

  // MONETIZATION & AUTH STATE
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [freeUsed, setFreeUsed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null); 
  
  // PASSWORD STATE
  const [isLocked, setIsLocked] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');

  // 0. CHECK PASSWORD (On Load)
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

  // 1. IDENTITY & CREDIT CHECK
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

      if (session?.user?.email) {
        setUserEmail(session.user.email);
        const { data: emailUser } = await supabase
          .from('users').select('*').eq('email', session.user.email).single();

        if (emailUser) {
            setCredits(emailUser.credits_remaining);
            setFreeUsed(emailUser.free_swap_used);
            if (emailUser.device_id !== currentId) {
                setDeviceId(emailUser.device_id); 
                localStorage.setItem('giggle_device_id', emailUser.device_id);
            }
        }
      } else {
        const { data: deviceUser } = await supabase
          .from('users').select('*').eq('device_id', currentId).single();

        if (deviceUser) {
          setCredits(deviceUser.credits_remaining);
          setFreeUsed(deviceUser.free_swap_used);
        } else {
          await supabase.from('users').insert([{ device_id: currentId }]);
        }
      }
    };
    initUser();
  }, [isLocked]);

  // 2. THE GIGGLE LOOP
  useEffect(() => {
    if (!isLoading) return;
    
    let msgIndex = 0;
    setLoadingMessage(LOADING_MESSAGES[0]); 

    const interval = setInterval(() => {
      msgIndex++;
      if (msgIndex < LOADING_MESSAGES.length) {
          setLoadingMessage(LOADING_MESSAGES[msgIndex]);
      } else {
          setLoadingMessage(LOADING_MESSAGES[LOADING_MESSAGES.length - 1]);
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

    if (freeUsed && credits <= 0) {
        setShowPaywall(true); 
        return; 
    }

    setIsLoading(true);
    setError(null);

    try {
      const filename = `${Date.now()}-${selectedFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-uploads').upload(filename, selectedFile);
      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads').getPublicUrl(filename);
      
      const targetVideoUrl = selectedTemplate.url;

      const startRes = await fetch('/api/swap', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-device-id': fingerprint || 'unknown',
            'x-user-credits': credits.toString()
        },
        body: JSON.stringify({ sourceImage: publicUrl, targetVideo: targetVideoUrl }),
      });
      
      const startData = await startRes.json();
      
      if (startRes.status === 402) {
          setIsLoading(false);
          setFreeUsed(true); 
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
            setFreeUsed(true);
            const newCredits = credits > 0 ? credits - 1 : 0;
            setCredits(newCredits);

            await supabase.from('users')
                .update({ free_swap_used: true, credits_remaining: newCredits })
                .eq('device_id', deviceId);

            // 📳 HAPTIC NOTIFICATION (Buzz the phone!)
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate([200, 100, 200]); // Buzz-pause-Buzz
            }

            setResultVideoUrl(checkData.output);
            setIsLoading(false);
            break;
        }
      }

    } catch (err: any) {
      console.error("Swap Error:", err);
      setIsLoading(false);
      const errorMsg = (err.message || '').toLowerCase();
      if (errorMsg.includes('face') || errorMsg.includes('detect')) {
          setError("Uh oh! We couldn't see a face. Try a closer photo of just one person! 🧐");
      } else {
          setError('The magic fizzled out! Try again or pick a different photo. ✨');
      }
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
        const response = await fetch(resultVideoUrl);
        const blob = await response.blob();
        const file = new File([blob], 'gigglegram.mp4', { type: 'video/mp4' });
        if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({ ...shareData, files: [file] });
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(shareData.text)}`, '_blank');
        }
    } catch (err) {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareData.text)}`, '_blank');
    } finally {
        setIsSharing(false);
    }
  };

  if (isLocked) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm w-full">
                <h1 className="text-4xl mb-4">🚧</h1>
                <input
                    type="password"
                    placeholder="Password"
                    className="w-full p-4 border-2 border-gray-200 rounded-xl mb-4 text-center text-xl"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                />
                <button onClick={handleUnlock} className="w-full bg-pink-500 text-white py-4 rounded-xl font-bold text-xl hover:bg-pink-600">Unlock</button>
            </div>
        </div>
      );
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-b from-pink-50 to-white relative"> 
      
      {/* 👤 TOP RIGHT LOGIN */}
      <div className="absolute top-4 right-4 z-10">
        {userEmail ? (
            <span className="text-xs font-medium text-teal-800 bg-white/80 px-3 py-1 rounded-full border border-teal-100 backdrop-blur-sm">
                👤 {userEmail.split('@')[0]}
            </span>
        ) : (
            <a href="/login" className="text-sm font-bold text-teal-700 hover:text-teal-900 underline decoration-2 decoration-pink-300">
                Log In
            </a>
        )}
      </div>

      <div className="max-w-md mx-auto pt-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-2 text-teal-900 tracking-tight">
          My Grandbaby Runs The World!
        </h1>
        <p className="text-center text-gray-600 mb-8 text-lg font-medium">The favorite grandbaby magic, just for you ✨</p>

        {credits > 0 && (
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full font-bold text-center mb-6 border-2 border-yellow-300 animate-bounce shadow-sm">
                ✨ {credits} Magic Credits Remaining
            </div>
        )}

        <div className="bg-white rounded-3xl shadow-xl p-6 border border-pink-100">
          
          {/* 🎬 TEMPLATE SELECTOR (THUMBNAIL GRID) */}
          <div className="mb-6">
            <span className="text-xl font-bold mb-3 block text-gray-700">👇 Pick a Magic Scene</span>
            {/* Horizontal Scroll Container */}
            <div className="flex overflow-x-auto gap-3 pb-4 snap-x px-1 scrollbar-hide">
                {TEMPLATES.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setSelectedTemplate(t)}
                        // CHANGE: Adjusted width/height and added flex-shrink-0 to prevent squishing
                        className={`flex-shrink-0 w-32 h-32 sm:w-36 sm:h-36 rounded-xl overflow-hidden border-4 transition-all duration-200 relative snap-center group ${
                            selectedTemplate.id === t.id 
                            ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] scale-105 z-10' 
                            : 'border-transparent shadow-sm hover:scale-105 opacity-90'
                        }`}
                    >
                        {/* THUMBNAIL IMAGE */}
                        <img 
                            src={t.thumb} 
                            alt={t.name}
                            // CHANGE: Changed object-cover to object-contain to prevent cropping if aspect ratio mismatches
                            // OR keep object-cover but ensure the container aspect ratio matches your thumbnails (likely 1:1 or 9:16)
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />

                        {/* BADGE */}
                        {t.badge && (
                            <span className="absolute top-0 right-0 bg-yellow-400 text-red-700 text-[10px] font-black px-2 py-1 rounded-bl-lg shadow-sm z-20">
                                {t.badge}
                            </span>
                        )}
                        
                        {/* CHECKMARK OVERLAY (Active) */}
                        {selectedTemplate.id === t.id && (
                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center z-10">
                                <div className="bg-yellow-400 text-white rounded-full p-1 shadow-lg">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
                                </div>
                            </div>
                        )}

                        {/* TITLE BAR */}
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1">
                            <span className="text-[10px] font-bold text-white block text-center leading-tight truncate">
                                {t.name}
                            </span>
                        </div>
                    </button>
                ))}
            </div>
          </div>

          {/* 📸 SOLID UPLOAD BUTTON */}
          <div className="mb-8">
             <p className="text-center text-gray-500 mb-3 font-medium text-lg">
                Upload a photo of <span className="font-bold text-pink-500">JUST one face!</span> ✨
             </p>
             
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

          {/* 🛡️ TRUST BANNER */}
          <div className="flex items-center justify-start gap-1 mb-6 text-xs text-gray-400 pl-2">
            <span>🔒</span>
            <span>Photo deleted automatically.</span>
          </div>

          {/* ✨ MAGIC BUTTON */}
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
                {/* REMOVED 'muted' property. Added 'playsInline'. */}
                <video 
                    src={`${resultVideoUrl}?t=${Date.now()}`} 
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

      {showPaywall && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-bounce-in border-4 border-pink-200">
            <div className="text-6xl mb-4">🎄</div>
            <h3 className="text-2xl font-black text-gray-800 mb-2">Woah! You loved that one?</h3>
            <p className="text-gray-600 mb-8 font-medium">
              Unlock <span className="font-bold text-pink-600 bg-pink-50 px-2 py-1 rounded-lg">10 more magical videos</span> for just $4.99!
              <br/><span className="text-sm text-gray-400 mt-2 block">(That's less than a cup of cocoa! ☕️)</span>
            </p>
            
            <a 
              href={`https://mygigglegram.lemonsqueezy.com/buy/adf30529-5df7-4758-8d10-6194e30b54c7?checkout[custom][device_id]=${deviceId}`}
              className="block w-full bg-[#FF4F82] hover:bg-[#E03E6E] text-white py-4 rounded-2xl text-xl font-black mb-4 shadow-lg shadow-pink-200 transform transition-transform hover:scale-105"
            >
              Get 10 Credits ($4.99) ✨
            </a>
            
            <div className="border-t border-gray-100 pt-4">
                <p className="text-gray-400 text-sm mb-1">Already have credits?</p>
                <a href="/login" className="text-teal-600 font-bold underline hover:text-teal-800">Log in to restore them</a>
            </div>
            
            <button 
              onClick={() => setShowPaywall(false)}
              className="block mt-6 text-gray-400 text-sm hover:text-gray-600 underline mx-auto"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </main>
  );
}