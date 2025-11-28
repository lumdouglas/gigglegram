'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const LOADING_MESSAGES = [
  "Santa is mixing ingredients... 🍪",       
  "Elves are polishing the camera lens... 📸",
  "Adding Christmas sparkles... ✨",         
  "Checking the Naughty List... 📜",         
  "Almost ready! Wrapping it up... 🎁",      
  "Just a few more seconds... ❄️",
  "The elves are working overtime! 🎅"
];

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]); 
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SANTA TEXT ROTATION
  useEffect(() => {
    if (!isLoading) return;
    let msgIndex = 0;
    setLoadingMessage(LOADING_MESSAGES[0]); 
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[msgIndex]);
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
        setError("Please pick a photo first, grandbaby! 👶");
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

      // 2. Start Job (POST)
      const startRes = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceImage: publicUrl, targetVideo: targetVideoUrl }),
      });
      const startData = await startRes.json();
      
      if (!startData.success) throw new Error(startData.error || 'Failed to start magic');
      const predictionId = startData.id;

      // 3. Poll Status (GET Loop)
      while (true) {
        // Wait 3 seconds
        await new Promise(r => setTimeout(r, 3000));
        
        const checkRes = await fetch(`/api/swap?id=${predictionId}`);
        const checkData = await checkRes.json();

        if (checkData.status === 'succeeded') {
            setResultVideoUrl(checkData.output);
            setIsLoading(false);
            break;
        } else if (checkData.status === 'failed') {
            throw new Error(checkData.error || 'Magic failed');
        }
        // If 'processing' or 'starting', the loop continues...
      }

    } catch (err: any) {
      console.error("Swap Error:", err);
      setIsLoading(false);
      setError('Connection error: The North Pole server may be down. 🎅 ' + (err.message || ''));
    }
  };

  // DYNAMIC BUTTON STYLING
  // If Loading: Stay PINK, pulse heavily, remove "disabled" gray look.
  // If No File: Gray out (Disabled).
  // If Ready: Standard Pink.
  const getButtonStyle = () => {
    const base = "w-full py-4 rounded-xl text-2xl font-bold transition-all min-h-[70px] ";
    
    if (isLoading) {
        // MAGIC MODE: High contrast pink + pulsing
        return base + "bg-pink-600 text-white cursor-wait animate-pulse shadow-inner";
    }
    
    if (!selectedFile) {
        // DISABLED MODE: Gray
        return base + "bg-gray-300 text-gray-500 cursor-not-allowed";
    }
    
    // READY MODE: Standard Pink
    return base + "bg-pink-500 hover:bg-pink-600 text-white shadow-lg transform hover:scale-[1.02]";
  };

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-b from-pink-50 to-teal-50"> 
      <div className="max-w-md mx-auto">
        <h1 className="text-5xl font-bold text-center mb-2 text-teal-700">My Grandbaby Runs The World! ❤️</h1>
        <p className="text-center text-gray-600 mb-8 text-lg">The favorite grandbaby magic, just for you ✨</p>

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

          <button 
            onClick={handleSwap} 
            disabled={!selectedFile || isLoading} 
            className={getButtonStyle()}
          >
             {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  {/* We keep the text white and bold on the pink background */}
                  ⏳ {loadingMessage}
                </span>
             ) : (
                '✨ Make the Magic'
             )}
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
              <a href={`https://wa.me/?text=${encodeURIComponent("Look what I made 😂\nMyGiggleGram.com - you have to try this! 🎄")}`} target="_blank" rel="noopener noreferrer" className="block mt-4 w-full bg-[#25D366] hover:bg-[#20BA5A] text-white py-4 rounded-xl text-2xl font-bold text-center min-h-[70px]">
                Send to Family Group 🎄❤️
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}