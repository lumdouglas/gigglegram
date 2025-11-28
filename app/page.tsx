'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid'; 
import FingerprintJS from '@fingerprintjs/fingerprintjs';

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
  
  // MONETIZATION STATE
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [freeUsed, setFreeUsed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null); 

  // 1. IDENTITY & CREDIT CHECK
  useEffect(() => {
    const initUser = async () => {
      // Fingerprint
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setFingerprint(result.visitorId);
      } catch (e) {
        console.warn("Fingerprint failed");
      }

      // Session/Credits
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
  }, []);

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
      
      const targetVideoUrl = "https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/baby_ceo.mp4";

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

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-b from-pink-50 to-teal-50 relative"> 
      
      {/* 👤 TOP RIGHT LOGIN / ACCOUNT (De-prioritized) */}
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

        {/* CREDIT COUNTER */}
        {credits > 0 && (
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full font-bold text-center mb-4 border-2 border-yellow-300 animate-pulse">
                ✨ {credits} Magic Credits Remaining
            </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <label className="block mb-4">
            <span className="text-2xl font-bold mb-2 block text-gold-700">📸 Pick a Photo 👶</span>
            <input type="file" accept="image/*" onChange={handleFileSelect} className="w-full text-lg p-3 border-2 border-gray-300 rounded-lg" />
          </label>

          {selectedFile && (
            <div className="mb-4">
              <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-full rounded-lg max-h-64 object-cover" />
            </div>
          )}

          <button onClick={handleSwap} disabled={!selectedFile || isLoading} className={getButtonStyle()}>
             {isLoading ? <span className="flex items-center justify-center gap-2">⏳ {loadingMessage}</span> : '✨ Make the Magic'}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-100 border-2 border-red-300 rounded-lg">
              <p className="text-red-700 text-lg">❌ {error}</p>
            </div>
          )}

          {resultVideoUrl && (
            <div className="mt-6">
              <h2 className="text-2xl font-bold mb-3">🎉 Look what your grandbaby made!</h2>
              <div className="relative rounded-lg shadow-lg overflow-hidden">
                <video src={`${resultVideoUrl}?t=${Date.now()}`} controls autoPlay loop playsInline muted className="w-full" />
              </div>
              <button onClick={handleSmartShare} disabled={isSharing} className="block mt-4 w-full bg-[#25D366] hover:bg-[#20BA5A] text-white py-4 rounded-xl text-2xl font-bold text-center min-h-[70px] shadow-lg flex items-center justify-center gap-2">
                {isSharing ? 'Preparing...' : 'Send to Family Group 🎄❤️'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 💰 PAYWALL MODAL */}
      {showPaywall && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl animate-bounce-in">
            <div className="text-5xl mb-4">🎄</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Woah! You loved that one?</h3>
            <p className="text-gray-600 mb-6">Unlock <span className="font-bold text-pink-600">10 more magical videos</span> for just $4.99!<br/>(That's less than a cup of cocoa! ☕️)</p>
            <a href={`https://mygigglegram.lemonsqueezy.com/buy/adf30529-5df7-4758-8d10-6194e30b54c7?checkout[custom][device_id]=${deviceId}`} className="block w-full bg-[#FF4F82] hover:bg-[#E03E6E] text-white py-4 rounded-xl text-xl font-bold mb-3">Get 10 Credits ($4.99) ✨</a>
            <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="text-gray-500 text-sm mb-2">Already have credits?</p>
                <a href="/login" className="text-teal-600 font-bold underline hover:text-teal-800">Log in to restore them</a>
            </div>
            <button onClick={() => setShowPaywall(false)} className="block mt-6 text-gray-400 text-sm hover:text-gray-600 underline mx-auto">Maybe later</button>
          </div>
        </div>
      )}
    </main>
  );
}