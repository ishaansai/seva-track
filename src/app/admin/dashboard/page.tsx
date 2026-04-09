'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getEvents, getSignups, addEvent, deleteEvent, updateEvent,
  addSignup, adminMarkDelivered, removeSignup, getSlotsUsed,
  SevaEvent, Signup, ItemType, itemTypeLabel, DEFAULT_LOCATION,
} from '@/lib/store';
import { formatTime } from '@/lib/ics';

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
}

function EventCard({ event, delivered, total, mealBagUsed, nutritionalUsed, onClick, past }: {
  event: SevaEvent; delivered: number; total: number;
  mealBagUsed: number; nutritionalUsed: number;
  onClick: () => void; past?: boolean;
}) {
  const pct = total > 0 ? (delivered / total) * 100 : 0;
  return (
    <button onClick={onClick} className={`w-full text-left bg-white rounded-2xl p-4 shadow-sm border transition-colors hover:border-orange-200 ${past ? 'border-gray-100 opacity-60' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-1">
        <p className={`font-semibold text-base ${past ? 'text-gray-500' : 'text-gray-800'}`}>{formatShortDate(event.date)}</p>
        <span className="text-orange-400">→</span>
      </div>
      <p className="text-sm text-gray-400 mb-1">Drop off: {formatTime(event.dropOffStart)} – {formatTime(event.dropOffEnd)}</p>
      <p className="text-sm text-gray-400 mb-2 truncate">📍 {event.dropOffLocation}</p>
      {event.note && <p className="text-sm text-orange-600 mb-2 font-medium">📌 {event.note}</p>}
      <div className="flex gap-3 mb-2 flex-wrap">
        <span className="text-sm text-gray-500">🛍 {event.mealBagSlots - mealBagUsed}/{event.mealBagSlots} left</span>
        <span className="text-sm text-gray-500">🥗 {event.nutritionalSlots - nutritionalUsed}/{event.nutritionalSlots} left</span>
      </div>
      <div className="flex gap-3 flex-wrap">
        <span className="text-sm text-green-600 font-medium">{delivered} delivered</span>
        <span className="text-sm text-amber-600 font-medium">{total - delivered} pending</span>
        <span className="text-sm text-gray-400">{total} total</span>
      </div>
      {total > 0 && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      )}
    </button>
  );
}

function SlotBar({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <p className="text-sm text-gray-500 w-20 flex-shrink-0">{label}</p>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-gray-500 w-16 text-right flex-shrink-0">{used}/{total} filled</p>
    </div>
  );
}

// Item type picker used in admin forms (two checkboxes → ItemType)
function ItemTypePicker({
  wantsMeals, setWantsMeals, wantsNutritional, setWantsNutritional,
}: {
  wantsMeals: boolean; setWantsMeals: (v: boolean) => void;
  wantsNutritional: boolean; setWantsNutritional: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-2">
      <label className={`flex-1 flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer text-sm font-semibold transition-colors ${wantsMeals ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
        <input type="checkbox" checked={wantsMeals} onChange={e => setWantsMeals(e.target.checked)} className="w-4 h-4 accent-orange-500" />
        🛍 Meal Bags
      </label>
      <label className={`flex-1 flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer text-sm font-semibold transition-colors ${wantsNutritional ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
        <input type="checkbox" checked={wantsNutritional} onChange={e => setWantsNutritional(e.target.checked)} className="w-4 h-4 accent-orange-500" />
        🥗 Nutritional
      </label>
    </div>
  );
}

function checkboxesToItemType(meals: boolean, nutritional: boolean): ItemType | null {
  if (meals && nutritional) return 'both';
  if (meals) return 'meals';
  if (nutritional) return 'nutritional';
  return null;
}

function downloadCsv(events: SevaEvent[], signups: Signup[]) {
  const rows: string[][] = [
    ['Date', 'Member Name', 'Phone', 'Item Type', 'Status', 'Signed Up At', 'Delivered At', 'Drop-Off Location'],
  ];
  for (const signup of signups) {
    const event = events.find(e => e.id === signup.eventId);
    rows.push([
      event?.date ?? '',
      signup.memberName,
      signup.memberContact,
      itemTypeLabel(signup.itemType),
      signup.status,
      signup.signedUpAt ? new Date(signup.signedUpAt).toLocaleString() : '',
      signup.deliveredAt ? new Date(signup.deliveredAt).toLocaleString() : '',
      event?.dropOffLocation ?? '',
    ]);
  }
  const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `seva-signups-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const router = useRouter();
  const [events, setEvents] = useState<SevaEvent[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [view, setView] = useState<'events' | 'create' | 'logistics'>('events');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [memberUrl, setMemberUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);

  // Create form
  const [newDates, setNewDates] = useState(['', '', '', '']);
  const [mealBagSlots, setMealBagSlots] = useState(7);
  const [nutritionalSlots, setNutritionalSlots] = useState(3);
  const [dropOffStart, setDropOffStart] = useState('18:00');
  const [dropOffEnd, setDropOffEnd] = useState('21:00');
  const [dropOffLocation, setDropOffLocation] = useState(DEFAULT_LOCATION);
  const [newNote, setNewNote] = useState('');

  // Edit state
  const [editingSlots, setEditingSlots] = useState(false);
  const [editMealBag, setEditMealBag] = useState(7);
  const [editNutritional, setEditNutritional] = useState(3);
  const [editDropStart, setEditDropStart] = useState('18:00');
  const [editDropEnd, setEditDropEnd] = useState('21:00');
  const [editLocation, setEditLocation] = useState(DEFAULT_LOCATION);
  const [editNote, setEditNote] = useState('');

  // Add member form
  const [addName, setAddName] = useState('');
  const [addContact, setAddContact] = useState('');
  const [addMeals, setAddMeals] = useState(true);
  const [addNutritional, setAddNutritional] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!sessionStorage.getItem('seva_admin')) { router.push('/admin'); return; }
    refresh();
    setMemberUrl(window.location.origin + '/member');
  }, [router]);

  function refresh() {
    setEvents(getEvents().sort((a, b) => a.date.localeCompare(b.date)));
    setSignups(getSignups());
  }

  function handleCopyMonthLink() {
    const month = new Date().toISOString().slice(0, 7);
    const url = `${memberUrl}?month=${month}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCreateEvents() {
    const validDates = newDates.filter(d => d.trim());
    if (validDates.length === 0) return;
    validDates.forEach(date => addEvent({
      date, title: '', mealBagSlots, nutritionalSlots,
      dropOffStart, dropOffEnd,
      dropOffLocation: dropOffLocation.trim() || DEFAULT_LOCATION,
      note: newNote.trim() || undefined,
    }));
    setNewDates(['', '', '', '']);
    setNewNote('');
    setDropOffLocation(DEFAULT_LOCATION);
    refresh();
    setView('events');
  }

  function handleDeleteEvent(id: string) {
    if (!confirm('Delete this date and all its signups?')) return;
    deleteEvent(id);
    refresh();
    setSelectedEvent(null);
  }

  function openEvent(event: SevaEvent) {
    setSelectedEvent(event.id);
    setEditMealBag(event.mealBagSlots);
    setEditNutritional(event.nutritionalSlots);
    setEditDropStart(event.dropOffStart);
    setEditDropEnd(event.dropOffEnd);
    setEditLocation(event.dropOffLocation);
    setEditNote(event.note ?? '');
    setEditingSlots(false);
    setShowNudge(false);
    setShowAddMember(false);
  }

  function saveEventEdits(id: string) {
    updateEvent(id, {
      mealBagSlots: editMealBag,
      nutritionalSlots: editNutritional,
      dropOffStart: editDropStart,
      dropOffEnd: editDropEnd,
      dropOffLocation: editLocation.trim() || DEFAULT_LOCATION,
      note: editNote.trim() || undefined,
    });
    refresh();
    setEditingSlots(false);
  }

  function handleAdminMarkDelivered(signupId: string) {
    adminMarkDelivered(signupId);
    refresh();
  }

  function handleRemoveSignup(signupId: string) {
    if (!confirm('Remove this signup?')) return;
    removeSignup(signupId);
    refresh();
  }

  function handleAddMember(eventId: string) {
    if (!addName.trim()) return;
    const itemType = checkboxesToItemType(addMeals, addNutritional);
    if (!itemType) return;
    addSignup({ eventId, memberName: addName.trim(), memberContact: addContact.trim(), itemType, addedByAdmin: true });
    setAddName(''); setAddContact(''); setAddMeals(true); setAddNutritional(false);
    setShowAddMember(false);
    refresh();
  }

  function handleCopySummary() {
    const lines: string[] = ['Seva Commons Delivery Summary', ''];
    const today = new Date().toISOString().slice(0, 10);
    const relevantEvents = events.filter(e => e.date >= today.slice(0, 7));
    relevantEvents.forEach(event => {
      const evSignups = signups.filter(s => s.eventId === event.id);
      const delivered = evSignups.filter(s => s.status === 'delivered').length;
      lines.push(`📅 ${formatDate(event.date)}`);
      if (evSignups.length === 0) {
        lines.push('  No signups yet');
      } else {
        evSignups.forEach(s => {
          const status = s.status === 'delivered' ? '✓' : '⏳';
          lines.push(`  ${status} ${s.memberName} — ${itemTypeLabel(s.itemType)}`);
        });
        lines.push(`  ${delivered}/${evSignups.length} delivered`);
      }
      lines.push('');
    });
    const total = signups.length;
    const totalDelivered = signups.filter(s => s.status === 'delivered').length;
    lines.push(`Total: ${total} signed up | ${totalDelivered} delivered | ${total - totalDelivered} pending`);
    navigator.clipboard.writeText(lines.join('\n'));
    setSummaryCopied(true);
    setTimeout(() => setSummaryCopied(false), 2500);
  }

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const upcomingEvents = events.filter(e => e.date >= today);
  const pastEvents = events.filter(e => e.date < today);
  const totalSignups = signups.length;
  const totalDelivered = signups.filter(s => s.status === 'delivered').length;

  const eventSignups = (eventId: string) => signups.filter(s => s.eventId === eventId);
  const deliveredCount = (id: string) => signups.filter(s => s.eventId === id && s.status === 'delivered').length;

  const selectedEventData = events.find(e => e.id === selectedEvent);
  const selectedSignups = selectedEvent ? eventSignups(selectedEvent) : [];
  const pendingSignups = selectedSignups.filter(s => s.status === 'pending');

  const monthLinkUrl = `${memberUrl}?month=${currentMonth}`;
  const waMsg = encodeURIComponent(`Hey! Sign up for this month's Seva Commons meal bag delivery dates:\n${monthLinkUrl}`);
  const waUrl = `https://wa.me/?text=${waMsg}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="font-bold text-gray-900 text-lg">Seva Track</h1>
          <p className="text-sm text-gray-400">Coordinator Dashboard</p>
        </div>
        <button onClick={() => { sessionStorage.removeItem('seva_admin'); router.push('/admin'); }} className="text-sm text-gray-400 hover:text-gray-600">Logout</button>
      </header>

      {/* Stats */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex gap-6 overflow-x-auto">
        {[
          { label: 'Upcoming', value: upcomingEvents.length, color: 'text-orange-600' },
          { label: 'Total Signups', value: totalSignups, color: 'text-orange-600' },
          { label: 'Delivered', value: totalDelivered, color: 'text-green-600' },
          { label: 'Pending', value: totalSignups - totalDelivered, color: 'text-amber-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center min-w-[72px]">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-sm text-gray-400 whitespace-nowrap">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200">
        {([['events', 'Delivery Dates'], ['create', '+ Add Dates'], ['logistics', 'Logistics']] as const).map(([key, label]) => (
          <button key={key} onClick={() => { setView(key); setSelectedEvent(null); }}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${view === key ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto p-4">

        {/* ── EVENTS LIST ── */}
        {view === 'events' && !selectedEvent && (
          <div className="space-y-3 mt-2">
            {/* Share card */}
            <div className="bg-orange-500 rounded-2xl p-4 text-white">
              <p className="font-bold text-base mb-0.5">Member Sign-Up Link</p>
              <p className="text-orange-100 text-sm mb-3">This month&apos;s link — only shows current month&apos;s dates</p>
              <div className="bg-white/20 rounded-xl px-3 py-2 flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-mono truncate">{monthLinkUrl}</p>
                <button onClick={handleCopyMonthLink} className="flex-shrink-0 bg-white text-orange-600 text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-orange-50">
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <a href={waUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white text-base font-semibold py-2.5 rounded-xl transition-colors">
                <span>💬</span> Share via WhatsApp
              </a>
            </div>

            {/* Export + Summary row */}
            <div className="flex gap-2">
              {totalSignups > 0 && (
                <button onClick={handleCopySummary}
                  className="flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-800">Copy Summary</p>
                    <p className="text-xs text-gray-400">All signups + status</p>
                  </div>
                  <span className="text-sm text-orange-500 font-medium">{summaryCopied ? '✓' : '📋'}</span>
                </button>
              )}
              {totalSignups > 0 && (
                <button onClick={() => downloadCsv(events, signups)}
                  className="flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-800">Export CSV</p>
                    <p className="text-xs text-gray-400">For records / taxes</p>
                  </div>
                  <span className="text-sm text-orange-500 font-medium">⬇</span>
                </button>
              )}
            </div>

            {events.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <div className="text-5xl mb-3">📅</div>
                <p className="font-medium text-lg">No delivery dates yet</p>
                <button onClick={() => setView('create')} className="mt-3 text-orange-500 text-base font-medium">Add dates →</button>
              </div>
            ) : (
              <>
                {upcomingEvents.length > 0 && (
                  <>
                    <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide px-1">Upcoming</p>
                    {upcomingEvents.map(event => {
                      const { mealBagUsed, nutritionalUsed } = getSlotsUsed(event.id, signups);
                      return <EventCard key={event.id} event={event} delivered={deliveredCount(event.id)} total={eventSignups(event.id).length} mealBagUsed={mealBagUsed} nutritionalUsed={nutritionalUsed} onClick={() => openEvent(event)} />;
                    })}
                  </>
                )}
                {pastEvents.length > 0 && (
                  <>
                    <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide px-1 mt-4">Past</p>
                    {pastEvents.map(event => {
                      const { mealBagUsed, nutritionalUsed } = getSlotsUsed(event.id, signups);
                      return <EventCard key={event.id} event={event} delivered={deliveredCount(event.id)} total={eventSignups(event.id).length} mealBagUsed={mealBagUsed} nutritionalUsed={nutritionalUsed} onClick={() => openEvent(event)} past />;
                    })}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── EVENT DETAIL ── */}
        {view === 'events' && selectedEvent && selectedEventData && (
          <div className="mt-2 space-y-4">
            <button onClick={() => setSelectedEvent(null)} className="text-orange-500 text-base font-medium">← All dates</button>

            {/* Header card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-bold text-gray-800 text-lg">{formatDate(selectedEventData.date)}</h2>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">{deliveredCount(selectedEvent)} delivered</span>
                    <span className="text-sm bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">{selectedSignups.length - deliveredCount(selectedEvent)} pending</span>
                    <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">{selectedSignups.length} total</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <button onClick={() => handleDeleteEvent(selectedEvent)} className="text-sm text-red-400 hover:text-red-600">Delete</button>
                  <button onClick={() => setEditingSlots(!editingSlots)} className="text-sm text-orange-500 font-medium">{editingSlots ? 'Cancel' : 'Edit'}</button>
                </div>
              </div>

              {editingSlots ? (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">🛍 Meal Bag Slots</label>
                      <input type="number" min={1} value={editMealBag} onChange={e => setEditMealBag(Number(e.target.value))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">🥗 Nutritional Slots</label>
                      <input type="number" min={1} value={editNutritional} onChange={e => setEditNutritional(Number(e.target.value))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">Drop-Off Start</label>
                      <input type="time" value={editDropStart} onChange={e => setEditDropStart(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">Drop-Off End</label>
                      <input type="time" value={editDropEnd} onChange={e => setEditDropEnd(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">📍 Drop-Off Location</label>
                    <input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder={DEFAULT_LOCATION} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">📌 Note for members (optional)</label>
                    <input type="text" placeholder="e.g. Please bring extra bags this week" value={editNote} onChange={e => setEditNote(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                  <button onClick={() => saveEventEdits(selectedEvent)} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl text-base font-semibold">Save Changes</button>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                  <SlotBar label="Meal Bags" used={getSlotsUsed(selectedEvent, signups).mealBagUsed} total={selectedEventData.mealBagSlots} />
                  <SlotBar label="Nutritional" used={getSlotsUsed(selectedEvent, signups).nutritionalUsed} total={selectedEventData.nutritionalSlots} />
                  <p className="text-sm text-gray-400 mt-1">Drop-off: {formatTime(selectedEventData.dropOffStart)} – {formatTime(selectedEventData.dropOffEnd)}</p>
                  <p className="text-sm text-gray-400">📍 {selectedEventData.dropOffLocation}</p>
                  {selectedEventData.note && <p className="text-sm text-orange-600 font-medium">📌 {selectedEventData.note}</p>}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button onClick={() => { setShowAddMember(!showAddMember); setShowNudge(false); }}
                className={`flex-1 py-3 rounded-xl text-base font-semibold border transition-colors ${showAddMember ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50'}`}>
                + Add Member
              </button>
              {pendingSignups.length > 0 && (
                <button onClick={() => { setShowNudge(!showNudge); setShowAddMember(false); }}
                  className={`flex-1 py-3 rounded-xl text-base font-semibold border transition-colors ${showNudge ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'}`}>
                  📞 Nudge ({pendingSignups.length})
                </button>
              )}
            </div>

            {/* Add member form */}
            {showAddMember && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-200 space-y-3">
                <p className="font-semibold text-gray-800 text-base">Add Member Manually</p>
                <input type="text" placeholder="Name *" value={addName} onChange={e => setAddName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400" />
                <input type="tel" placeholder="Phone / WhatsApp" value={addContact} onChange={e => setAddContact(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400" />
                <ItemTypePicker wantsMeals={addMeals} setWantsMeals={setAddMeals} wantsNutritional={addNutritional} setWantsNutritional={setAddNutritional} />
                {!addMeals && !addNutritional && <p className="text-sm text-red-500">Select at least one item type</p>}
                <button onClick={() => handleAddMember(selectedEvent)} disabled={!addName.trim() || (!addMeals && !addNutritional)}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white py-3 rounded-xl text-base font-semibold">
                  Add to List
                </button>
              </div>
            )}

            {/* Nudge view */}
            {showNudge && pendingSignups.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                <p className="font-semibold text-amber-800 text-base">⏳ Still pending — reach out:</p>
                {pendingSignups.map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-amber-100">
                    <div>
                      <p className="font-semibold text-gray-800 text-base">{s.memberName}</p>
                      <p className="text-sm text-orange-600">{itemTypeLabel(s.itemType)}</p>
                    </div>
                    <div className="flex gap-2">
                      {s.memberContact && (
                        <>
                          <a href={`tel:${s.memberContact}`}
                            className="bg-green-100 text-green-700 text-sm px-3 py-2 rounded-lg font-medium hover:bg-green-200">
                            📞 Call
                          </a>
                          <a href={`https://wa.me/${s.memberContact.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                            className="bg-green-500 text-white text-sm px-3 py-2 rounded-lg font-medium hover:bg-green-600">
                            💬 WA
                          </a>
                        </>
                      )}
                      {!s.memberContact && <p className="text-sm text-gray-400">No contact</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Members list */}
            {selectedSignups.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-base"><p>No signups yet — add one above</p></div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide px-1">Members</p>
                {selectedSignups
                  .sort((a, b) => (a.status === 'delivered' ? 1 : 0) - (b.status === 'delivered' ? 1 : 0))
                  .map(signup => (
                    <div key={signup.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base flex-shrink-0 font-bold ${signup.status === 'delivered' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                          {signup.status === 'delivered' ? '✓' : '⏳'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-gray-800 text-base">{signup.memberName}</p>
                              {signup.addedByAdmin && <span className="text-sm text-gray-400">Added by admin</span>}
                            </div>
                            <span className={`text-sm px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${signup.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-600'}`}>
                              {signup.status === 'delivered' ? 'Delivered' : 'Pending'}
                            </span>
                          </div>
                          <p className="text-sm text-orange-600 mt-0.5">{itemTypeLabel(signup.itemType)}</p>
                          {signup.memberContact && <p className="text-sm text-gray-400 mt-0.5">📞 {signup.memberContact}</p>}
                          {signup.deliveredAt && (
                            <p className="text-sm text-gray-400 mt-0.5">
                              {new Date(signup.deliveredAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                      {signup.deliveryPhotoUrl && (
                        <div className="mt-3 rounded-xl overflow-hidden border border-green-100">
                          <img src={signup.deliveryPhotoUrl} alt="Delivery" className="w-full max-h-52 object-cover" />
                        </div>
                      )}
                      {/* Admin actions */}
                      <div className="flex gap-2 mt-3">
                        {signup.status === 'pending' && (
                          <button onClick={() => handleAdminMarkDelivered(signup.id)}
                            className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-semibold py-2.5 rounded-xl border border-green-200 transition-colors">
                            ✓ Mark Delivered
                          </button>
                        )}
                        <button onClick={() => handleRemoveSignup(signup.id)}
                          className="px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-600 border border-gray-100 hover:bg-red-50 transition-colors">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── CREATE DATES ── */}
        {view === 'create' && (
          <div className="mt-2">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-800 text-lg mb-1">Add Delivery Dates</h2>
              <p className="text-sm text-gray-400 mb-4">Settings apply to all dates below</p>
              <div className="space-y-2 mb-4">
                {newDates.map((date, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 w-14 flex-shrink-0">Date {i + 1}</span>
                    <input type="date" value={date} onChange={e => { const u = [...newDates]; u[i] = e.target.value; setNewDates(u); }}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-orange-400" />
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide mb-3">Slot Limits</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">🛍 Meal Bag Slots</label>
                    <input type="number" min={1} value={mealBagSlots} onChange={e => setMealBagSlots(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">🥗 Nutritional Slots</label>
                    <input type="number" min={1} value={nutritionalSlots} onChange={e => setNutritionalSlots(Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-orange-400" />
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide mb-3">Drop-Off Window</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">Start Time</label>
                    <input type="time" value={dropOffStart} onChange={e => setDropOffStart(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">End Time</label>
                    <input type="time" value={dropOffEnd} onChange={e => setDropOffEnd(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-orange-400" />
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide mb-3">Drop-Off Location</p>
                <input type="text" value={dropOffLocation} onChange={e => setDropOffLocation(e.target.value)} placeholder={DEFAULT_LOCATION}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-orange-400" />
                <p className="text-sm text-gray-400 mt-1.5">Default: {DEFAULT_LOCATION}</p>
              </div>
              <div className="border-t border-gray-100 pt-4 mb-5">
                <label className="text-sm text-gray-500 font-semibold uppercase tracking-wide block mb-2">📌 Note for Members (optional)</label>
                <input type="text" placeholder="e.g. Please bring extra brown bags this week" value={newNote} onChange={e => setNewNote(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-orange-400" />
              </div>
              <button onClick={handleCreateEvents} disabled={newDates.every(d => !d)}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white py-3.5 rounded-xl font-semibold text-base">
                Create Dates
              </button>
            </div>
          </div>
        )}

        {/* ── LOGISTICS ── */}
        {view === 'logistics' && (
          <div className="mt-2 space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex gap-3 items-start">
              <span className="text-xl flex-shrink-0">✅</span>
              <div>
                <p className="font-bold text-green-800 text-base">Auto-loaded from PDF</p>
                <p className="text-sm text-green-700 mt-0.5">Members always see the latest guide at <span className="font-mono">/logistics</span>. To update, replace <span className="font-mono">public/logistics.pdf</span>.</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="font-semibold text-gray-800 text-base">Meal Bags Seva Logistics</p>
                <a href="/logistics.pdf" target="_blank" className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg font-medium">Open ↗</a>
              </div>
              <iframe src="/logistics.pdf" className="w-full" style={{ height: '60vh' }} title="Logistics PDF" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
