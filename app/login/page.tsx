'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // ⚠️ CRITICAL: Must match the route we built in src/app/auth/callback/route.ts
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Try again!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-pink-50 to-white p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border-2 border-pink-100">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎅</div>
          <h1 className="text-2xl font-black text-gray-800 mb-2">Restore Your Christmas Pass</h1>
          <p className="text-gray-500">
            Bought it on your phone? Use it on your iPad!<br/>
            Enter your email to restore your purchase.
          </p>
        </div>

        {sent ? (
          // Success State
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center animate-in fade-in zoom-in">
            <div className="text-4xl mb-3">📧</div>
            <h3 className="text-xl font-bold text-emerald-800 mb-2">Check your email!</h3>
            <p className="text-emerald-600 mb-4">
              We sent a magic link to <b>{email}</b>. Click it to log in instantly.
            </p>
            <button 
                onClick={() => setSent(false)}
                className="text-sm text-gray-400 underline hover:text-gray-600"
            >
                Try a different email
            </button>
          </div>
        ) : (
          // Login Form
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Email Address</label>
                <input 
                    type="email" 
                    required
                    placeholder="nana@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-100 outline-none transition-all text-lg"
                />
            </div>

            {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-bold">
                    {error}
                </div>
            )}

            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-black py-4 rounded-xl shadow-lg transform active:scale-95 transition-all flex items-center justify-center gap-2"
            >
                {loading ? 'Sending...' : 'Send Magic Link ✨'}
            </button>
          </form>
        )}

        {/* Back Link */}
        <div className="mt-8 text-center">
            <a href="/" className="text-gray-400 font-bold hover:text-gray-600">← Back to Magic</a>
        </div>

      </div>
    </div>
  );
}