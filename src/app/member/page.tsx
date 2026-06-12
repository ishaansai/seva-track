'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getEvents, getSignups, addSignup, removeSignup, getSlotsUsed,
  getCoordinator, getDefaultCoordinator, getAllCoordinators, getAllEvents, getAllSignups,
  isEventSignupOpen,
  SevaEvent, Signup, ItemType, itemTypeLabel, CoordinatorProfile,
} from '@/lib/db';
import { googleCalendarUrl, formatTime } from '@/lib/ics';

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

type SignupResult = { signup: Signup; event: SevaEvent };

function MemberPageInner() {
  const searchParams = useSearchParams();
  const coordParam  = searchParams.get('coord');
  const monthFilter = searchParams.get('month');

  const [coordId, setCoordId] = useState<string>('');
  const [coord, setCoord] = useState<CoordinatorProfile | null>(null);
  // coordsById maps coord_id → profile, used for multi-coordinator display
  const [coordsById, setCoordsById] = useState<Map<string, CoordinatorProfile>>(new Map());
  const [events, setEvents] = useState<SevaEvent[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [wantsMeals, setWantsMeals] = useState(true);
  const [wantsNutritional, setWantsNutritional] = useState(false);
  const [justSignedUp, setJustSignedUp] = useState<SignupResult | null>(null);
  // Track which event IDs THIS browser session signed up for (not all signups)
  const [mySignedUpEventIds, setMySignedUpEventIds] = useState<Set<string>>(new Set());
  const [signupLoading, setSignupLoading] = useState(false);
  const [view, setView]            = useState<'signup' | 'deliver'>('signup');
  const [deliverPhone, setDeliverPhone] = useState('');
  const [mySignups,      setMySignups]      = useState<Signup[] | null>(null);
  const [myPastSignups,  setMyPastSignups]  = useState<Signup[]>([]);
  const [findLoading,    setFindLoading]    = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      if (coordParam) {
        // Specific coordinator requested
        const profile = await getCoordinator(coordParam) ?? await getDefaultCoordinator();
        if (!profile) { setLoading(false); return; }
        const [evs, sups] = await Promise.all([getEvents(profile.id), getSignups(profile.id)]);
        setCoord(profile);
        setCoordId(profile.id);
        setCoordsById(new Map([[profile.id, profile]]));
        setEvents(evs);
        setSignups(sups);
      } else {
        // No coord param — load ALL coordinators and ALL their events
        const allCoords = await getAllCoordinators();
        const coordIds = allCoords.map(c => c.id);
        const [allEvs, allSups] = await Promise.all([
          getAllEvents(coordIds),
          getAllSignups(coordIds),
        ]);
        const map = new Map(allCoords.map(c => [c.id, c]));
        // Real coordinators (non-demo) for contact banner — pick the most recently added
        const realCoords = allCoords.filter(c => c.id !== 'seva2024');
        const contactCoord = realCoords.length > 0 ? realCoords[realCoords.length - 1] : allCoords[allCoords.length - 1];
        if (contactCoord) {
          setCoord(contactCoord);
          setCoordId(contactCoord.id);
        }
        setCoordsById(map);
        // Only show events whose coordinator exists in the map
        setEvents(allEvs.filter(e => map.has(e.coord_id)));
        setSignups(allSups);
      }
      setLoading(false);
    }
    load();
  }, [coordParam]);

  const today = new Date().toISOString().slice(0, 10);

  // Show events until 48 hours after the event date, then auto-hide
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 2);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  // Show ALL upcoming events — no month filter. Signup open/close controls what they can sign up for.
  let visibleEvents = events.filter(e => e.date >= cutoffStr);
  if (monthFilter) {
    visibleEvents = visibleEvents.filter(e => e.date.startsWith(monthFilter));
  }

  function getSlotInfo(event: SevaEvent) {
    const { mealBagUsed, nutritionalUsed } = getSlotsUsed(event.id, signups);
    return {
      mealBagAvail: Math.max(0, event.meal_bag_slots - mealBagUsed),
      nutritionalAvail: Math.max(0, event.nutritional_slots - nutritionalUsed),
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

  async function handleSignup(event: SevaEvent) {
    if (!name.trim() || !phone.trim()) return;
    const itemType = checkboxesToItemType();
    if (!itemType) return;
    setSignupLoading(true);
    try {
      const signup = await addSignup({
        event_id: event.id,
        coord_id: event.coord_id,
        member_name: name.trim(),
        member_phone: phone.replace(/\D/g, ''),
        item_type: itemType,
      });
      // Refresh all signups so slot counts stay accurate across coordinators
      const sups = coordParam
        ? await getSignups(event.coord_id)
        : await getAllSignups();
      setSignups(sups);
      setJustSignedUp({ signup, event });
      setMySignedUpEventIds(prev => new Set([...prev, event.id]));
      setShowForm(null);
      setName(''); setPhone(''); setWantsMeals(true); setWantsNutritional(false);
    } catch {
      alert('Could not sign up — you may already be signed up for this date.');
    } finally {
      setSignupLoading(false);
    }
  }

  async function handleFindDeliveries() {
    const cleaned = deliverPhone.replace(/\D/g, '');
    if (!cleaned) return;
    setFindLoading(true);
    const allSignups = coordParam ? await getSignups(coordId) : await getAllSignups();
    const mine = allSignups.filter(s => s.member_phone.replace(/\D/g, '') === cleaned);
    setMySignups(mine.filter(s => s.status === 'pending'));
    setMyPastSignups(mine.filter(s => s.status === 'delivered'));
    setFindLoading(false);
  }

  async function handleCancelSignup(signup: Signup, event: SevaEvent | undefined) {
    await removeSignup(signup.id);
    setMySignups(prev => prev ? prev.filter(s => s.id !== signup.id) : prev);
    if (coord?.phone) {
      const dateStr = event ? formatDate(event.date) : 'an event';
      const msg = encodeURIComponent(
        `Hi, ${signup.member_name} has cancelled their signup for ${dateStr} (${itemTypeLabel(signup.item_type)}). Please update the list.`
      );
      window.open(`https://wa.me/${coord.phone}?text=${msg}`, '_blank');
    }
  }

  function getGoogleCalUrl() {
    if (!justSignedUp) return '#';
    const { signup, event } = justSignedUp;
    return googleCalendarUrl(event.date, signup.member_name, itemTypeLabel(signup.item_type), event.drop_off_start, event.drop_off_end, event.drop_off_location);
  }

  // NOTE: intentionally NOT using all DB signups here — only this session's signups
  // so "You're signed up!" only shows to the person who actually signed up, not everyone

  // Detect if we're in the delivery week (Sunday through event day)
  const todayStr = today;
  const thisWeekEvents = events.filter(e => {
    const ed = new Date(e.date + 'T00:00:00');
    const dow = ed.getDay();
    const sunday = new Date(ed);
    sunday.setDate(sunday.getDate() - (dow === 0 ? 0 : dow));
    const sunStr = sunday.toISOString().slice(0, 10);
    return todayStr >= sunStr && todayStr <= e.date;
  });
  const isDeliveryWeek = thisWeekEvents.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-3">🍱</div>
          <p className="text-base">Loading…</p>
        </div>
      </div>
    );
  }

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
                    {formatDate(justSignedUp.event.date)} · {itemTypeLabel(justSignedUp.signup.item_type)}
                  </p>
                  <p className="text-green-600 text-sm mt-1">
                    📍 Drop off at: {justSignedUp.event.drop_off_location}
                  </p>
                  <p className="text-green-600 text-sm mt-0.5">
                    🕕 {formatTime(justSignedUp.event.drop_off_start)} – {formatTime(justSignedUp.event.drop_off_end)} · the day before delivery
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
                  <p className="font-semibold text-gray-800 text-base mb-1">Add to Calendar</p>
                  <p className="text-sm text-gray-400 mb-4">So you don&apos;t forget your delivery!</p>

                  <a
                    href={getGoogleCalUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
                    onClick={() => setTimeout(() => setJustSignedUp(null), 500)}
                  >
                    <span className="text-2xl">📅</span>
                    <div className="flex-1">
                      <p className="text-base font-bold text-blue-800">Add to Google Calendar</p>
                      <p className="text-sm text-blue-600">Opens Google Calendar to confirm</p>
                    </div>
                    <span className="text-blue-400 text-lg">↗</span>
                  </a>

                  <button onClick={() => setJustSignedUp(null)} className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 py-2">
                    Skip, no reminder
                  </button>
                </div>
              </div>
            )}

            {!justSignedUp && (
              <>
                {/* Delivery week: show who is delivering instead of signup UI */}
                {isDeliveryWeek && (
                  <div className="mt-4 space-y-3">
                    {thisWeekEvents.map(event => {
                      const evSignups = signups.filter(s => s.event_id === event.id);
                      const delivered = evSignups.filter(s => s.status === 'delivered').length;
                      return (
                        <div key={event.id} className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">🚐</span>
                            <div>
                              <p className="font-bold text-gray-800 text-base">Delivery is happening this week!</p>
                              <p className="text-sm text-purple-600 font-medium">{formatDate(event.date)}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 mb-3 flex-wrap">
                            <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">{delivered} delivered</span>
                            <span className="text-sm bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">{evSignups.length - delivered} pending</span>
                            <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">{evSignups.length} total</span>
                          </div>
                          {evSignups.length > 0 && (
                            <div className="space-y-1.5">
                              {evSignups.map((s) => (
                                <div key={s.id} className="flex items-center gap-2">
                                  <span className={s.status === 'delivered' ? 'text-green-500' : 'text-amber-400'}>{s.status === 'delivered' ? '✅' : '⏳'}</span>
                                  <p className="text-sm text-gray-700">{s.member_name} — {itemTypeLabel(s.item_type)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Signup open/close banner — computed from first visible event */}
                {visibleEvents.length > 0 && (() => {
                  const firstOpen = visibleEvents.find(e => {
                    const c = coordsById.get(e.coord_id);
                    return c ? isEventSignupOpen(e, c) : false;
                  });
                  if (firstOpen) {
                    const c = coordsById.get(firstOpen.coord_id)!;
                    const dow = new Date(firstOpen.date + 'T00:00:00').getDay();
                    const closeDate = new Date(firstOpen.date + 'T00:00:00');
                    closeDate.setDate(closeDate.getDate() - (dow === 0 ? 0 : dow));
                    closeDate.setHours(10, 0, 0);
                    const days = Math.max(0, Math.ceil((closeDate.getTime() - Date.now()) / 86400000));
                    return (
                      <div className="mt-4 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                        <span className="text-2xl">✅</span>
                        <div>
                          <p className="font-semibold text-green-800 text-base">Sign-ups are open!</p>
                          <p className="text-sm text-green-600 mt-0.5">
                            {days === 0 ? 'Closes today at 10am' : days === 1 ? 'Closes tomorrow at 10am' : `Closes in ${days} days`}
                            {c && coordsById.size > 1 ? ` · ${c.name}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  // All events closed — find next open date
                  const nextOpenEvent = visibleEvents[0];
                  if (!nextOpenEvent) return null;
                  const ed = new Date(nextOpenEvent.date + 'T00:00:00');
                  const em = ed.getMonth(), ey = ed.getFullYear();
                  const openDate = new Date(em === 0 ? ey-1 : ey, em === 0 ? 11 : em-1, 16);
                  return (
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
                      <p className="font-semibold text-blue-800 text-base">🗓 Sign-ups not open yet</p>
                      <p className="text-sm text-blue-600 mt-0.5">
                        Opens {openDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  );
                })()}

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
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-5xl mb-3">📅</div>
                    <p className="font-medium text-lg">No upcoming dates yet</p>
                    <p className="text-base mt-1">Check back when your coordinator posts new dates</p>
                  </div>
                ) : (
                  <div className="space-y-3 mt-4">
                    {/* Show coordinator name when there's exactly one real coordinator */}
                    {[...coordsById.values()].filter(c => c.id !== 'seva2024').length === 1 && coord && coord.id !== 'seva2024' && (
                      <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-orange-100 flex items-center gap-3">
                        <span className="text-2xl">🙏</span>
                        <div>
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Coordinator</p>
                          <p className="font-semibold text-gray-800 text-base">{coord.name}</p>
                        </div>
                      </div>
                    )}
                    <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide px-1">Upcoming Delivery Dates</p>

                    {visibleEvents.map(event => {
                      const slots = getSlotInfo(event);
                      const alreadyIn = mySignedUpEventIds.has(event.id);
                      const mySignup = signups.find(s => s.event_id === event.id && mySignedUpEventIds.has(event.id));
                      const totalSlots = event.meal_bag_slots + event.nutritional_slots;
                      const totalUsed = slots.mealBagUsed + slots.nutritionalUsed;
                      const isFull = slots.mealBagAvail === 0 && slots.nutritionalAvail === 0;
                      const eventCoord = coordsById.get(event.coord_id);

                      return (
                        <div key={event.id} className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              {coordsById.size > 1 && eventCoord && eventCoord.id !== 'seva2024' && (
                                <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide mb-0.5">🙏 {eventCoord.name}</p>
                              )}
                              <p className="font-semibold text-gray-800 text-base">{formatDate(event.date)}</p>
                              <p className="text-sm text-gray-500 mt-0.5">🕕 Drop off: {formatTime(event.drop_off_start)} – {formatTime(event.drop_off_end)}</p>
                              <p className="text-sm text-gray-500 mt-0.5">📍 {event.drop_off_location}</p>
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
                            <SlotBar label="Meal Bags" used={slots.mealBagUsed} total={event.meal_bag_slots} />
                            <SlotBar label="Nutritional" used={slots.nutritionalUsed} total={event.nutritional_slots} />
                          </div>

                          {/* Who's signed up so far */}
                          {(() => {
                            const evSignups = signups.filter(s => s.event_id === event.id);
                            if (evSignups.length === 0) return null;
                            return (
                              <div className="mb-3 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5">
                                <p className="text-xs font-semibold text-orange-700 mb-1.5">🙋 Signed up so far:</p>
                                <div className="space-y-1">
                                  {evSignups.map(s => (
                                    <div key={s.id} className="flex items-center gap-2">
                                      <span className="text-orange-400 text-xs">•</span>
                                      <p className="text-sm text-gray-700">{s.member_name} — {itemTypeLabel(s.item_type)}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {alreadyIn ? (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                              <span className="text-green-500">✓</span>
                              <div>
                                <p className="text-green-700 font-medium text-base">You&apos;re signed up!</p>
                                {mySignup && <p className="text-green-600 text-sm">{itemTypeLabel(mySignup.item_type)}</p>}
                              </div>
                            </div>
                          ) : isFull ? (
                            <div className="text-center py-2 text-base text-red-400 font-medium">All slots filled</div>
                          ) : !eventCoord || !isEventSignupOpen(event, eventCoord) ? (
                            // Signups closed for this event — show who is delivering
                            (() => {
                              const evSignups = signups.filter(s => s.event_id === event.id);
                              if (evSignups.length === 0) return <div className="text-center py-2 text-sm text-gray-400">Signups closed</div>;
                              return (
                                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                                  <p className="text-xs font-semibold text-purple-700 mb-2">🔒 Signups closed — delivering this week:</p>
                                  <div className="space-y-1">
                                    {evSignups.map(s => (
                                      <div key={s.id} className="flex items-center gap-2">
                                        <span className={`text-xs ${s.status === 'delivered' ? 'text-green-500' : 'text-amber-400'}`}>
                                          {s.status === 'delivered' ? '✅' : '⏳'}
                                        </span>
                                        <p className="text-sm text-gray-700">{s.member_name} — {itemTypeLabel(s.item_type)}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()
                          ) : showForm === event.id ? (
                            <SignupForm
                              slots={slots}
                              name={name} setName={setName}
                              phone={phone} setPhone={setPhone}
                              wantsMeals={wantsMeals} setWantsMeals={setWantsMeals}
                              wantsNutritional={wantsNutritional} setWantsNutritional={setWantsNutritional}
                              loading={signupLoading}
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
                <button onClick={handleFindDeliveries} disabled={findLoading} className="bg-orange-500 text-white px-5 py-3 rounded-xl text-base font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors">
                  {findLoading ? '…' : 'Find'}
                </button>
              </div>
            </div>

            {mySignups !== null && mySignups.length === 0 && myPastSignups.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <div className="text-4xl mb-2">🔍</div>
                <p className="font-medium text-lg">No deliveries found</p>
                <p className="text-base mt-1">Make sure you enter the phone number you signed up with</p>
              </div>
            )}

            {mySignups && mySignups.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide px-1">Your Pending Deliveries</p>
                {mySignups.map(signup => {
                  const event = events.find(e => e.id === signup.event_id);
                  return (
                    <div key={signup.id} className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800 text-base">{event ? formatDate(event.date) : 'Unknown date'}</p>
                          <p className="text-base text-orange-600 mt-0.5">{itemTypeLabel(signup.item_type)}</p>
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
            {myPastSignups.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide px-1">Your Delivery History</p>
                {myPastSignups.map(signup => {
                  const event = events.find(e => e.id === signup.event_id);
                  const bags  = signup.item_type === 'meals'       || signup.item_type === 'both' ? 20 : 0;
                  const nutri = signup.item_type === 'nutritional' || signup.item_type === 'both' ? 1  : 0;
                  return (
                    <div key={signup.id} className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-green-500 font-bold">✓</span>
                          <p className="font-semibold text-gray-800 text-base">{event ? formatDate(event.date) : 'Past delivery'}</p>
                        </div>
                        <p className="text-sm text-orange-600 mt-0.5">{itemTypeLabel(signup.item_type)}</p>
                        {signup.delivered_at && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Delivered {new Date(signup.delivered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-3 flex-shrink-0">
                        {bags > 0 && (
                          <div className="text-right">
                            <p className="text-xl font-bold text-purple-600">{bags}</p>
                            <p className="text-xs text-gray-400">bags</p>
                          </div>
                        )}
                        {nutri > 0 && (
                          <div className="text-right">
                            <p className="text-xl font-bold text-teal-600">{nutri}</p>
                            <p className="text-xs text-gray-400">nutritional</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3 text-center">
                  <p className="text-sm font-semibold text-purple-700">
                    🫶 {myPastSignups.reduce((sum, s) => sum + (s.item_type === 'meals' || s.item_type === 'both' ? 20 : 0), 0)} meal bags
                    {myPastSignups.some(s => s.item_type === 'nutritional' || s.item_type === 'both') && (
                      <span className="text-teal-600"> · {myPastSignups.filter(s => s.item_type === 'nutritional' || s.item_type === 'both').length} nutritional</span>
                    )} delivered
                  </p>
                </div>
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
  loading, onConfirm, onCancel,
}: {
  slots: { mealBagAvail: number; nutritionalAvail: number };
  name: string; setName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  wantsMeals: boolean; setWantsMeals: (v: boolean) => void;
  wantsNutritional: boolean; setWantsNutritional: (v: boolean) => void;
  loading: boolean;
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
            <p className="text-base font-semibold text-gray-700">20 Meal Bags</p>
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
        <button onClick={onConfirm} disabled={!canConfirm || loading} className="flex-1 py-3 rounded-xl bg-orange-500 text-white text-base font-semibold disabled:opacity-40 hover:bg-orange-600 transition-colors">
          {loading ? 'Signing up…' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}
