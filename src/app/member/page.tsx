'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getEvents, getSignups, addSignup, removeSignup, getSlotsUsed, SevaEvent, Signup, ItemType } from '@/lib/store';
import { generateIcs, formatTime, ReminderOffset } from '@/lib/ics';

const ITEM_OPTIONS: { value: ItemType; label: string; icon: string; desc: string }[] = [
  { value: 'nutritional', label: 'Nutritional Items', icon: '🥗', desc: 'Nutritional components only' },
  { value: 'meals',       label: '25 Meal Bags',     icon: '🛍️', desc: '25 complete meal bags' },
  { value: 'both',        label: 'Both',             icon: '🌟', desc: 'Nutritional items + 25 meal bags' },
];

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

export default function MemberPage() {
  const [events, setEvents] = useState<SevaEvent[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [showForm, setShowForm] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [itemType, setItemType] = useState<ItemType>('meals');
  const [justSignedUp, setJustSignedUp] = useState<SignupResult | null>(null);
  const [view, setView] = useState<'signup' | 'deliver'>('signup');
  const [deliverName, setDeliverName] = useState('');
  const [mySignups, setMySignups] = useState<Signup[] | null>(null);

  useEffect(() => {
    setEvents(getEvents().sort((a, b) => a.date.localeCompare(b.date)));
    setSignups(getSignups());
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events.filter(e => e.date >= today);

  function getSlotInfo(event: SevaEvent) {
    const { mealBagUsed, nutritionalUsed } = getSlotsUsed(event.id, signups);
    return {
      mealBagAvail: Math.max(0, event.mealBagSlots - mealBagUsed),
      nutritionalAvail: Math.max(0, event.nutritionalSlots - nutritionalUsed),
      mealBagUsed,
      nutritionalUsed,
    };
  }

  function isOptionDisabled(event: SevaEvent, type: ItemType) {
    const { mealBagAvail, nutritionalAvail } = getSlotInfo(event);
    if (type === 'meals') return mealBagAvail === 0;
    if (type === 'nutritional') return nutritionalAvail === 0;
    if (type === 'both') return mealBagAvail === 0 || nutritionalAvail === 0;
    return false;
  }

  function handleSignup(event: SevaEvent) {
    if (!name.trim()) return;
    const signup = addSignup({ eventId: event.id, memberName: name.trim(), memberContact: contact.trim(), itemType });
    const updated = getSignups();
    setSignups(updated);
    setJustSignedUp({ signup, event });
    setShowForm(null);
    setName('');
    setContact('');
    setItemType('meals');
  }

  function handleFindDeliveries() {
    if (!deliverName.trim()) return;
    const sups = getSignups().filter(
      s => s.memberName.toLowerCase() === deliverName.trim().toLowerCase() && s.status === 'pending'
    );
    setMySignups(sups);
  }

  function handleSetReminder(offset: ReminderOffset) {
    if (!justSignedUp) return;
    const { signup, event } = justSignedUp;
    const itemLabel = ITEM_OPTIONS.find(o => o.value === signup.itemType)?.label ?? signup.itemType;
    generateIcs(event.date, signup.memberName, itemLabel, event.dropOffStart, event.dropOffEnd, offset);
  }

  // Check if member already signed up for an event (by checking existing signups)
  const signedUpEventIds = new Set(signups.map(s => s.eventId));

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-white border-b border-orange-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <Link href="/" className="text-orange-500 text-sm font-medium">← Home</Link>
        <h1 className="font-bold text-gray-800">Seva Track</h1>
        <Link href="/logistics" className="text-orange-500 text-sm font-medium">Logistics</Link>
      </header>

      <div className="flex bg-white border-b border-orange-100">
        {(['signup', 'deliver'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setView(tab); setJustSignedUp(null); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              view === tab ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-400'
            }`}
          >
            {tab === 'signup' ? 'Sign Up for a Date' : 'Mark Delivered'}
          </button>
        ))}
      </div>

      <div className="max-w-lg mx-auto p-4">

        {/* ── SIGN UP VIEW ── */}
        {view === 'signup' && (
          <>
            {/* Post-signup: reminder picker */}
            {justSignedUp && (
              <div className="mt-2 space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-500 text-xl">✓</span>
                    <p className="font-bold text-green-800">You&apos;re signed up!</p>
                  </div>
                  <p className="text-green-700 text-sm">
                    {formatDate(justSignedUp.event.date)} · {ITEM_OPTIONS.find(o => o.value === justSignedUp.signup.itemType)?.label}
                  </p>
                  <p className="text-green-600 text-xs mt-1">
                    Drop off: {formatTime(justSignedUp.event.dropOffStart)} – {formatTime(justSignedUp.event.dropOffEnd)} the day before
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
                  <p className="font-semibold text-gray-800 mb-1">Set a Reminder</p>
                  <p className="text-xs text-gray-400 mb-3">Downloads a calendar event — opens in iPhone Calendar, Google Calendar, etc.</p>
                  <div className="space-y-2">
                    {REMINDERS.map(r => (
                      <button
                        key={r.value}
                        onClick={() => handleSetReminder(r.value)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-orange-100 hover:bg-orange-50 transition-colors text-left"
                      >
                        <span className="text-xl">{r.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{r.label}</p>
                          <p className="text-xs text-gray-400">Adds reminder to your calendar</p>
                        </div>
                        <span className="ml-auto text-orange-400 text-sm">↓</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setJustSignedUp(null)}
                    className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 py-2"
                  >
                    Skip, no reminder
                  </button>
                </div>
              </div>
            )}

            {!justSignedUp && (
              <>
                {/* Drop-off reminder banner */}
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <span className="text-xl flex-shrink-0">📦</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800">Drop-Off:</p>
                    <p className="text-xs text-amber-700">The Tuesday before delivery · 6–9 PM at coordinator&apos;s place</p>
                  </div>
                </div>

                {upcomingEvents.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <div className="text-4xl mb-3">📅</div>
                    <p className="font-medium">No upcoming dates yet</p>
                    <p className="text-sm mt-1">Check back when the coordinator posts new dates</p>
                  </div>
                ) : (
                  <div className="space-y-3 mt-4">
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide px-1">Upcoming Delivery Dates</p>

                    {upcomingEvents.map(event => {
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
                              <p className="font-semibold text-gray-800">{formatDate(event.date)}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Drop off: {formatTime(event.dropOffStart)} – {formatTime(event.dropOffEnd)}
                              </p>
                              {event.note && (
                                <p className="text-xs text-orange-600 font-medium mt-0.5">📌 {event.note}</p>
                              )}
                            </div>
                            {isFull ? (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">Full</span>
                            ) : (
                              <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">
                                {totalSlots - totalUsed} spots left
                              </span>
                            )}
                          </div>

                          {/* Slot bars */}
                          <div className="space-y-1.5 mb-3">
                            <SlotBar label="Meal Bags" used={slots.mealBagUsed} total={event.mealBagSlots} />
                            <SlotBar label="Nutritional" used={slots.nutritionalUsed} total={event.nutritionalSlots} />
                          </div>

                          {alreadyIn ? (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                              <span className="text-green-500">✓</span>
                              <div>
                                <p className="text-green-700 font-medium text-sm">You&apos;re signed up!</p>
                                {mySignup && <p className="text-green-600 text-xs">{ITEM_OPTIONS.find(o => o.value === mySignup.itemType)?.label}</p>}
                              </div>
                            </div>
                          ) : isFull ? (
                            <div className="text-center py-2 text-sm text-red-400 font-medium">All slots filled</div>
                          ) : showForm === event.id ? (
                            <SignupForm
                              slots={slots}
                              name={name} setName={setName}
                              contact={contact} setContact={setContact}
                              itemType={itemType} setItemType={setItemType}
                              isOptionDisabled={(t) => isOptionDisabled(event, t)}
                              onConfirm={() => handleSignup(event)}
                              onCancel={() => { setShowForm(null); setName(''); setContact(''); }}
                            />
                          ) : (
                            <button
                              onClick={() => setShowForm(event.id)}
                              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
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
              <p className="text-sm font-medium text-gray-700 mb-3">Find your pending deliveries</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={deliverName}
                  onChange={e => setDeliverName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFindDeliveries()}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                />
                <button
                  onClick={handleFindDeliveries}
                  className="bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors"
                >
                  Find
                </button>
              </div>
            </div>

            {mySignups !== null && mySignups.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <div className="text-3xl mb-2">🔍</div>
                <p className="font-medium">No pending deliveries found</p>
                <p className="text-sm mt-1">Make sure your name matches exactly</p>
              </div>
            )}

            {mySignups && mySignups.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide px-1">Your Pending Deliveries</p>
                {mySignups.map(signup => {
                  const event = events.find(e => e.id === signup.eventId);
                  return (
                    <div key={signup.id} className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">
                            {event ? formatDate(event.date) : 'Unknown date'}
                          </p>
                          <p className="text-sm text-orange-600 mt-0.5">
                            {ITEM_OPTIONS.find(o => o.value === signup.itemType)?.label}
                          </p>
                        </div>
                        <Link href={`/member/deliver/${signup.id}`} className="bg-green-500 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-green-600">
                          Deliver →
                        </Link>
                      </div>
                      <button
                        onClick={() => {
                          if (!confirm('Cancel your signup for this date?')) return;
                          removeSignup(signup.id);
                          setMySignups(prev => prev ? prev.filter(s => s.id !== signup.id) : prev);
                        }}
                        className="mt-2 w-full text-xs text-red-400 hover:text-red-600 py-1.5 border border-gray-100 rounded-xl hover:bg-red-50 transition-colors"
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

// ── Sub-components ──

function SlotBar({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  const avail = total - used;
  return (
    <div className="flex items-center gap-2">
      <p className="text-xs text-gray-500 w-20 flex-shrink-0">{label}</p>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-green-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`text-xs font-medium w-14 text-right flex-shrink-0 ${avail === 0 ? 'text-red-500' : 'text-gray-500'}`}>
        {avail === 0 ? 'Full' : `${avail}/${total} left`}
      </p>
    </div>
  );
}

function SignupForm({
  slots, name, setName, contact, setContact,
  itemType, setItemType, isOptionDisabled, onConfirm, onCancel,
}: {
  slots: { mealBagAvail: number; nutritionalAvail: number };
  name: string; setName: (v: string) => void;
  contact: string; setContact: (v: string) => void;
  itemType: ItemType; setItemType: (v: ItemType) => void;
  isOptionDisabled: (t: ItemType) => boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ITEM_OPTIONS: { value: ItemType; label: string; icon: string; desc: string }[] = [
    { value: 'nutritional', label: 'Nutritional Items', icon: '🥗', desc: `${slots.nutritionalAvail} spot${slots.nutritionalAvail !== 1 ? 's' : ''} left` },
    { value: 'meals',       label: '25 Meal Bags',     icon: '🛍️', desc: `${slots.mealBagAvail} spot${slots.mealBagAvail !== 1 ? 's' : ''} left` },
    { value: 'both',        label: 'Both',             icon: '🌟', desc: 'Takes 1 slot from each' },
  ];

  return (
    <div className="space-y-3 mt-1">
      <input
        type="text"
        placeholder="Your name *"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
      />
      <input
        type="tel"
        placeholder="Phone / WhatsApp (optional)"
        value={contact}
        onChange={e => setContact(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"
      />
      <div className="space-y-2">
        <p className="text-xs text-gray-500 font-medium">What will you bring?</p>
        {ITEM_OPTIONS.map(opt => {
          const disabled = isOptionDisabled(opt.value);
          return (
            <label
              key={opt.value}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                disabled
                  ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                  : itemType === opt.value
                    ? 'border-orange-400 bg-orange-50 cursor-pointer'
                    : 'border-gray-100 bg-gray-50 cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name="itemType"
                value={opt.value}
                checked={itemType === opt.value}
                disabled={disabled}
                onChange={() => !disabled && setItemType(opt.value)}
                className="hidden"
              />
              <span className="text-xl">{opt.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-700">{opt.label}</p>
                <p className={`text-xs ${disabled ? 'text-red-400' : 'text-gray-400'}`}>
                  {disabled ? 'No slots left' : opt.desc}
                </p>
              </div>
              {itemType === opt.value && !disabled && <span className="ml-auto text-orange-500 font-bold">✓</span>}
            </label>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={!name.trim() || isOptionDisabled(itemType)}
          className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-orange-600 transition-colors"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
