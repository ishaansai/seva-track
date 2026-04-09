'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSignups, getEvents, markDelivered, itemTypeLabel, seedDefaultCoordinator, Signup, SevaEvent } from '@/lib/store';

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function DeliverPageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const coordId = searchParams.get('coord') ?? 'seva2024';

  const [signup, setSignup] = useState<Signup | null>(null);
  const [event, setEvent] = useState<SevaEvent | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    seedDefaultCoordinator();
    const s = getSignups(coordId).find(s => s.id === id);
    if (s) {
      setSignup(s);
      setDone(s.status === 'delivered');
      if (s.deliveryPhotoUrl) setPhoto(s.deliveryPhotoUrl);
      const e = getEvents(coordId).find(e => e.id === s.eventId);
      if (e) setEvent(e);
    }
  }, [id, coordId]);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleDeliver() {
    if (!photo || !signup) return;
    markDelivered(signup.id, photo, coordId);
    setDone(true);
  }

  const backUrl = `/member?coord=${coordId}`;

  if (!signup) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p>Signup not found</p>
          <Link href={backUrl} className="text-orange-500 text-base mt-2 block">← Go back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-white border-b border-orange-100 px-4 py-4 flex items-center shadow-sm">
        <Link href={backUrl} className="text-orange-500 text-base font-medium">← Back</Link>
        <h1 className="font-bold text-gray-800 text-lg mx-auto">Mark Delivered</h1>
        <div className="w-12" />
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {done ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Delivered!</h2>
            <p className="text-gray-500 mb-1">Thank you, {signup.memberName}!</p>
            <p className="text-gray-400 text-base">Your delivery has been logged</p>
            {photo && (
              <div className="mt-6 rounded-2xl overflow-hidden border border-green-200 max-w-xs mx-auto shadow-sm">
                <img src={photo} alt="Delivery confirmation" className="w-full" />
              </div>
            )}
            <Link href={backUrl} className="mt-6 inline-block bg-orange-500 text-white px-8 py-3 rounded-2xl font-semibold text-base hover:bg-orange-600 transition-colors">
              Back to Home
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
              <p className="text-sm text-gray-400 mb-1 uppercase tracking-wide font-medium">Delivery for</p>
              <p className="font-bold text-gray-800 text-lg">{signup.memberName}</p>
              {event && <p className="text-orange-600 font-medium mt-1 text-base">{formatDate(event.date)}</p>}
              <span className="inline-block mt-2 bg-orange-100 text-orange-700 text-sm px-3 py-1 rounded-full font-medium">
                {itemTypeLabel(signup.itemType)}
              </span>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
              <p className="text-base font-medium text-gray-700 mb-3">
                Upload delivery photo <span className="text-red-400">*</span>
              </p>
              {photo ? (
                <div className="relative">
                  <img src={photo} alt="Preview" className="w-full rounded-xl object-cover max-h-72" />
                  <button onClick={() => setPhoto(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-black/70">✕</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-orange-200 rounded-xl py-12 flex flex-col items-center gap-2 text-orange-400 hover:bg-orange-50 transition-colors">
                  <span className="text-4xl">📷</span>
                  <span className="text-base font-medium">Tap to take or upload photo</span>
                  <span className="text-sm text-gray-400">Show the delivered bags</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
            </div>

            <button onClick={handleDeliver} disabled={!photo} className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white py-4 rounded-2xl font-bold text-lg shadow-md transition-all active:scale-95">
              ✓ Mark as Delivered
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function DeliverPage() {
  return (
    <Suspense>
      <DeliverPageInner />
    </Suspense>
  );
}
