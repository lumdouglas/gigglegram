'use client';

import { useState, useRef, useCallback } from 'react';

const TEMPLATE_COUNT = 10;
const templates = Array.from({ length: TEMPLATE_COUNT }, (_, i) => ({
  id: String(i + 1),
  index: String(i + 1).padStart(2, '0'),
  src: `/templates/template-${String(i + 1).padStart(2, '0')}.jpg`,
}));

type SwapState = 'idle' | 'loading' | 'done' | 'error';

export default function FaceSwapPage() {
  const [userPhoto, setUserPhoto] = useState<File | null>(null);
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [swapState, setSwapState] = useState<SwapState>('idle');
  const [result, setResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (userPhotoUrl) URL.revokeObjectURL(userPhotoUrl);
    setUserPhoto(file);
    setUserPhotoUrl(URL.createObjectURL(file));
    setResult(null);
    setSwapState('idle');
  }, [userPhotoUrl]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSwap = async () => {
    if (!userPhoto || !selectedTemplate) return;
    setSwapState('loading');
    setResult(null);

    const formData = new FormData();
    formData.append('userPhoto', userPhoto);
    formData.append('templateIndex', selectedTemplate);

    try {
      const res = await fetch('/api/faceswap', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Unknown error');
      setResult(data.output);
      setSwapState('done');
    } catch {
      setSwapState('error');
    }
  };

  const step = !userPhoto ? 1 : !selectedTemplate ? 2 : 3;

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Face Swap</h1>
          <p className="text-gray-400">Upload a photo, pick a face, get the magic.</p>
        </div>

        {/* Step 1: Upload */}
        <section className="mb-8">
          <StepLabel number={1} active={step >= 1} label="Upload your photo" />

          <div
            className={`mt-3 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
              isDragging
                ? 'border-violet-400 bg-violet-950/30'
                : 'border-gray-700 hover:border-gray-500'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />

            {userPhotoUrl ? (
              <div className="flex items-center gap-4 p-4">
                <img
                  src={userPhotoUrl}
                  alt="Your photo"
                  className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">{userPhoto?.name}</p>
                  <p className="text-sm text-gray-400 mt-0.5">Click or drop to replace</p>
                </div>
                <div className="ml-auto flex-shrink-0">
                  <CheckIcon />
                </div>
              </div>
            ) : (
              <div className="py-14 text-center px-4">
                <UploadIcon />
                <p className="text-gray-300 font-medium mt-3">Drop your photo here</p>
                <p className="text-gray-500 text-sm mt-1">or click to browse</p>
                <p className="text-gray-600 text-xs mt-3">JPG or PNG</p>
              </div>
            )}
          </div>
        </section>

        {/* Step 2: Choose template */}
        <section className={`mb-8 transition-opacity duration-300 ${step >= 2 ? 'opacity-100' : 'opacity-25 pointer-events-none'}`}>
          <StepLabel number={2} active={step >= 2} label="Choose a face" />

          <div className="mt-3 flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}>
            {templates.map((t) => {
              const isSelected = selectedTemplate === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden transition-all focus:outline-none ${
                    isSelected
                      ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-gray-950'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.src}
                    alt={`Template ${t.id}`}
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-violet-600/20 flex items-end justify-end p-1">
                      <div className="w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 3: CTA */}
        <section className={`mb-8 transition-opacity duration-300 ${step >= 3 ? 'opacity-100' : 'opacity-25 pointer-events-none'}`}>
          <StepLabel number={3} active={step >= 3} label="Swap faces" />

          <button
            onClick={handleSwap}
            disabled={!userPhoto || !selectedTemplate || swapState === 'loading'}
            className="mt-3 w-full min-h-[56px] rounded-2xl font-semibold text-lg transition-all flex items-center justify-center gap-3 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            {swapState === 'loading' ? (
              <>
                <Spinner />
                Working on it...
              </>
            ) : (
              <>
                <span>Swap Faces</span>
                <span aria-hidden>→</span>
              </>
            )}
          </button>
        </section>

        {/* Error */}
        {swapState === 'error' && (
          <div className="mb-8 p-4 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-300 text-sm flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Something went wrong — try a different photo
          </div>
        )}

        {/* Result */}
        {swapState === 'done' && result && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Your result</h2>
            <div className="rounded-2xl overflow-hidden bg-gray-900 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result} alt="Face swap result" className="w-full" />
            </div>
            <a
              href={result}
              download="faceswap.jpg"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download JPG
            </a>
          </section>
        )}
      </div>
    </main>
  );
}

function StepLabel({ number, active, label }: { number: number; active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${active ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-500'}`}>
        {number}
      </span>
      <h2 className={`font-semibold transition-colors ${active ? 'text-white' : 'text-gray-500'}`}>{label}</h2>
    </div>
  );
}

function CheckIcon() {
  return (
    <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center">
      <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg className="mx-auto w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
