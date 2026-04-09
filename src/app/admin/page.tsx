'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getCoordinators, addCoordinator, findCoordinatorByPassword,
  seedDefaultCoordinator, DEFAULT_LOCATION, DEFAULT_PHONE,
} from '@/lib/store';

export default function AdminLogin() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Seed demo coordinator on first load
    seedDefaultCoordinator();
  }, []);

  function handleLogin() {
    const coord = findCoordinatorByPassword(password.trim());
    if (coord) {
      sessionStorage.setItem('seva_admin', coord.id);
      router.push('/admin/dashboard');
    } else {
      setError('Incorrect password. Try again.');
    }
  }

  function handleRegister() {
    if (!regName.trim()) { setError('Please enter your name or chapter name.'); return; }
    if (regPassword.length < 4) { setError('Password must be at least 4 characters.'); return; }
    const coords = getCoordinators();
    if (coords.some(c => c.password === regPassword)) {
      setError('That password is already in use. Choose a different one.');
      return;
    }
    const coord = addCoordinator({
      name: regName.trim(),
      password: regPassword,
      phone: regPhone.replace(/\D/g, '') || DEFAULT_PHONE,
      address: regAddress.trim() || DEFAULT_LOCATION,
    });
    sessionStorage.setItem('seva_admin', coord.id);
    router.push('/admin/dashboard');
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
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
              🔐
            </div>
            <h2 className="text-xl font-bold text-gray-800">
              {mode === 'login' ? 'Coordinator Login' : 'Create Your Account'}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {mode === 'login' ? 'Enter your coordinator password' : 'Set up your chapter'}
            </p>
          </div>

          {mode === 'login' ? (
            <div className="space-y-3">
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className={`w-full border rounded-xl px-4 py-3 text-base focus:outline-none transition-colors ${
                  error ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-orange-400'
                }`}
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleLogin}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold text-base transition-colors"
              >
                Login
              </button>
              <p className="text-center text-sm text-gray-400 pt-1">
                Demo password:{' '}
                <button
                  onClick={() => { setPassword('seva2024'); setError(''); }}
                  className="font-mono font-medium text-orange-500 underline"
                >
                  seva2024
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Your name or chapter name *"
                value={regName}
                onChange={e => { setRegName(e.target.value); setError(''); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400"
              />
              <input
                type="password"
                placeholder="Choose a password *"
                value={regPassword}
                onChange={e => { setRegPassword(e.target.value); setError(''); }}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400"
              />
              <input
                type="tel"
                inputMode="numeric"
                placeholder="Your phone number (for member notifications)"
                value={regPhone}
                onChange={e => setRegPhone(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400"
              />
              <input
                type="text"
                placeholder="Default drop-off address"
                value={regAddress}
                onChange={e => setRegAddress(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400"
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                onClick={handleRegister}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold text-base transition-colors"
              >
                Create Account
              </button>
            </div>
          )}

          <div className="border-t border-gray-100 mt-5 pt-4 text-center">
            {mode === 'login' ? (
              <p className="text-sm text-gray-400">
                New coordinator?{' '}
                <button onClick={() => { setMode('register'); setError(''); }} className="text-orange-500 font-semibold">
                  Create account
                </button>
              </p>
            ) : (
              <p className="text-sm text-gray-400">
                Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(''); }} className="text-orange-500 font-semibold">
                  Login
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
