'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getCoordinator, CoordinatorProfile } from '@/lib/db';

const BAG_CONTENTS = [
  { icon: '🥪', label: 'PB&J Sandwich' },
  { icon: '🍊', label: 'Fresh Fruit' },
  { icon: '🍟', label: 'Snack Packet' },
  { icon: '🍫', label: 'Granola Bar' },
  { icon: '🧃', label: 'Juice Drink' },
];

const SHOPPING_LIST = [
  { item: 'Skippy Peanut Butter', qty: '1 bottle' },
  { item: 'Kirkland Organic Strawberry Spread', qty: '½ bottle' },
  { item: 'Oroweat 100% Whole Wheat Bread', qty: '3 packs (Costco 2-pack)' },
  { item: 'Sandwich Ziplock Bags', qty: '25' },
  { item: 'Cuties (clementines)', qty: '1 bag' },
  { item: 'Nature Valley Crunchy Granola Bar', qty: '25' },
  { item: 'Frito Lay Fun Flavor Mix', qty: '25' },
  { item: 'Honest Kids Organic Juice Drink', qty: '25' },
  { item: 'Brown paper bags', qty: '25' },
  { item: 'Labels, scissors, stapler', qty: 'for packing' },
];

const HOW_IT_WORKS = [
  { icon: '📅', text: "Sign up at the beginning of each month for that month's dates" },
  { icon: '🛒', text: 'Shop for ingredients using the list below (most from Costco)' },
  { icon: '🥪', text: 'Make 25 PB&J sandwiches + pack 5 items per brown bag' },
  { icon: '😷', text: 'Wear a mask and gloves while making and packing' },
  { icon: '🏷', text: 'Label bags with Seva or Chirag SJC stickers' },
  { icon: '📦', text: "Drop off bags at your coordinator's address (see date details in the app)" },
  { icon: '🚐', text: 'Bags are delivered to shelters on delivery day' },
];

function LogisticsPageInner() {
  const searchParams = useSearchParams();
  const coordParam = searchParams.get('coord');
  const [tab, setTab] = useState<'guide' | 'pdf'>('guide');
  const [coord, setCoord] = useState<CoordinatorProfile | null>(null);

  useEffect(() => {
    async function loadCoord() {
      if (coordParam) {
        const p = await getCoordinator(coordParam);
        setCoord(p ?? null);
      } else {
        const { getDefaultCoordinator } = await import('@/lib/db');
        const p = await getDefaultCoordinator();
        setCoord(p ?? null);
      }
    }
    loadCoord();
  }, [coordParam]);

  const mapsUrl = coord ? `https://maps.apple.com/?q=${encodeURIComponent(coord.address)}` : '';
  const gmapsUrl = coord ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coord.address)}` : '';
  const memberUrl = coord ? `/member?coord=${coord.id}` : '/member';

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-white border-b border-orange-100 px-4 py-4 flex items-center sticky top-0 z-10 shadow-sm">
        <Link href={memberUrl} className="text-orange-500 text-base font-medium">← Back</Link>
        <h1 className="font-bold text-gray-800 text-lg mx-auto">Logistics Guide</h1>
        <div className="w-12" />
      </header>

      <div className="flex bg-white border-b border-orange-100">
        <button onClick={() => setTab('guide')} className={`flex-1 py-3.5 text-base font-semibold transition-colors ${tab === 'guide' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-400'}`}>
          Quick Guide
        </button>
        <button onClick={() => setTab('pdf')} className={`flex-1 py-3.5 text-base font-semibold transition-colors ${tab === 'pdf' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-400'}`}>
          Full Document
        </button>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">

        {tab === 'guide' && (
          <>
            {/* Coordinator contact */}
            {coord && (
              <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden mt-2">
                <div className="bg-orange-500 px-4 py-2.5">
                  <p className="text-white font-bold text-base">Coordinator Contact</p>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-semibold text-gray-800 text-base">{coord.name}</p>
                    <p className="text-sm text-gray-400">For questions &amp; drop-off info</p>
                  </div>
                  <div className="flex gap-2">
                    <a href={`tel:${coord.phone}`} className="flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-xl text-base font-semibold hover:bg-green-100 transition-colors">
                      📞 Call
                    </a>
                    <a href={`https://wa.me/${coord.phone}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-green-500 text-white px-3 py-2 rounded-xl text-base font-semibold hover:bg-green-600 transition-colors">
                      💬 WA
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Drop-off address */}
            {coord && (
              <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
                <div className="bg-amber-500 px-4 py-2.5">
                  <p className="text-white font-bold text-base">Default Drop-Off Location</p>
                </div>
                <div className="px-4 py-3">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl flex-shrink-0">📍</span>
                    <div>
                      <p className="font-semibold text-gray-800 text-base">{coord.address}</p>
                      <p className="text-sm text-gray-400 mt-0.5">Check your specific event date for exact address and time</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-base font-semibold bg-gray-100 text-gray-700 py-2.5 rounded-xl hover:bg-gray-200 transition-colors">
                      🗺 Apple Maps
                    </a>
                    <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-base font-semibold bg-gray-100 text-gray-700 py-2.5 rounded-xl hover:bg-gray-200 transition-colors">
                      🗺 Google Maps
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* How it works */}
            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
              <div className="bg-orange-100 px-4 py-2.5">
                <p className="text-orange-800 font-bold text-base">How It Works</p>
              </div>
              <div className="px-4 py-3 space-y-3">
                {HOW_IT_WORKS.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0 text-lg">{step.icon}</div>
                    <p className="text-base text-gray-700 pt-0.5">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Each bag contents */}
            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
              <div className="bg-orange-100 px-4 py-2.5 flex items-center justify-between">
                <p className="text-orange-800 font-bold text-base">Each Bag Contains</p>
                <span className="bg-orange-500 text-white text-sm font-bold px-2 py-0.5 rounded-full">5 items</span>
              </div>
              <div className="grid grid-cols-5 gap-2 p-4">
                {BAG_CONTENTS.map(({ icon, label }) => (
                  <div key={label} className="text-center">
                    <div className="bg-orange-50 rounded-xl py-2.5 mb-1.5 text-2xl">{icon}</div>
                    <p className="text-sm text-gray-600 leading-tight font-medium">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Shopping list */}
            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
              <div className="bg-orange-100 px-4 py-2.5 flex items-center justify-between">
                <p className="text-orange-800 font-bold text-base">Shopping List</p>
                <span className="text-orange-600 text-sm font-medium">For 25 bags · Costco</span>
              </div>
              <div className="px-4 py-3 space-y-3">
                {SHOPPING_LIST.map((row, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-7 h-7 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-gray-800">{row.item}</p>
                      <p className="text-sm text-gray-400">{row.qty}</p>
                    </div>
                  </div>
                ))}
                <p className="text-sm text-gray-400 italic border-t border-gray-50 pt-3">
                  You can swap chips, bars, or drinks for any equivalent item.
                </p>
              </div>
            </div>
          </>
        )}

        {tab === 'pdf' && (
          <div className="mt-2 space-y-3">
            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div>
                  <p className="font-semibold text-gray-800 text-base">Meal Bags Seva Logistics</p>
                  <p className="text-sm text-gray-400">Official guide document</p>
                </div>
                <a href="/logistics.pdf" target="_blank" rel="noopener noreferrer" className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-orange-600 transition-colors">
                  Open ↗
                </a>
              </div>
              <iframe src="/logistics.pdf" className="w-full" style={{ height: '75vh', display: 'block' }} title="Meal Bag Seva Logistics" />
            </div>
            <p className="text-sm text-gray-400 text-center">
              Tap &quot;Open ↗&quot; to view fullscreen or save to your device
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LogisticsPage() {
  return (
    <Suspense>
      <LogisticsPageInner />
    </Suspense>
  );
}
