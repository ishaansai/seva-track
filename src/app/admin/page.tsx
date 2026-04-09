'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const ADMIN_PASSWORD = 'seva2024';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const router = useRouter();

  function handleLogin() {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('seva_admin', '1');
      router.push('/admin/dashboard');
    } else {
      setError(true);
    }
  }

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col">
      <header className="bg-white border-b border-orange-100 px-4 py-4 flex items-center shadow-sm">
        <Link href="/" className="text-orange-500 text-sm font-medium">← Home</Link>
        <h1 className="font-bold text-gray-800 mx-auto">Admin Portal</h1>
        <div className="w-12" />
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-orange-100 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
              🔐
            </div>
            <h2 className="text-xl font-bold text-gray-800">Coordinator Login</h2>
            <p className="text-sm text-gray-400 mt-1">Seva Commons Admin</p>
          </div>

          <div className="space-y-3">
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors ${
                error ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-orange-400'
              }`}
            />
            {error && <p className="text-red-500 text-xs">Incorrect password. Try again.</p>}
            <button
              onClick={handleLogin}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
            >
              Login
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            Demo password: <span className="font-mono font-medium text-gray-500">seva2024</span>
          </p>
        </div>
      </div>
    </div>
  );
}
