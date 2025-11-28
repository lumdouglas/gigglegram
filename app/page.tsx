'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// CRITICAL UX: The "Santa Waiting Room" text rotation
const LOADING_MESSAGES = [
  "Santa is mixing ingredients... 🍪",       // 0s
  "Elves are polishing the camera lens... 📸",// 6s
  "Adding Christmas sparkles... ✨",         // 12s
  "Checking the Naughty List... 📜",         // 18s
  "Almost ready! Wrapping it up... 🎁",      // 24s
  "Just a few more seconds... ❄️"              // 30s+
];

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]); 
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. THE SANTA WAITING ROOM (TypeScript Safe Version)
  useEffect(() => {
    // FIX: Early return. If we are NOT loading, stop here.
    // This prevents us from ever trying to clear an undefined timer.
    if (!isLoading) return;

    let msgIndex = 0;
    setLoadingMessage(LOADING_MESSAGES[0]); 

    // Create the timer locally (const) so it is never undefined
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1);
      if (msgIndex < LOADING_MESSAGES.length) {
          setLoadingMessage(LOADING_MESSAGES[msgIndex]);
      } else {
          setLoadingMessage(LOADING_MESSAGES[LOADING_MESSAGES.length - 1]);
      }
    }, 6000); 

    // Cleanup: This only runs when the component unmounts or isLoading changes
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
      // 1. Upload to Supabase Storage
      const filename = `${Date.now()}-${selectedFile.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filename, selectedFile);

      if (uploadError) throw new Error('Upload failed: ' + uploadError.message);

      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filename);
      
      // CRITICAL: Template must be hardcoded here until Template Selection UI is built.
      // Use the Baby CEO template as the default
      const targetVideoUrl = "https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/baby_ceo.mp4";

      // 2. Call the Hollywood API (xrunda/hello)
      const response = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sourceImage: publicUrl,
          targetVideo: targetVideoUrl 
        }),
      });

      const data = await response.json();
      
      setIsLoading(false);

      if (data.success) {
        setResultVideoUrl(data.output);
      } else {
        setError(data.error || 'The magic fizzled out! Try again. ✨');
      }
    } catch (err: any) {
      console.error("Unhandled Swap Error:", err);
      setIsLoading(false);
      setError('Connection error: The North Pole server may be down. 🎅');
    }
  };

  const buttonStyle = "w-full bg-pink-500 hover:bg-pink-600 text-white py-4 rounded-xl text-2xl font-bold transition-colors min-h-[70px] disabled:bg-gray-300 disabled:cursor-not-allowed";

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-b from-pink-50 to-teal-50"> 
      <div className="max-w-md mx-auto">
        <h1 className="text-5xl font-bold text-center mb-2 text-teal-700">
          My Grandbaby Runs The World! ❤️
        </h1>

        <p className="text-center text-gray-600 mb-8 text-lg">
          The favorite grandbaby magic, just for you ✨
        </p>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          {/* File Upload */}
          <label className="block mb-4">
            <span className="text-2xl font-bold mb-2 block text-gold-700">
              📸 Pick a Photo 👶
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="w-full text-lg p-3 border-2 border-gray-300 rounded-lg"
            />
          </label>

          {/* Preview selected file */}
          {selectedFile && (
            <div className="mb-4">
              <img 
                src={URL.createObjectURL(selectedFile)} 
                alt="Preview"
                className="w-full rounded-lg max-h-64 object-cover"
              />
            </div>
          )}

          {/* Action Button: Rotating "Santa" Logic */}
          <button
            onClick={handleSwap}
            disabled={!selectedFile || isLoading}
            className={buttonStyle}
          >
             {isLoading ? (
                // Displays the rotating message
                <span className="flex items-center justify-center gap-2 animate-pulse">
                  {loadingMessage}
                </span>
              ) : (
                '✨ Make the Magic'
              )}
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-100 border-2 border-red-300 rounded-lg">
              <p className="text-red-700 text-lg">❌ {error}</p>
            </div>
          )}

          {/* Result Section (Viral Loop) */}
          {resultVideoUrl && (
            <div className="mt-6">
              <h2 className="text-2xl font-bold mb-3">🎉 Look what your grandbaby made!</h2>
              
              {/* FINAL ASSET: CACHE BUSTER + MOBILE COMPATIBILITY FIX */}
              <div className="relative rounded-lg shadow-lg overflow-hidden">
                <video 
                  src={`${resultVideoUrl}?t=${Date.now()}`}
                  controls 
                  autoPlay 
                  loop 
                  playsInline 
                  muted 
                  className="w-full"
                >
                    Your browser does not support the video tag.
                </video>
              </div>
              
              {/* Tap 3: Send to Family Group */}
              <a 
                href={`https://wa.me/?text=${encodeURIComponent("Look what I made 😂\nMyGiggleGram.com - you have to try this! 🎄")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-4 w-full bg-[#25D366] hover:bg-[#20BA5A] text-white py-4 rounded-xl text-2xl font-bold text-center min-h-[70px]"
              >
                Send to Family Group 🎄❤️
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}