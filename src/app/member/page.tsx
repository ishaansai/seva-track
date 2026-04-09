'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getEvents, getSignups, addSignup, removeSignup, getSlotsUsed,
  getCoordinator, seedDefaultCoordinator,
  SevaEvent, Signup, ItemType, itemTypeLabel, CoordinatorProfile,
} from '@/lib/store';
import { generateIcs, formatTime, ReminderOffset } from '@/lib/ics';

const REMINDERS: { value: ReminderOffset; label: string; icon: string }[] = [
  { value: '3days', label: '3 Days Before', icon: '🗓' },
  { value: '1day',  label: '1 Day Before',  icon: '⏰' },
  { value: '1hour', label: '1 Hour Before', icon: '🔔' },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

type SignupResult = { signup: Signup; event: SevaEvent };

function MemberPageInner() {
  const searchParams = useSearchParams();
  const coordId = searchParams.get('coord') ?? 'seva2024';
  const monthFilter = searchParams.get('month');

  const [coord, setCoord] = useState<CoordinatorProfile | null>(null);
  const [events, setEvents] = useState<SevaEvent[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [showForm, setShowForm] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [wantsMeals, setWantsMeals] = useState(true);
  const [wantsNutritional, setWantsNutritional] = useState(false);
  const [justSignedUp, setJustSignedUp] = useState<SignupResult | null>(null);
  const [view, setView] = useState<'signup' | 'deliver'>('signup');
  const [deliverPhone, setDeliverPhone] = useState('');
  const [mySignups, setMySignups] = useState<Signup[] | null>(null);

  useEffect(() => {
    seedDefaultCoordinator();
    const profile = getCoordinator(coordId);
    setCoord(profile ?? null);
    setEvents(getEvents(coordId).sort((a, b) => a.date.localeCompare(b.date)));
    setSignups(getSignups(coordId));
  }, [coordId]);

  const today = new Date().toISOString().slice(0, 10);
  let visibleEvents = events.filter(e => e.date >= today);
  if (monthFilter) visibleEvents = visibleEvents.filter(e => e.date.startsWith(monthFilter));

  function getSlotInfo(event: SevaEvent) {
    const { mealBagUsed, nutritionalUsed } = getSlotsUsed(event.id, signups);
    return {
      mealBagAvail: Math.max(0, event.mealBagSlots - mealBagUsed),
      nutritionalAvail: Math.max(0, event.nutritionalSlots - nutritionalUsed),
      mealBagUsed,
      nutritionalUsed,
    };
  }

  function checkboxesToItemType(): ItemType | null {
    if (wantsMeals && wantsNutritional) return 'both';
    if (wantsMeals) return 'meals';
    if (wantsNutritional) return 'nutritional';
    return null;
  }

  function handleSignup(event: SevaEvent) {
    if (!name.trim() || !phone.trim()) return;
    const itemType = checkboxesToItemType();
    if (!itemType) return;
    const signup = addSignup({ eventId: event.id, memberName: name.trim(), memberContact: phone.replace(/\D/g, ''), itemType }, coordId);
    setSignups(getSignups(coordId));
    setJustSignedUp({ signup, event });
    setShowForm(null);
    setName(''); setPhone(''); setWantsMeals(true); setWantsNutritional(false);
  }

  function handleFindDeliveries() {
    const cleaned = deliverPhone.replace(/\D/g, '');
    if (!cleaned) return;
    const sups = getSignups(coordId).filter(
      s => s.memberContact.replace(/\D/g, '') === cleaned && s.status === 'pending'
    );
    setMySignups(sups);
  }

  function handleCancelSignup(signup: Signup, event: SevaEvent | undefined) {
    removeSignup(signup.id, coordId);
    setMySignups(prev => prev ? prev.filter(s => s.id !== signup.id) : prev);
    if (coord?.phone) {
      const dateStr = event ? formatDate(event.date) : 'an event';
      const msg = encodeURIComponent(
        `Hi, ${signup.memberName} has cancelled their signup for ${dateStr} (${itemTypeLabel(signup.itemType)}). Please update the list.`
      );
      window.open(`https://wa.me/${coord.phone}?text=${msg}`, '_blank');
    }
  }

  function handleSetReminder(offset: ReminderOffset) {
    if (!justSignedUp) return;
    const { signup, event } = justSignedUp;
    generateIcs(event.date, signup.memberName, itemTypeLabel(signup.itemType), event.dropOffStart, event.dropOffEnd, offset);
  }

  const signedUpEventIds = new Set(signups.map(s => s.eventId));

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-white border-b border-orange-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <Link href="/" className="text-orange-500 text-base font-medium">← Home</Link>
        <h1 className="font-bold text-gray-800 text-lg">Seva Track</h1>
        <Link href={`/logistics?coord=${coordId}`} className="text-orange-500 text-base font-medium">Guide</Link>
      </header>

      {monthFilter && (
        <div className="bg-orange-500 px-4 py-2 text-center">
          <p className="text-white text-sm font-medium">
            Showing dates for {new Date(monthFilter + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      )}

      <div className="flex bg-white border-b border-orange-100">
        {(['signup', 'deliver'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setView(tab); setJustSignedUp(null); }}
            className={`flex-1 py-3.5 text-base font-semibold transition-colors ${
              view === tab ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-400'
            }`}
          >
            {tab === 'signup' ? 'Sign Up' : 'Mark Delivered'}
          </button>
        ))}
      </div>

      <div className="max-w-lg mx-auto p-4">

        {/* ── SIGN UP VIEW ── */}
        {view === 'signup' && (
          <>
            {justSignedUp && (
              <div className="mt-2 space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-500 text-xl">✓</span>
                    <p className="font-bold text-green-800 text-lg">You&apos;re signed up!</p>
                  </div>
                  <p className="text-green-700 text-base">
                    {formatDate(justSignedUp.event.date)} · {itemTypeLabel(justSignedUp.signup.itemType)}
                  </p>
                  <p className="text-green-600 text-sm mt-1">
                    📍 Drop off at: {justSignedUp.event.dropOffLocation}
                  </p>
                  <p className="text-green-600 text-sm mt-0.5">
                    🕕 {formatTime(justSignedUp.event.dropOffStart)} – {formatTime(justSignedUp.event.dropOffEnd)} · the day before delivery
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
                  <p className="font-semibold text-gray-800 text-base mb-1">Set a Reminder</p>
                  <p className="text-sm text-gray-400 mb-3">Downloads a calendar event — opens in iPhone Calendar, Google Calendar, etc.</p>
                  <div className="space-y-2">
                    {REMINDERS.map(r => (
                      <button
                        key={r.value}
                        onClick={() => handleSetReminder(r.value)}
                        className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-orange-100 hover:bg-orange-50 transition-colors text-left"
                      >
                        <span className="text-2xl">{r.icon}</span>
                        <div>
                          <p className="text-base font-semibold text-gray-800">{r.label}</p>
                          <p className="text-sm text-gray-400">Adds reminder to your calendar</p>
                        </div>
                        <span className="ml-auto text-orange-400 text-base">↓</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setJustSignedUp(null)} className="w-full mt-3 text-base text-gray-400 hover:text-gray-600 py-2">
                    Skip, no reminder
                  </button>
                </div>
              </div>
            )}

            {!justSignedUp && (
              <>
                {/* Drop-off banner with coordinator contact */}
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-2xl flex-shrink-0">📦</span>
                    <div>
                      <p className="text-sm font-bold text-amber-800">Drop-Off Reminder</p>
                      <p className="text-sm text-amber-700">The day before delivery · time and address shown per date below</p>
                    </div>
                  </div>
                  {coord?.phone && (
                    <div className="flex gap-2 mt-2">
                      <a href={`tel:${coord.phone}`}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-amber-200 text-amber-800 text-sm font-semibold py-2 rounded-xl hover:bg-amber-100 transition-colors">
                        📞 Call Coordinator
                      </a>
                      <a href={`https://wa.me/${coord.phone}`} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 text-white text-sm font-semibold py-2 rounded-xl hover:bg-green-600 transition-colors">
                        💬 WhatsApp
                      </a>
                    </div>
                  )}
                </div>

                {visibleEvents.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <div className="text-5xl mb-3">📅</div>
                    <p className="font-medium text-lg">No upcoming dates yet</p>
                    <p className="text-base mt-1">Check back when your coordinator posts new dates</p>
                  </div>
                ) : (
                  <div className="space-y-3 mt-4">
                    <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide px-1">Upcoming Delivery Dates</p>

                    {visibleEvents.map(event => {
                      const slots = getSlotInfo(event);
                      const alreadyIn = signedUpEventIds.has(event.id);
                      const mySignup = signups.find(s => s.eventId === event.id);
                      const totalSlots = event.mealBagSlots + event.nutritionalSlots;
                      const totalUsed = slots.mealBagUsed + slots.nutritionalUsed;
                      const isFull = slots.mealBagAvail === 0 && slots.nutritionalAvail === 0;

                      return (
                        <div key={event.id} className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-gray-800 text-base">{formatDate(event.date)}</p>
                              <p className="text-sm text-gray-500 mt-0.5">🕕 Drop off: {formatTime(event.dropOffStart)} – {formatTime(event.dropOffEnd)}</p>
                              <p className="text-sm text-gray-500 mt-0.5">📍 {event.dropOffLocation}</p>
                              {event.note && <p className="text-sm text-orange-600 font-medium mt-0.5">📌 {event.note}</p>}
                            </div>
                            {isFull ? (
                              <span className="text-sm bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">Full</span>
                            ) : (
                              <span className="text-sm bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">
                                {totalSlots - totalUsed} left
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5 mb-3">
                            <SlotBar label="Meal Bags" used={slots.mealBagUsed} total={event.mealBagSlots} />
                            <SlotBar label="Nutritional" used={slots.nutritionalUsed} total={event.nutritionalSlots} />
                          </div>

                          {alreadyIn ? (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                              <span className="text-green-500">✓</span>
                              <div>
                                <p className="text-green-700 font-medium text-base">You&apos;re signed up!</p>
                                {mySignup && <p className="text-green-600 text-sm">{itemTypeLabel(mySignup.itemType)}</p>}
                              </div>
                            </div>
                          ) : isFull ? (
                            <div className="text-center py-2 text-base text-red-400 font-medium">All slots filled</div>
                          ) : showForm === event.id ? (
                            <SignupForm
                              slots={slots}
                              name={name} setName={setName}
                              phone={phone} setPhone={setPhone}
                              wantsMeals={wantsMeals} setWantsMeals={setWantsMeals}
                              wantsNutritional={wantsNutritional} setWantsNutritional={setWantsNutritional}
                              onConfirm={() => handleSignup(event)}
                              onCancel={() => { setShowForm(null); setName(''); setPhone(''); setWantsMeals(true); setWantsNutritional(false); }}
                            />
                          ) : (
                            <button
                              onClick={() => setShowForm(event.id)}
                              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl text-base font-semibold transition-colors"
                            >
                              Sign Up
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── DELIVER VIEW ── */}
        {view === 'deliver' && (
          <div className="mt-4 space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
              <p className="text-base font-medium text-gray-700 mb-1">Find your pending deliveries</p>
              <p className="text-sm text-gray-400 mb-3">Enter the phone number you signed up with</p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="Your phone number"
                  value={deliverPhone}
                  onChange={e => setDeliverPhone(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFindDeliveries()}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400"
                />
                <button onClick={handleFindDeliveries} className="bg-orange-500 text-white px-5 py-3 rounded-xl text-base font-semibold hover:bg-orange-600 transition-colors">
                  Find
                </button>
              </div>
            </div>

            {mySignups !== null && mySignups.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <div className="text-4xl mb-2">🔍</div>
                <p className="font-medium text-lg">No pending deliveries found</p>
                <p className="text-base mt-1">Make sure you enter the phone number you signed up with</p>
              </div>
            )}

            {mySignups && mySignups.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide px-1">Your Pending Deliveries</p>
                {mySignups.map(signup => {
                  const event = events.find(e => e.id === signup.eventId);
                  return (
                    <div key={signup.id} className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800 text-base">{event ? formatDate(event.date) : 'Unknown date'}</p>
                          <p className="text-base text-orange-600 mt-0.5">{itemTypeLabel(signup.itemType)}</p>
                        </div>
                        <Link href={`/member/deliver/${signup.id}?coord=${coordId}`} className="bg-green-500 text-white text-base font-semibold px-4 py-2.5 rounded-xl hover:bg-green-600">
                          Deliver →
                        </Link>
                      </div>
                      <button
                        onClick={() => {
                          if (!confirm('Cancel your signup? Your coordinator will be notified via WhatsApp.')) return;
                          handleCancelSignup(signup, event);
                        }}
                        className="mt-3 w-full text-sm text-red-400 hover:text-red-600 py-2 border border-gray-100 rounded-xl hover:bg-red-50 transition-colors"
                      >
                        Cancel my signup
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MemberPage() {
  return (
    <Suspense>
      <MemberPageInner />
    </Suspense>
  );
}

function SlotBar({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  const avail = total - used;
  return (
    <div className="flex items-center gap-2">
      <p className="text-sm text-gray-500 w-22 flex-shrink-0">{label}</p>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-sm font-medium w-16 text-right flex-shrink-0 ${avail === 0 ? 'text-red-500' : 'text-gray-500'}`}>
        {avail === 0 ? 'Full' : `${avail}/${total} left`}
      </p>
    </div>
  );
}

function SignupForm({
  slots, name, setName, phone, setPhone,
  wantsMeals, setWantsMeals, wantsNutritional, setWantsNutritional,
  onConfirm, onCancel,
}: {
  slots: { mealBagAvail: number; nutritionalAvail: number };
  name: string; setName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  wantsMeals: boolean; setWantsMeals: (v: boolean) => void;
  wantsNutritional: boolean; setWantsNutritional: (v: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const neitherSelected = !wantsMeals && !wantsNutritional;
  const mealsDisabled = slots.mealBagAvail === 0;
  const nutritionalDisabled = slots.nutritionalAvail === 0;
  const canConfirm = name.trim().length > 0 && phone.replace(/\D/g, '').length >= 7 && !neitherSelected;

  return (
    <div className="space-y-3 mt-1">
      <input type="text" placeholder="Your full name *" value={name} onChange={e => setName(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400" />
      <input type="tel" inputMode="numeric" placeholder="Phone number * (for lookup)" value={phone} onChange={e => setPhone(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400" />
      <div className="space-y-2">
        <p className="text-sm text-gray-500 font-medium">What will you bring? (select one or both)</p>
        <label className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-colors cursor-pointer ${
          mealsDisabled ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
            : wantsMeals ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-gray-50'
        }`}>
          <input type="checkbox" checked={wantsMeals} disabled={mealsDisabled} onChange={e => !mealsDisabled && setWantsMeals(e.target.checked)} className="w-5 h-5 accent-orange-500" />
          <span className="text-2xl">🛍️</span>
          <div>
            <p className="text-base font-semibold text-gray-700">25 Meal Bags</p>
            <p className={`text-sm ${mealsDisabled ? 'text-red-400' : 'text-gray-400'}`}>
              {mealsDisabled ? 'No slots left' : `${slots.mealBagAvail} spot${slots.mealBagAvail !== 1 ? 's' : ''} left`}
            </p>
          </div>
        </label>
        <label className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-colors cursor-pointer ${
          nutritionalDisabled ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
            : wantsNutritional ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-gray-50'
        }`}>
          <input type="checkbox" checked={wantsNutritional} disabled={nutritionalDisabled} onChange={e => !nutritionalDisabled && setWantsNutritional(e.target.checked)} className="w-5 h-5 accent-orange-500" />
          <span className="text-2xl">🥗</span>
          <div>
            <p className="text-base font-semibold text-gray-700">Nutritional Items</p>
            <p className={`text-sm ${nutritionalDisabled ? 'text-red-400' : 'text-gray-400'}`}>
              {nutritionalDisabled ? 'No slots left' : `${slots.nutritionalAvail} spot${slots.nutritionalAvail !== 1 ? 's' : ''} left`}
            </p>
          </div>
        </label>
        {neitherSelected && <p className="text-sm text-red-500 px-1">Please select at least one option</p>}
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-200 text-base text-gray-500">Cancel</button>
        <button onClick={onConfirm} disabled={!canConfirm} className="flex-1 py-3 rounded-xl bg-orange-500 text-white text-base font-semibold disabled:opacity-40 hover:bg-orange-600 transition-colors">Confirm</button>
      </div>
    </div>
  );
}
