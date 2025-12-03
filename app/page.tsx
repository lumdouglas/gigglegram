'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid'; 
import FingerprintJS from '@fingerprintjs/fingerprintjs';

// 🎬 THE CONTENT LIBRARY
const TEMPLATES = [
  { 
    id: 'baby_ceo', 
    name: 'Baby CEO', 
    emoji: '💼', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/baby_ceo.mp4',
    badge: '🔥 POPULAR' 
  },
  { 
    id: 'cookie_thief', 
    name: 'Cookie Thief', 
    emoji: '🍪', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/cookie_thief.mp4', 
    badge: '🆕 NEW' 
  },
  { 
    id: 'snowball', 
    name: 'Snowball Sniper', 
    emoji: '❄️', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/snowball_sniper.mp4',
    badge: '🎄 FESTIVE' 
  },
  { 
    id: 'disco', 
    name: 'Disco Baby', 
    emoji: '🕺', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/disco_baby.mp4',
    badge: '' 
  },
  { 
    id: 'royal_wave', 
    name: 'Royal Wave', 
    emoji: '👑', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/royal_wave.mp4',
    badge: '' 
  },
  { 
    id: 'bodybuilder', 
    name: 'Tiny Muscle', 
    emoji: '💪', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/tiny_bodybuilder.mp4',
    badge: '' 
  }
];

// 🎅 THE GIGGLE LOOP
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
  const [isLocked, setIsLocked] = useState(true);
  const [passwordInput, setPasswordInput] = useState('');

  // 0. CHECK PASSWORD
  useEffect(() => {
    const isUnlocked = localStorage.getItem('site_unlocked');
    if (isUnlocked === 'true') setIsLocked(false);
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
        // Fallback safety, though UI should prevent this
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
          
          {/* 🎬 2. The "Gold Border" Template Selector */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {TEMPLATES.map((t) => (
                <button
                key={t.id}
                onClick={() => setSelectedTemplate(t)}
                className={`relative rounded-xl overflow-hidden aspect-square transition-all duration-200 flex flex-col items-center justify-center bg-gray-50 ${
                    selectedTemplate.id === t.id
                    ? 'border-4 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] scale-105 z-10' 
                    : 'border-2 border-transparent shadow-sm hover:scale-105 opacity-90'
                }`}
                >
                <span className="text-4xl mb-1">{t.emoji}</span>
                <span className="text-[10px] sm:text-xs font-bold text-gray-600 px-1 text-center leading-tight">
                    {t.name}
                </span>
                
                {/* Checkmark Badge for Active State */}
                {selectedTemplate.id === t.id && (
                    <div className="absolute top-1 right-1 bg-yellow-400 text-white rounded-full p-1 shadow-sm">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                )}
                </button>
            ))}
          </div>

          {/* 3. The "Magic Mirror" Upload Button */}
          <p className="text-center text-gray-600 mb-3 text-lg">
            For the best magic, pick a photo of <span className="font-bold text-pink-500">JUST one face! ✨</span>
          </p>

          <label className="block w-full cursor-pointer relative group">
            <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />
            <div className={`w-full h-40 rounded-2xl bg-white shadow-inner transition-all flex flex-col items-center justify-center overflow-hidden
                ${selectedFile 
                ? 'border-4 border-teal-400 ring-4 ring-teal-50' 
                : 'border-2 border-dashed border-pink-200 group-hover:border-pink-400 group-hover:bg-pink-50'
                }`}
            >
                {selectedFile ? (
                <div className="relative w-full h-full">
                    <img 
                    src={URL.createObjectURL(selectedFile)} 
                    className="w-full h-full object-cover opacity-80" 
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <span className="bg-white px-4 py-2 rounded-full font-bold text-teal-700 shadow-lg flex items-center gap-2">
                        ✅ Photo Ready!
                    </span>
                    </div>
                </div>
                ) : (
                <>
                    <span className="text-5xl mb-2 group-hover:scale-110 transition-transform duration-200">📸</span>
                    <span className="text-xl font-bold text-gray-400 group-hover:text-pink-500">Tap to Upload</span>
                </>
                )}
            </div>
          </label>

          {/* 4. The "Pulse" Magic Button */}
          <button
            onClick={handleSwap}
            disabled={!selectedFile || isLoading}
            className={`w-full mt-6 py-5 rounded-2xl text-2xl font-black text-white shadow-xl transition-all duration-300 transform
                ${selectedFile && !isLoading
                ? 'bg-pink-500 hover:bg-pink-400 hover:scale-[1.02] animate-pulse cursor-pointer shadow-pink-500/40' // Ready State
                : 'bg-teal-500 opacity-50 cursor-not-allowed grayscale' // Waiting State
                }`}
            >
            {isLoading ? (
                <span className="flex items-center justify-center gap-3 text-lg sm:text-xl">
                <span className="animate-spin text-2xl">⏳</span>
                {loadingMessage}
                </span>
            ) : (
                '✨ Make the Magic'
            )}
          </button>

          {/* ERROR DISPLAY */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-center gap-3 animate-shake">
              <span className="text-2xl">🧐</span>
              <p className="text-red-700 font-medium leading-tight">{error}</p>
            </div>
          )}

          {/* RESULT DISPLAY */}
          {resultVideoUrl && (
            <div className="mt-8 pt-8 border-t-2 border-dashed border-gray-100">
              <h2 className="text-2xl font-black text-center mb-4 text-teal-800">🎉 Look what your grandbaby made!</h2>
              <div className="relative rounded-2xl shadow-2xl overflow-hidden border-4 border-white ring-4 ring-pink-100">
                <video src={`${resultVideoUrl}?t=${Date.now()}`} controls autoPlay loop playsInline muted className="w-full" />
              </div>
              <button 
                onClick={handleSmartShare} 
                disabled={isSharing} 
                className="block mt-6 w-full bg-[#25D366] hover:bg-[#20BA5A] text-white py-4 rounded-xl text-xl font-black text-center shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
              >
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