'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resultGif, setResultGif] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSwap = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);

    try {
      // 1. Upload to Supabase Storage
      const filename = `${Date.now()}-${selectedFile.name}`;
      console.log('📤 Uploading:', filename);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filename, selectedFile);

      if (uploadError) {
        console.error('❌ Upload error:', uploadError);
        throw new Error('Upload failed: ' + uploadError.message);
      }

      console.log('✅ Upload success:', uploadData);

      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filename);

      // 3. Call swap API with URL
      const response = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceImage: publicUrl }),
      });

      const data = await response.json();
      setIsLoading(false);

      if (data.success) {
        setResultGif(data.output);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Network error. Try again!');
    }
  };

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-b from-red-50 to-green-50">
      <div className="max-w-md mx-auto">
        <h1 className="text-5xl font-bold text-center mb-2">
          🎄 GiggleGram
        </h1>

        <p className="text-center text-gray-600 mb-8 text-lg">
          Swap faces, spread joy! ✨
        </p>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          {/* File Upload */}
          <label className="block mb-4">
            <span className="text-lg font-semibold mb-2 block">
              📸 Pick a Photo
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

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={!selectedFile || isLoading}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl text-2xl font-bold disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '🎭 Swapping Faces...' : '✨ Swap My Face!'}
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-100 border-2 border-red-300 rounded-lg">
              <p className="text-red-700 text-lg">❌ {error}</p>
            </div>
          )}

          {/* Result GIF */}
          {resultGif && (
            <div className="mt-6">
              <h2 className="text-2xl font-bold mb-3">🎉 Your GiggleGram!</h2>
              
              {/* Video with CSS watermark overlay */}
              <div className="relative rounded-lg shadow-lg overflow-hidden">
                <img 
                  src={resultGif} 
                  alt="Result"
                  className="w-full"
                />
                
                {/* Watermark overlay */}
                <div className="absolute bottom-4 right-4 text-white text-xl font-bold opacity-60 animate-bounce">
                  GiggleGram.com ✨
                </div>
              </div>
              
              {/* Download Button */}
              <a 
                href={resultGif}
                download="gigglegram.gif"
                className="block mt-4 w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg text-xl font-bold text-center"
              >
                💾 Download
              </a>

              {/* WhatsApp Share Button */}
              <a 
                href={`https://wa.me/?text=${encodeURIComponent(`Look what I made! 😂 Tap GiggleGram.com to make yours!\n\n${resultGif}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-3 w-full bg-[#25D366] hover:bg-[#20BA5A] text-white py-3 rounded-lg text-xl font-bold text-center"
              >
                📱 Send to Family Group
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}