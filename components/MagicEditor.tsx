'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// ROTATING MESSAGES: Critical for retention during the ~40s wait
const WAITING_MESSAGES = [
  "🎅 Santa is checking the list...",
  "🍪 Baking the pixels...",
  "🦌 Feeding the reindeer...",
  "✨ Sprinkling magic dust...",
  "🎁 Wrapping the video...",
  "🛷 Polishing the sleigh...",
  "❄️ Catching snowflakes..."
];

export default function MagicEditor({ templateId, userId }: { templateId: string, userId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
  const [resultVideoUrl, setResultVideoUrl] = useState('');
  const [messageIndex, setMessageIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. ROTATING TEXT EFFECT
  useEffect(() => {
    if (status === 'processing') {
      const interval = setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % WAITING_MESSAGES.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [status]);

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    setErrorMsg('');

    try {
      // 2. UPLOAD PHOTO DIRECTLY TO SUPABASE STORAGE
      // We use the client-side key here for a direct upload, bypassing our server to save bandwidth
      const filename = `${userId}-${Date.now()}.jpg`;
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error: uploadError } = await supabase.storage
        .from('uploads') // Ensure this bucket exists in Supabase and is set to Public
        .upload(filename, file);

      if (uploadError) throw uploadError;

      // 3. START THE MAGIC (Trigger AI)
      setStatus('processing');
      
      const startRes = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, imageKey: filename }),
      });

      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || 'Failed to start magic');

      const predictionId = startData.predictionId;

      // 4. POLL FOR RESULTS (The "Are we there yet?" Loop)
      const pollInterval = setInterval(async () => {
        const checkRes = await fetch(`/api/swap?id=${predictionId}`);
        const checkData = await checkRes.json();

        if (checkData.status === 'succeeded') {
          clearInterval(pollInterval);
          setResultVideoUrl(checkData.output);
          setStatus('complete');
        } else if (checkData.status === 'failed' || checkData.status === 'canceled') {
          clearInterval(pollInterval);
          throw new Error('The magic spell failed. Please try a different photo.');
        }
        // If status is 'starting' or 'processing', the loop continues automatically
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong.');
    }
  };

  // --- RENDER UI ---

  // STATE: WAITING ROOM
  if (status === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-emerald-50 rounded-2xl p-8 text-center animate-pulse">
        <div className="text-6xl mb-6">⏳</div>
        <h3 className="text-2xl font-bold text-emerald-800 mb-2">Making Magic...</h3>
        <p className="text-xl text-emerald-600 font-medium h-8 transition-all duration-500">
          {WAITING_MESSAGES[messageIndex]}
        </p>
        <p className="text-sm text-gray-400 mt-8">Do not close this tab. It takes about 40 seconds!</p>
      </div>
    );
  }

  // STATE: SUCCESS
  if (status === 'complete' && resultVideoUrl) {
    return (
      <div className="flex flex-col items-center gap-4 bg-black rounded-2xl overflow-hidden p-4">
        {/* AutoPlay is crucial for the "Magic" effect */}
        <video src={resultVideoUrl} controls autoPlay loop className="w-full max-w-md mx-auto aspect-square rounded-lg" />
        <div className="w-full text-center">
          <p className="text-white mb-4">✨ It worked! Send it to the family.</p>
          <a 
            href={`whatsapp://send?text=Look at this! ${resultVideoUrl}`}
            className="inline-block bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg transition-transform hover:scale-105"
          >
            Share on WhatsApp 🎄
          </a>
        </div>
        <button onClick={() => window.location.reload()} className="text-gray-400 text-sm mt-4 underline">
          Make another one
        </button>
      </div>
    );
  }

  // STATE: ERROR
  if (status === 'error') {
    return (
      <div className="p-6 bg-red-50 rounded-xl text-center border border-red-100">
        <p className="text-red-600 mb-4 font-bold">Oh no! {errorMsg}</p>
        <button onClick={() => setStatus('idle')} className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700">Try Again</button>
      </div>
    );
  }

  // STATE: INPUT (Default)
  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="w-full h-64 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center bg-gray-50 hover:bg-emerald-50 transition-colors cursor-pointer relative overflow-hidden group">
        <input 
          type="file" 
          accept="image/*" 
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        {file ? (
          <img src={URL.createObjectURL(file)} className="h-full object-contain p-2" alt="Preview" />
        ) : (
          <div className="text-center group-hover:scale-105 transition-transform">
            <span className="text-4xl mb-2 block">📸</span>
            <span className="text-gray-500 font-medium">Tap to Pick a Photo</span>
          </div>
        )}
      </div>

      <button 
        onClick={handleUpload}
        disabled={!file}
        className={`w-full py-4 rounded-xl text-xl font-bold shadow-lg transition-all ${
          file 
            ? 'bg-emerald-600 text-white hover:bg-emerald-700 transform active:scale-95' 
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        }`}
      >
        {file ? '✨ Make the Magic ✨' : 'Pick a Photo First'}
      </button>
    </div>
  );
}