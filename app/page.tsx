'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid'; 
import FingerprintJS from '@fingerprintjs/fingerprintjs';

// 🎬 THE CONTENT LIBRARY (Audio Enabled 🔊)
const TEMPLATES = [
  { 
    id: 'baby_ceo', 
    name: 'Baby CEO 💼', 
    emoji: '💼', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/baby_ceo.mp4',
    badge: '🔥 POPULAR' 
  },
  { 
    id: 'cookie_thief', 
    name: 'Cookie Thief 🍪', 
    emoji: '🍪', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/cookie_thief.mp4', 
    badge: '🆕 NEW' 
  },
  { 
    id: 'snowball', 
    name: 'Snowball Sniper ❄️', 
    emoji: '❄️', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/snowball_sniper.mp4',
    badge: '🎄 FESTIVE' 
  },
  { 
    id: 'disco', 
    name: 'Disco Baby 🕺', 
    emoji: '🕺', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/disco_baby.mp4',
    badge: '' 
  },
  { 
    id: 'royal_wave', 
    name: 'Royal Wave 👑', 
    emoji: '👑', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/royal_wave.mp4',
    badge: '' 
  },
  { 
    id: 'bodybuilder', 
    name: 'Tiny Muscle 💪', 
    emoji: '💪', 
    url: 'https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/tiny_bodybuilder.mp4',
    badge: '' 
  }
];

const LOADING_MESSAGES = [
  "Santa is baking your cookies... 🍪",             
  "The Elves are polishing the camera lens... 🧝",  
  "Finding your grandbaby's best smile... 👶",      
  "Adding a sprinkle of North Pole magic... ✨",    
  "Rudolph is warming up the sleigh... 🦌",         
  "Almost there! Don't close your phone... ❤️",     
  "Wrapping it up with a big red bow... 🎀",        
  "Here it comes!! 🎄"                              
];

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]); 
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);

  // MONETIZATION STATE
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [freeUsed, setFreeUsed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null); 

  // 🔒 PASSWORD PROTECTION STATE
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
    // Only run if unlocked
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
  }, [isLocked]); // Run when unlocked

  // 2. SANTA WAITING ROOM
  useEffect(() => {
    if (!isLoading) return;
    let msgIndex = 0;
    setLoadingMessage(LOADING_MESSAGES[0]); 
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1);
      if (msgIndex < LOADING_MESSAGES.length) {
          setLoadingMessage(LOADING_MESSAGES[msgIndex]);
      } else {
          setLoadingMessage(LOADING_MESSAGES[0]);
      }
    }, 5000); 
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
        setError("Please pick a photo first, grandbaby! 👶");
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
      setError('Connection error: The North Pole server may be down. 🎅 ' + (err.message || ''));
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

  const getButtonStyle = () => {
    const base = "w-full py-4 rounded-xl text-2xl font-bold transition-all min-h-[70px] ";
    if (isLoading) return base + "bg-pink-600 text-white cursor-wait animate-pulse shadow-inner";
    if (!selectedFile) return base + "bg-gray-300 text-gray-500 cursor-not-allowed";
    return base + "bg-pink-500 hover:bg-pink-600 text-white shadow-lg transform hover:scale-[1.02]";
  };

  // 🔒 LOCK SCREEN RENDER
  if (isLocked) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm w-full">
                <h1 className="text-4xl mb-4">🚧</h1>
                <h2 className="text-xl font-bold mb-4 text-gray-700">Site Locked</h2>
                <p className="text-gray-500 mb-6">Testing in progress. Enter password.</p>
                
                <input
                    type="password"
                    placeholder="Password"
                    className="w-full p-4 border-2 border-gray-200 rounded-xl mb-4 text-center text-xl"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                />
                
                <button
                    onClick={handleUnlock}
                    className="w-full bg-pink-500 text-white py-4 rounded-xl font-bold text-xl hover:bg-pink-600 transition-colors"
                >
                    Unlock
                </button>
            </div>
        </div>
      );
  }

  // 🟢 MAIN APP RENDER
  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-b from-pink-50 to-teal-50 relative"> 
      
      {/* 👤 TOP RIGHT LOGIN / ACCOUNT */}
      <div className="absolute top-4 right-4 z-10">
        {userEmail ? (
            <span className="text-xs font-medium text-teal-800 bg-white/50 px-3 py-1 rounded-full border border-teal-100">
                👤 {userEmail.split('@')[0]}
            </span>
        ) : (
            <a href="/login" className="text-sm font-bold text-teal-700 hover:text-teal-900 underline decoration-2 decoration-pink-300">
                Log In
            </a>
        )}
      </div>

      <div className="max-w-md mx-auto pt-8">
        <h1 className="text-5xl font-bold text-center mb-2 text-teal-700">My Grandbaby Runs The World! ❤️</h1>
        <p className="text-center text-gray-600 mb-8 text-lg">The favorite grandbaby magic, just for you ✨</p>

        {credits > 0 && (
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full font-bold text-center mb-4 border-2 border-yellow-300 animate-pulse">
                ✨ {credits} Magic Credits Remaining
            </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-6">
          
          {/* 🎬 TEMPLATE SELECTOR */}
          <div className="mb-6">
            <span className="text-xl font-bold mb-3 block text-gray-700">👇 Pick a Magic Scene</span>
            <div className="flex overflow-x-auto gap-4 pb-4 snap-x">
                {TEMPLATES.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setSelectedTemplate(t)}
                        className={`flex-shrink-0 w-32 h-32 rounded-2xl border-4 transition-all relative snap-center ${
                            selectedTemplate.id === t.id 
                            ? 'border-pink-500 bg-pink-50 scale-105 shadow-md' 
                            : 'border-gray-200 bg-gray-50 hover:border-pink-200'
                        }`}
                    >
                        {t.badge && (
                            <span className="absolute -top-3 -right-2 bg-yellow-400 text-red-700 text-xs font-bold px-2 py-1 rounded-full shadow-sm z-10 transform rotate-12">
                                {t.badge}
                            </span>
                        )}
                        <div className="flex flex-col items-center justify-center h-full">
                            <span className="text-4xl mb-1">{t.emoji}</span>
                            <span className="text-xs font-bold text-gray-600 px-1 text-center leading-tight">
                                {t.name}
                            </span>
                        </div>
                    </button>
                ))}
            </div>
          </div>

          <label className="block mb-2">
            <span className="text-2xl font-bold mb-2 block text-gold-700">📸 Pick a Photo 👶</span>
            <input type="file" accept="image/*" onChange={handleFileSelect} className="w-full text-lg p-3 border-2 border-gray-300 rounded-lg" />
          </label