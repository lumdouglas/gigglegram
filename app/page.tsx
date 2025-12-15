'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, Zap, X, Loader2, Play, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  // --- STATE MANAGEMENT ---
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [credits, setCredits] = useState<number>(0);
  const [showPayModal, setShowPayModal] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // File input refs
  const videoInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);

  // --- 1. DEVICE ID & AUTH SETUP ---
  useEffect(() => {
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('device_id', id);
    }
    setDeviceId(id);

    // Check user session
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserEmail(user.email || null);
    };
    getUser();

    // Auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || null);
      fetchCredits(); 
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- 2. FETCH CREDITS ---
  const fetchCredits = async () => {
    let query = supabase.from('magic_users').select('credits_remaining');
    const { data: { user } } = await supabase.auth.getUser();

    // If logged in, check by email. If guest, check by device_id.
    if (user) {
      query = query.eq('email', user.email);
    } else {
      const id = localStorage.getItem('device_id');
      query = query.eq('device_id', id);
    }

    const { data } = await query.single();
    if (data) {
      setCredits(data.credits_remaining);
    } else {
      setCredits(0);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, [deviceId]);

  // --- 3. LOGOUT LOGIC ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear(); 
    window.location.reload();
  };

  // --- 4. UPLOAD LOGIC ---
  const handleUpload = async () => {
    if (credits < 1) {
      setShowPayModal(true);
      return;
    }

    if (!videoFile || !faceFile) {
      setError("Please select both a video and a face photo!");
      return;
    }

    setLoading(true);
    setError(null);
    setResultVideo(null);

    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('face', faceFile);

      const response = await fetch('/api/swap', {
        method: 'POST',
        headers: {
          'x-device-id': deviceId || 'unknown', 
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate video');
      }

      setResultVideo(data.url);
      fetchCredits();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white text-black p-4 flex flex-col items-center relative">
      
      {/* 🎅 SANTA WAITING ROOM (LOADING OVERLAY) 🎅 */}
      {loading && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center text-white animate-in fade-in duration-500">
          <div className="text-6xl mb-4 animate-bounce">🎅</div>
          <h2 className="text-3xl font-bold text-red-500 mb-2">Santa is working!</h2>
          <p className="text-gray-300 text-lg text-center max-w-md px-4">
            Creating your magic video...<br/>
            This takes about 20-30 seconds.
          </p>
          <div className="mt-8">
            <Loader2 className="w-10 h-10 animate-spin text-white" />
          </div>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="flex justify-between items-center w-full max-w-xl mb-8 mt-4">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
          GiggleGram
        </h1>
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-gray-500 hover:text-black hover:underline transition-colors"
        >
          Logout
        </button>
      </div>

      {/* CREDITS DISPLAY */}
      <div className="mb-6 flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full">
        <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500" />
        <span className="font-semibold text-sm">
          {credits} Credits Remaining
        </span>
        <button 
          onClick={() => setShowPayModal(true)}
          className="ml-2 text-xs bg-black text-white px-2 py-1 rounded-md hover:bg-gray-800"
        >
          Buy More
        </button>
      </div>

      <div className="w-full max-w-xl space-y-8">
        
        {/* INPUT SECTION */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* VIDEO INPUT */}
          <div 
            onClick={() => videoInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all aspect-square text-center relative overflow-hidden"
          >
            {videoFile ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video 
                  src={URL.createObjectURL(videoFile)} 
                  className="absolute inset-0 w-full h-full object-cover rounded-lg opacity-50" 
                />
                <span className="relative z-10 font-medium text-black bg-white/80 px-2 py-1 rounded">
                  Change Video
                </span>
              </div>
            ) : (
              <>
                <Play className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-500">
                  Tap to add<br/>Target Video
                </span>
              </>
            )}
            <input 
              type="file" 
              ref={videoInputRef}
              accept="video/*" 
              className="hidden" 
              onChange={(e) => e.target.files && setVideoFile(e.target.files[0])} 
            />
          </div>

          {/* FACE INPUT */}
          <div 
            onClick={() => faceInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-pink-500 hover:bg-pink-50 transition-all aspect-square text-center relative overflow-hidden"
          >
             {faceFile ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img 
                  src={URL.createObjectURL(faceFile)} 
                  alt="Face" 
                  className="absolute inset-0 w-full h-full object-cover rounded-lg opacity-50" 
                />
                <span className="relative z-10 font-medium text-black bg-white/80 px-2 py-1 rounded">
                  Change Face
                </span>
              </div>
            ) : (
              <>
                <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-500">
                  Tap to add<br/>Your Face
                </span>
              </>
            )}
            <input 
              type="file" 
              ref={faceInputRef}
              accept="image/*" 
              className="hidden" 
              onChange={(e) => e.target.files && setFaceFile(e.target.files[0])} 
            />
          </div>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        {/* MAGIC BUTTON */}
        <button
          onClick={handleUpload}
          disabled={loading}
          className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2
            ${loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
            }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Zap className="w-6 h-6 fill-current" />
              Make Magic
            </>
          )}
        </button>

        {/* RESULT SECTION */}
        {resultVideo && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-xl font-bold text-black text-center mb-2">
              Woah! You loved that one?
            </h3>
            <div className="rounded-xl overflow-hidden shadow-2xl border-4 border-black bg-black">
              <video 
                src={resultVideo} 
                controls 
                autoPlay 
                loop 
                className="w-full"
              />
            </div>
            <a 
              href={resultVideo} 
              download="gigglegram.mp4"
              className="block mt-4 text-center text-purple-600 font-semibold hover:underline"
            >
              Download Video
            </a>
          </div>
        )}
      </div>

      {/* --- PAYMENT MODAL --- */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
            
            <button
              onClick={() => setShowPayModal(false)}
              className="absolute top-4 right-4 p-2 text-black hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 mb-3">
                <Zap className="w-6 h-6 text-purple-600 fill-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-black">Need more magic?</h2>
              <p className="text-gray-500 mt-1">
                You've used up your free credits! Top up to keep creating.
              </p>
            </div>

            <div className="space-y-3">
              <a
                href={process.env.NEXT_PUBLIC_STRIPE_LINK_LOW}
                className="block w-full border-2 border-gray-200 rounded-xl p-4 hover:border-purple-500 hover:bg-purple-50 transition-all group text-left"
              >
                <div className="flex justify-between items-center">
                  <div className="font-bold text-lg text-black">10 Magic Videos</div>
                  <div className="font-bold text-xl text-black">$4.99</div>
                </div>
                <div className="text-xs text-gray-500 mt-1 group-hover:text-purple-600">
                  Perfect for a quick laugh
                </div>
              </a>

              <a
                href={process.env.NEXT_PUBLIC_STRIPE_LINK_HIGH}
                className="block w-full border-2 border-purple-500 bg-purple-50 rounded-xl p-4 hover:bg-purple-100 transition-all text-left relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-purple-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                  BEST VALUE
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-lg text-black">Super Grandma Pass</div>
                    <div className="text-sm text-gray-500">80 Magic Videos</div>
                  </div>
                  <div className="font-bold text-xl text-black">$29.99</div>
                </div>
              </a>
            </div>

            <p className="text-center text-xs text-gray-400 mt-6">
              Secure payment via Stripe. Credits added instantly.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}