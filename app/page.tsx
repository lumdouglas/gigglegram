'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid'; 

// 🎅 NANA'S OFFICIAL WAITING ROOM SCRIPT (5s Rotation)
const LOADING_MESSAGES = [
  "Santa is baking your cookies... 🍪",             // 0s-5s
  "The Elves are polishing the camera lens... 🧝",  // 5s-10s
  "Finding your grandbaby's best smile... 👶",      // 10s-15s
  "Adding a sprinkle of North Pole magic... ✨",    // 15s-20s
  "Rudolph is warming up the sleigh... 🦌",         // 20s-25s
  "Almost there! Don't close your phone... ❤️",     // 25s-30s
  "Wrapping it up with a big red bow... 🎀",        // 30s-35s
  "Here it comes!! 🎄"                              // 35s+
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
  const [credits, setCredits] = useState(0);
  const [freeUsed, setFreeUsed] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // 1. IDENTITY & CREDIT CHECK (On Load)
  useEffect(() => {
    const initUser = async () => {
      let id = localStorage.getItem('giggle_device_id');
      if (!id) {
        id = uuidv4();
        localStorage.setItem('giggle_device_id', id!);
      }
      setDeviceId(id);

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('device_id', id)
        .single();

      if (data) {
        setCredits(data.credits_remaining);
        setFreeUsed(data.free_swap_used);
      } else {
        await supabase.from('users').insert([{ device_id: id }]);
      }
    };
    initUser();
  }, []);

  // 2. THE SANTA WAITING ROOM (5s Interval)
  useEffect(() => {
    if (!isLoading) return;
    
    let msgIndex = 0;
    setLoadingMessage(LOADING_MESSAGES[0]); 

    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1);
      // Loop back to start if it takes longer than 40s (8 messages * 5s)
      if (msgIndex < LOADING_MESSAGES.length) {
          setLoadingMessage(LOADING_MESSAGES[msgIndex]);
      } else {
          setLoadingMessage(LOADING_MESSAGES[0]); // Loop back to "Santa is baking..."
      }
    }, 5000); // 5 Seconds per message

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

    // 🛑 PAYWALL GUARD
    if (freeUsed && credits <= 0) {
        setShowPaywall(true); 
        return; 
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Upload
      const filename = `${Date.now()}-${selectedFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-uploads').upload(filename, selectedFile);
      if (uploadError) throw new Error(uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads').getPublicUrl(filename);
      
      const targetVideoUrl = "https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/baby_ceo.mp4";

      // 2. Start Job
      const startRes = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceImage: publicUrl, targetVideo: targetVideoUrl }),
      });
      const startData = await startRes.json();
      
      if (!startData.success) throw new Error(startData.error || 'Failed to start magic');
      const predictionId = startData.id;

      // 3. Poll Status
      while (true) {
        await new Promise(r => setTimeout(r, 3000));
        const checkRes = await fetch(`/api/swap?id=${predictionId}`);
        const checkData = await checkRes.json();

        if (checkData.status === 'succeeded') {
            // Deduct Credit / Mark Free Used
            setFreeUsed(true);
            if (credits > 0) setCredits(prev => prev - 1);

            await supabase.from('users')
                .update({ free_swap_used: true, credits_remaining: credits > 0 ? credits - 1 : 0 })
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
      <div className="max-w-md mx-auto">
        <h1 className="text-5xl font-bold text-center mb-2 text-teal-700">My Grandbaby Runs The World! ❤️</h1>
        <p className="text-center text-gray-600 mb-8 text-lg">The favorite grandbaby magic, just for you ✨</p>

        {/* CREDIT COUNTER */}
        {credits > 0 && (
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full font-bold text-center mb-4 border-2 border-yellow-300">
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
            <p className="text-gray-600 mb-6">
              Unlock <span className="font-bold text-pink-600">10 more magical videos</span> for just $4.99!
              <br/>(That's less than a cup of cocoa! ☕️)
            </p>
            
            <a 
              href={`https://mygigglegram.lemonsqueezy.com/buy/adf30529-5df7-4758-8d10-6194e30b54c7?checkout[custom][device_id]=${deviceId}`}
              className="block w-full bg-[#FF4F82] hover:bg-[#E03E6E] text-white py-4 rounded-xl text-xl font-bold mb-3"
            >
              Get 10 Credits ($4.99) ✨
            </a>
            
            <button 
              onClick={() => setShowPaywall(false)}
              className="text-gray-400 text-sm hover:text-gray-600 underline"
            >
              Maybe later (Santa is watching...)
            </button>
          </div>
        </div>
      )}
    </main>
  );
}