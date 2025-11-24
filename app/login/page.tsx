'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    setIsLoading(false);

    if (error) {
      setMessage('❌ ' + error.message);
    } else {
      setMessage('✅ Check your email! Click the magic link to log in.');
    }
  };

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-b from-red-50 to-green-50 flex items-center justify-center">
      <div className="max-w-md w-full">
        <h1 className="text-5xl font-bold text-center mb-2">
          🎄 GiggleGram
        </h1>
        <p className="text-center text-gray-600 mb-8 text-lg">
          Log in to start swapping! ✨
        </p>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleLogin}>
            <label className="block mb-4">
              <span className="text-lg font-semibold mb-2 block">
                📧 Your Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="grandma@example.com"
                required
                className="w-full text-lg p-4 border-2 border-gray-300 rounded-lg"
              />
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl text-2xl font-bold disabled:bg-gray-300 transition-colors"
            >
              {isLoading ? '📬 Sending Magic Link...' : '✨ Send Magic Link'}
            </button>
          </form>

          {message && (
            <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
              <p className="text-blue-800 text-lg text-center">{message}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}