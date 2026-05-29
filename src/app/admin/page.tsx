'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInCoordinator, registerCoordinator, DEFAULT_ADDRESS } from '@/lib/db';

export default function AdminLogin() {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  // Register
  const [regName,    setRegName]    = useState('');
  const [regEmail,   setRegEmail]   = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone,   setRegPhone]   = useState('');
  const [regAddress, setRegAddress] = useState('');

  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true); setError('');
    try {
      await signInCoordinator(email.trim(), password);
      router.push('/admin/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!regName.trim())          { setError('Enter your name or chapter name.'); return; }
    if (!regEmail.trim())         { setError('Enter your email address.'); return; }
    if (regPassword.length < 6)   { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError('');
    try {
      await registerCoordinator({
        name:     regName.trim(),
        email:    regEmail.trim(),
        password: regPassword,
        phone:    regPhone.replace(/\D/g, ''),
        address:  regAddress.trim() || DEFAULT_ADDRESS,
      });
      router.push('/admin/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create account. Try a different email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col">
      <header className="bg-white border-b border-orange-100 px-4 py-4 flex items-center shadow-sm">
        <Link href="/" className="text-orange-500 text-base font-medium">← Home</Link>
        <h1 className="font-bold text-gray-800 text-lg mx-auto">Coordinator Portal</h1>
        <div className="w-12" />
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-orange-100 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">🔐</div>
            <h2 className="text-xl font-bold text-gray-800">
              {mode === 'login' ? 'Coordinator Login' : 'Create Your Account'}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {mode === 'login' ? 'Sign in with your coordinator email' : 'Set up your chapter'}
            </p>
          </div>

          {mode === 'login' ? (
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className={`w-full border rounded-xl px-4 py-3 text-base focus:outline-none transition-colors ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-orange-400'}`}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className={`w-full border rounded-xl px-4 py-3 text-base focus:outline-none transition-colors ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-orange-400'}`}
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button onClick={handleLogin} disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-base transition-colors">
                {loading ? 'Logging in…' : 'Login'}
              </button>
              <p className="text-center text-sm text-gray-400 pt-1">
                Demo:{' '}
                <button
                  onClick={() => { setEmail('admin@sevacommons.org'); setPassword('seva2024'); setError(''); }}
                  className="font-mono font-medium text-orange-500 underline"
                >
                  admin@sevacommons.org
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <input type="text" placeholder="Your name or chapter name *"
                value={regName} onChange={e => { setRegName(e.target.value); setError(''); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400" />
              <input type="email" placeholder="Email address *"
                value={regEmail} onChange={e => { setRegEmail(e.target.value); setError(''); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400" />
              <input type="password" placeholder="Choose a password * (min 6 chars)"
                value={regPassword} onChange={e => { setRegPassword(e.target.value); setError(''); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400" />
              <input type="text" inputMode="numeric" placeholder="Your phone number"
                value={regPhone} onChange={e => setRegPhone(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400" />
              <input type="text" placeholder="Default drop-off address"
                value={regAddress} onChange={e => setRegAddress(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400" />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button onClick={handleRegister} disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-base transition-colors">
                {loading ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          )}

          <div className="border-t border-gray-100 mt-5 pt-4 text-center">
            {mode === 'login' ? (
              <p className="text-sm text-gray-400">
                New coordinator?{' '}
                <button onClick={() => { setMode('register'); setError(''); }} className="text-orange-500 font-semibold">Create account</button>
              </p>
            ) : (
              <p className="text-sm text-gray-400">
                Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(''); }} className="text-orange-500 font-semibold">Login</button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
