'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  getEvents, getSignups, addEvent, deleteEvent, updateEvent,
  addSignup, adminMarkDelivered, undoDelivery, confirmDelivery, removeSignup, deleteMember, getSlotsUsed,
  getCoordinator, getCoordinatorByUserId, updateCoordinator,
  updateCoordinatorPassword, signOutCoordinator,
  getMemberContributions, setMemberAdjustment, downloadCsv,
  SevaEvent, Signup, ItemType, itemTypeLabel, CoordinatorProfile, MemberContribution,
} from '@/lib/db';
import { supabase } from '@/lib/supabase';
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
      <p className="text-sm text-gray-400 mb-1">Drop off: {formatTime(event.drop_off_start)} – {formatTime(event.drop_off_end)}</p>
      <p className="text-sm text-gray-400 mb-2 truncate">📍 {event.drop_off_location}</p>
      {event.note && <p className="text-sm text-orange-600 mb-2 font-medium">📌 {event.note}</p>}
      <div className="flex gap-3 mb-2 flex-wrap">
        <span className="text-sm text-gray-500">🛍 {event.meal_bag_slots - mealBagUsed}/{event.meal_bag_slots} left</span>
        <span className="text-sm text-gray-500">🥗 {event.nutritional_slots - nutritionalUsed}/{event.nutritional_slots} left</span>
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

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const ORDINALS  = ['','1st','2nd','3rd','4th'];

function getWeekdayPattern(dateStr: string): { day: number; n: number } {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const dom = d.getDate();
  const n   = Math.ceil(dom / 7);
  const check = new Date(d);
  check.setDate(dom + 7);
  return { day, n: check.getMonth() !== d.getMonth() ? -1 : n };
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  if (n === -1) {
    const last = new Date(year, month + 1, 0);
    return new Date(year, month, last.getDate() - (last.getDay() - weekday + 7) % 7);
  }
  const first = new Date(year, month, 1);
  return new Date(year, month, 1 + (weekday - first.getDay() + 7) % 7 + (n - 1) * 7);
}

function getPatternLabel(dateStr: string): string {
  if (!dateStr) return '';
  const { day, n } = getWeekdayPattern(dateStr);
  const ord = n === -1 ? 'Last' : (ORDINALS[n] ?? `${n}th`);
  return `${ord} ${DAY_NAMES[day]} of each month`;
}

function get5thWeekdayOfMonth(year: number, month: number, weekday: number): string | null {
  const candidate = getNthWeekdayOfMonth(year, month, weekday, 5);
  if (candidate.getMonth() !== month) return null;
  return candidate.toISOString().slice(0, 10);
}

function getRecurringPreview(dateStr: string, months: number, include5th = false): string[] {
  if (!dateStr) return [];
  const { day, n } = getWeekdayPattern(dateStr);
  const base  = new Date(dateStr + 'T00:00:00');
  const dates = [dateStr];
  for (let m = 1; m < months; m++) {
    const tm   = base.getMonth() + m;
    const yr   = base.getFullYear() + Math.floor(tm / 12);
    const mo   = tm % 12;
    const d    = getNthWeekdayOfMonth(yr, mo, day, n);
    dates.push(d.toISOString().slice(0, 10));
    if (include5th) {
      const fifth = get5thWeekdayOfMonth(yr, mo, day);
      if (fifth && fifth !== d.toISOString().slice(0, 10)) dates.push(fifth);
    }
  }
  // also check 5th for the base month
  if (include5th) {
    const fifth = get5thWeekdayOfMonth(base.getFullYear(), base.getMonth(), day);
    if (fifth && fifth !== dateStr) dates.splice(1, 0, fifth);
  }
  return dates.sort();
}

export default function AdminDashboard() {
  const router = useRouter();
  const [coordId, setCoordId] = useState('');
  const [coord, setCoord] = useState<CoordinatorProfile | null>(null);
  const [events, setEvents] = useState<SevaEvent[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [contributions, setContributions] = useState<MemberContribution[]>([]);

  // CSV export month filter
  const [csvMonth, setCsvMonth] = useState('');

  // Manual adjustment edit state
  const [editingMember, setEditingMember]         = useState<string | null>(null); // member_phone
  const [adjMealBags,   setAdjMealBags]           = useState(0);
  const [adjNutritional, setAdjNutritional]       = useState(0);
  const [adjNote,       setAdjNote]               = useState('');
  const [adjSaving,     setAdjSaving]             = useState(false);
  const [view, setView] = useState<'events' | 'create' | 'members' | 'settings' | 'logistics'>('events');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [memberUrl, setMemberUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Create form
  const [newDates, setNewDates] = useState(['', '', '', '']);
  const [newNotes, setNewNotes] = useState(['', '', '', '']); // keep 4 default slots for familiarity
  const [mealBagSlots, setMealBagSlots] = useState(7);
  const [nutritionalSlots, setNutritionalSlots] = useState(3);
  const [dropOffStart, setDropOffStart] = useState('18:00');
  const [dropOffEnd, setDropOffEnd] = useState('21:00');
  const [dropOffLocation, setDropOffLocation] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  // Recurring events
  const [repeatMonthly, setRepeatMonthly] = useState(false);
  const [repeatMonths, setRepeatMonths] = useState(3);
  const [include5th, setInclude5th] = useState(false);

  // Edit event state
  const [editingSlots, setEditingSlots] = useState(false);
  const [editMealBag, setEditMealBag] = useState(7);
  const [editNutritional, setEditNutritional] = useState(3);
  const [editDropStart, setEditDropStart] = useState('18:00');
  const [editDropEnd, setEditDropEnd] = useState('21:00');
  const [editLocation, setEditLocation] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Add member form
  const [addName, setAddName] = useState('');
  const [addContact, setAddContact] = useState('');
  const [addMeals, setAddMeals] = useState(true);
  const [addNutritional, setAddNutritional] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  // Settings form
  const [settingsName, setSettingsName] = useState('');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [settingsPhone, setSettingsPhone] = useState('');
  const [settingsAddress, setSettingsAddress] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Share list modal
  const [showShareList, setShowShareList] = useState(false);
  const [shareListCopied, setShareListCopied] = useState(false);

  // Signup window settings
  const [signupOpenDay, setSignupOpenDay] = useState(15);
  const [signupOpenOverride, setSignupOpenOverride] = useState('');
  const [signupCloseOverride, setSignupCloseOverride] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/admin'); return; }
      const profile = await getCoordinatorByUserId(session.user.id);
      if (!profile) { router.push('/admin'); return; }
      setCoordId(profile.id);
      const base = window.location.origin + '/member';
      setMemberUrl(`${base}?coord=${profile.id}`);
      loadAll(profile.id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (coord) setDropOffLocation(coord.address);
  }, [coord]);

  async function loadAll(cid: string) {
    setLoading(true);
    const [profile, evs, sups, contribs] = await Promise.all([
      getCoordinator(cid),
      getEvents(cid),
      getSignups(cid),
      getMemberContributions(cid),
    ]);
    if (!profile) { router.push('/admin'); return; }
    setCoord(profile);
    setSettingsName(profile.name);
    setSettingsPhone(profile.phone);
    setSettingsAddress(profile.address);
    setSignupOpenDay(profile.signup_open_day ?? 15);
    setSignupOpenOverride(profile.signup_open_override ?? '');
    setSignupCloseOverride(profile.signup_close_override ?? '');
    setEvents(evs.sort((a, b) => a.date.localeCompare(b.date)));
    setSignups(sups);
    setContributions(contribs);
    setLoading(false);
  }

  async function refresh(cid?: string) {
    const id = cid ?? coordId;
    const [evs, sups, contribs] = await Promise.all([
      getEvents(id),
      getSignups(id),
      getMemberContributions(id),
    ]);
    setEvents(evs.sort((a, b) => a.date.localeCompare(b.date)));
    setSignups(sups);
    setContributions(contribs);
  }

  function handleCopyMonthLink() {
    const month = new Date().toISOString().slice(0, 7);
    const url = `${memberUrl}&month=${month}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCreateEvents() {
    const validRows = newDates
      .map((date, i) => ({ date, note: newNotes[i] }))
      .filter(r => r.date.trim());
    if (validRows.length === 0) return;
    setCreateLoading(true);

    const allEvents: { date: string; note: string }[] = [];
    for (const { date, note } of validRows) {
      allEvents.push({ date, note });
      if (repeatMonthly) {
        const { day, n } = getWeekdayPattern(date);
        const base = new Date(date + 'T00:00:00');
        if (include5th) {
          const fifth = get5thWeekdayOfMonth(base.getFullYear(), base.getMonth(), day);
          if (fifth && fifth !== date) allEvents.push({ date: fifth, note });
        }
        for (let m = 1; m < repeatMonths; m++) {
          const tm = base.getMonth() + m;
          const yr = base.getFullYear() + Math.floor(tm / 12);
          const mo = tm % 12;
          const next = getNthWeekdayOfMonth(yr, mo, day, n);
          allEvents.push({ date: next.toISOString().slice(0, 10), note });
          if (include5th) {
            const fifth = get5thWeekdayOfMonth(yr, mo, day);
            if (fifth && fifth !== next.toISOString().slice(0, 10)) allEvents.push({ date: fifth, note });
          }
        }
      }
    }

    await Promise.all(allEvents.map(({ date, note }) => addEvent({
      date,
      meal_bag_slots: mealBagSlots,
      nutritional_slots: nutritionalSlots,
      drop_off_start: dropOffStart,
      drop_off_end: dropOffEnd,
      drop_off_location: dropOffLocation.trim() || coord?.address || '',
      note: note.trim() || undefined,
    }, coordId)));

    setNewDates(['', '', '', '']);
    setNewNotes(['', '', '', '']);
    setRepeatMonthly(false);
    setRepeatMonths(3);
    setInclude5th(false);
    setDropOffLocation(coord?.address || '');
    await refresh();
    setCreateLoading(false);
    setView('events');
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm('Delete this date and all its signups?')) return;
    try {
      await deleteEvent(id);
      await refresh();
      setSelectedEvent(null);
    } catch (e) {
      alert('Delete failed — ' + (e instanceof Error ? e.message : 'unknown error'));
    }
  }

  function openEvent(event: SevaEvent) {
    setSelectedEvent(event.id);
    setEditMealBag(event.meal_bag_slots);
    setEditNutritional(event.nutritional_slots);
    setEditDropStart(event.drop_off_start);
    setEditDropEnd(event.drop_off_end);
    setEditLocation(event.drop_off_location);
    setEditNote(event.note ?? '');
    setEditingSlots(false);
    setShowNudge(false);
    setShowAddMember(false);
    setShowShareList(false);
  }

  async function saveEventEdits(id: string) {
    setEditSaving(true);
    await updateEvent(id, {
      meal_bag_slots: editMealBag,
      nutritional_slots: editNutritional,
      drop_off_start: editDropStart,
      drop_off_end: editDropEnd,
      drop_off_location: editLocation.trim() || coord?.address || '',
      note: editNote.trim() || undefined,
    });
    await refresh();
    setEditSaving(false);
    setEditingSlots(false);
  }

  async function handleAdminMarkDelivered(signupId: string) {
    await adminMarkDelivered(signupId);
    await refresh();
  }

  async function handleUndoDelivery(signupId: string) {
    if (!confirm('Undo this delivery? It will go back to pending.')) return;
    await undoDelivery(signupId);
    await refresh();
  }

  async function handleConfirmDelivery(signupId: string) {
    await confirmDelivery(signupId);
    await refresh();
  }

  async function handleRemoveSignup(signupId: string) {
    if (!confirm('Remove this signup?')) return;
    await removeSignup(signupId);
    await refresh();
  }

  async function handleDeleteMember(memberPhone: string, memberName: string) {
    if (!confirm(`Remove ${memberName} and all their signup history? This cannot be undone.`)) return;
    if (!coord) return;
    await deleteMember(coord.id, memberPhone);
    await refresh();
  }

  async function handleAddMember(eventId: string) {
    if (!addName.trim()) return;
    const itemType = checkboxesToItemType(addMeals, addNutritional);
    if (!itemType) return;
    setAddLoading(true);
    await addSignup({
      event_id: eventId,
      coord_id: coordId,
      member_name: addName.trim(),
      member_phone: addContact.trim(),
      item_type: itemType,
      added_by_admin: true,
    });
    setAddName(''); setAddContact(''); setAddMeals(true); setAddNutritional(false);
    setShowAddMember(false);
    await refresh();
    setAddLoading(false);
  }

  async function handleSaveSettings() {
    if (!settingsName.trim()) return;
    setSettingsLoading(true);
    try {
      // Save profile fields
      await updateCoordinator(coordId, {
        name:    settingsName.trim(),
        phone:   settingsPhone.replace(/\D/g, ''),
        address: settingsAddress.trim(),
        signup_open_day:      signupOpenDay,
        signup_open_override:  signupOpenOverride.trim()  || null,
        signup_close_override: signupCloseOverride.trim() || null,

      });
      // Change password separately via Supabase Auth (only if provided)
      if (settingsPassword.trim()) {
        await updateCoordinatorPassword(settingsPassword.trim());
      }
      const updated = await getCoordinator(coordId);
      if (updated) setCoord(updated);
      setSettingsPassword('');
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
    } finally {
      setSettingsLoading(false);
    }
  }

  function openAdjustEditor(c: MemberContribution) {
    setEditingMember(c.member_phone);
    setAdjMealBags(c.meal_bag_adjustment ?? 0);
    setAdjNutritional(c.nutritional_adjustment ?? 0);
    setAdjNote(c.adjustment_note ?? '');
  }

  async function handleSaveAdjustment(c: MemberContribution) {
    setAdjSaving(true);
    try {
      await setMemberAdjustment({
        coord_id:              coordId,
        member_phone:          c.member_phone,
        member_name:           c.member_name,
        meal_bag_adjustment:   adjMealBags,
        nutritional_adjustment: adjNutritional,
        note:                  adjNote.trim(),
      });
      await refresh();
      setEditingMember(null);
    } finally {
      setAdjSaving(false);
    }
  }

  function handleCopySummary() {
    const lines: string[] = [`Seva Commons Delivery Summary – ${coord?.name ?? ''}`, ''];
    const today = new Date().toISOString().slice(0, 10);
    const relevantEvents = events.filter(e => e.date >= today.slice(0, 7));
    relevantEvents.forEach(event => {
      const evSignups = signups.filter(s => s.event_id === event.id);
      const delivered = evSignups.filter(s => s.status === 'delivered').length;
      lines.push(`📅 ${formatDate(event.date)}`);
      if (evSignups.length === 0) {
        lines.push('  No signups yet');
      } else {
        evSignups.forEach(s => {
          const status = s.status === 'delivered' ? '✓' : '⏳';
          lines.push(`  ${status} ${s.member_name} — ${itemTypeLabel(s.item_type)}`);
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

  function buildShareText(event: SevaEvent, eventSignupList: Signup[]): string {
    const lines: string[] = [];
    lines.push(`📅 Seva Commons — ${formatDate(event.date)}`);
    lines.push(`📍 Drop-off: ${formatTime(event.drop_off_start)}–${formatTime(event.drop_off_end)} · ${event.drop_off_location}`);
    if (event.note) lines.push(`📌 ${event.note}`);
    lines.push('');
    const delivered = eventSignupList.filter(s => s.status === 'delivered').length;
    lines.push(`✅ ${delivered} delivered · ⏳ ${eventSignupList.length - delivered} pending`);
    lines.push('');
    eventSignupList
      .sort((a, b) => (a.status === 'delivered' ? 1 : 0) - (b.status === 'delivered' ? 1 : 0))
      .forEach((s, i) => {
        const icon = s.status === 'delivered' ? '✅' : '⏳';
        lines.push(`${i + 1}. ${s.member_name} — ${itemTypeLabel(s.item_type)} ${icon}`);
      });
    lines.push('');
    lines.push('🫶 via Seva Track');
    return lines.join('\n');
  }

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const upcomingEvents = events.filter(e => e.date >= today);
  const pastEvents = events.filter(e => e.date < today);
  const totalSignups = signups.length;
  const isDone = (s: Signup) => s.status === 'delivered' || s.status === 'confirmed';
  const totalDelivered = signups.filter(isDone).length;
  const totalMealBags = contributions.reduce((sum, c) => sum + Number(c.total_meal_bags), 0);
  const totalNutritional = contributions.reduce((sum, c) => sum + Number(c.nutritional_deliveries), 0);

  const eventSignups = (eventId: string) => signups.filter(s => s.event_id === eventId);
  const deliveredCount = (id: string) => signups.filter(s => s.event_id === id && isDone(s)).length;

  // This week: Sunday → Saturday containing today
  const todayDate = new Date();
  const weekStart = new Date(todayDate);
  weekStart.setDate(todayDate.getDate() - todayDate.getDay()); // Sunday
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Saturday
  weekEnd.setHours(23, 59, 59, 999);

  const thisWeekEvents = events.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d >= weekStart && d <= weekEnd;
  });
  const pendingConfirmations = signups.filter(s =>
    s.status === 'delivered' &&
    s.delivery_photo_url &&
    thisWeekEvents.some(e => e.id === s.event_id)
  );

  const selectedEventData = events.find(e => e.id === selectedEvent);
  const selectedSignups = selectedEvent ? eventSignups(selectedEvent) : [];
  const pendingSignups = selectedSignups.filter(s => s.status === 'pending');

  const monthLinkUrl = `${memberUrl}&month=${currentMonth}`;
  const waMsg = encodeURIComponent(`Hey! Sign up for this month's Seva Commons meal bag delivery dates:\n${monthLinkUrl}`);
  const waUrl = `https://wa.me/?text=${waMsg}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-3">🍱</div>
          <p className="text-base">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (!coord) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="font-bold text-gray-900 text-lg">Seva Track</h1>
          <p className="text-sm text-gray-400 truncate max-w-[180px]">{coord.name}</p>
        </div>
        <button onClick={async () => { await signOutCoordinator(); router.push('/admin'); }} className="text-sm text-gray-400 hover:text-gray-600">Logout</button>
      </header>

      {/* Stats */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex gap-4 overflow-x-auto">
        {[
          { label: 'Upcoming', value: upcomingEvents.length, color: 'text-orange-600' },
          { label: 'Signups', value: totalSignups, color: 'text-orange-600' },
          { label: 'Delivered', value: totalDelivered, color: 'text-green-600' },
          { label: 'Pending', value: totalSignups - totalDelivered, color: 'text-amber-500' },
          { label: 'Meal Bags', value: totalMealBags, color: 'text-purple-600' },
          { label: 'Nutritional', value: totalNutritional, color: 'text-teal-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center min-w-[60px]">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 whitespace-nowrap">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200 overflow-x-auto">
        {([['events', 'Dates'], ['create', '+ Add'], ['members', 'Members'], ['settings', 'Settings'], ['logistics', 'Logistics']] as const).map(([key, label]) => (
          <button key={key} onClick={() => { setView(key); setSelectedEvent(null); }}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors whitespace-nowrap px-2 ${view === key ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto p-4">

        {/* ── EVENTS LIST ── */}
        {view === 'events' && !selectedEvent && (
          <div className="space-y-3 mt-2">
            {/* Delivery week banner */}
            {(() => {
              const todayStr2 = new Date().toISOString().slice(0, 10);
              const thisWeek = events.filter(e => {
                const ed = new Date(e.date + 'T00:00:00');
                const dow = ed.getDay();
                const sun = new Date(ed);
                sun.setDate(sun.getDate() - (dow === 0 ? 0 : dow));
                return todayStr2 >= sun.toISOString().slice(0, 10) && todayStr2 <= e.date;
              });
              if (thisWeek.length === 0) return null;
              return (
                <div className="bg-purple-500 rounded-2xl p-4 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🚐</span>
                    <p className="font-bold text-base">Delivery Week!</p>
                  </div>
                  {thisWeek.map(e => {
                    const evSups = signups.filter(s => s.event_id === e.id);
                    const del = evSups.filter(s => s.status === 'delivered').length;
                    return (
                      <div key={e.id} className="mt-1">
                        <p className="text-purple-100 text-sm">{formatShortDate(e.date)} · {evSups.length} signed up · {del} delivered · {evSups.length - del} pending</p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* ── Confirm Deliveries (this week) ── */}
            {pendingConfirmations.length > 0 && (
              <div className="bg-white rounded-2xl border border-green-200 shadow-sm overflow-hidden">
                <div className="bg-green-500 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white text-base">📸 Confirm This Week&apos;s Deliveries</p>
                    <p className="text-green-100 text-sm">{pendingConfirmations.length} photo{pendingConfirmations.length > 1 ? 's' : ''} waiting for your confirmation</p>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {pendingConfirmations.map(s => {
                    const ev = thisWeekEvents.find(e => e.id === s.event_id);
                    return (
                      <div key={s.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-semibold text-gray-800">{s.member_name}</p>
                            <p className="text-sm text-orange-600">{itemTypeLabel(s.item_type)}{ev ? ` · ${formatShortDate(ev.date)}` : ''}</p>
                          </div>
                          <button
                            onClick={() => handleConfirmDelivery(s.id)}
                            className="bg-green-500 hover:bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors active:scale-95 flex-shrink-0"
                          >
                            ✓ Confirm
                          </button>
                        </div>
                        {s.delivery_photo_url && (
                          <div className="rounded-xl overflow-hidden border border-green-100">
                            <Image src={s.delivery_photo_url} alt="Delivery proof" width={600} height={300} unoptimized className="w-full max-h-64 object-cover" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-orange-500 rounded-2xl p-4 text-white">
              <p className="font-bold text-base mb-0.5">Member Sign-Up Link</p>
              <p className="text-orange-100 text-sm mb-3">This month only — share with your volunteers</p>
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
                <div className="flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Export CSV</p>
                      <p className="text-xs text-gray-400">For records / taxes</p>
                    </div>
                    <button onClick={() => downloadCsv(events, signups, csvMonth || undefined)}
                      className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors">
                      ⬇ Export
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={csvMonth} onChange={e => setCsvMonth(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-orange-400">
                      <option value="">All time</option>
                      {Array.from(new Set(events.map(e => e.date.slice(0, 7)))).sort().reverse().map(m => (
                        <option key={m} value={m}>
                          {new Date(m + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
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
                  <button onClick={() => { setShowShareList(true); setShareListCopied(false); }} className="text-sm text-blue-500 font-medium">📋 Share</button>
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
                    <input type="text" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder={coord.address} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">📌 Note for members</label>
                    <input type="text" placeholder="e.g. Please bring extra bags this week" value={editNote} onChange={e => setEditNote(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                  <button onClick={() => saveEventEdits(selectedEvent)} disabled={editSaving} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-3 rounded-xl text-base font-semibold">
                    {editSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                  <SlotBar label="Meal Bags" used={getSlotsUsed(selectedEvent, signups).mealBagUsed} total={selectedEventData.meal_bag_slots} />
                  <SlotBar label="Nutritional" used={getSlotsUsed(selectedEvent, signups).nutritionalUsed} total={selectedEventData.nutritional_slots} />
                  <p className="text-sm text-gray-400 mt-1">Drop-off: {formatTime(selectedEventData.drop_off_start)} – {formatTime(selectedEventData.drop_off_end)}</p>
                  <p className="text-sm text-gray-400">📍 {selectedEventData.drop_off_location}</p>
                  {selectedEventData.note && <p className="text-sm text-orange-600 font-medium">📌 {selectedEventData.note}</p>}
                </div>
              )}
            </div>

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

            {showAddMember && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-200 space-y-3">
                <p className="font-semibold text-gray-800 text-base">Add Member Manually</p>
                <input type="text" placeholder="Name *" value={addName} onChange={e => setAddName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400" />
                <input type="text" inputMode="numeric" placeholder="Phone" value={addContact} onChange={e => setAddContact(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400" />
                <ItemTypePicker wantsMeals={addMeals} setWantsMeals={setAddMeals} wantsNutritional={addNutritional} setWantsNutritional={setAddNutritional} />
                {!addMeals && !addNutritional && <p className="text-sm text-red-500">Select at least one item type</p>}
                <button onClick={() => handleAddMember(selectedEvent)} disabled={!addName.trim() || (!addMeals && !addNutritional) || addLoading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white py-3 rounded-xl text-base font-semibold">
                  {addLoading ? 'Adding…' : 'Add to List'}
                </button>
              </div>
            )}

            {showNudge && pendingSignups.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                <p className="font-semibold text-amber-800 text-base">⏳ Still pending — reach out:</p>
                {pendingSignups.map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-amber-100">
                    <div>
                      <p className="font-semibold text-gray-800 text-base">{s.member_name}</p>
                      <p className="text-sm text-orange-600">{itemTypeLabel(s.item_type)}</p>
                    </div>
                    <div className="flex gap-2">
                      {s.member_phone ? (
                        <>
                          <a href={`tel:${s.member_phone}`} className="bg-green-100 text-green-700 text-sm px-3 py-2 rounded-lg font-medium hover:bg-green-200">📞 Call</a>
                          <a href={`https://wa.me/${s.member_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="bg-green-500 text-white text-sm px-3 py-2 rounded-lg font-medium hover:bg-green-600">💬 WA</a>
                        </>
                      ) : <p className="text-sm text-gray-400">No contact</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Send Reminders — shown when signups just closed (Sunday 10am through delivery day) */}
            {(() => {
              if (!selectedEventData) return null;
              const ed = new Date(selectedEventData.date + 'T00:00:00');
              const dow = ed.getDay();
              const sunday = new Date(ed);
              sunday.setDate(sunday.getDate() - (dow === 0 ? 0 : dow));
              sunday.setHours(10, 0, 0);
              const now = new Date();
              const signupsClosed = now >= sunday && now <= ed;
              if (!signupsClosed || selectedSignups.length === 0) return null;
              return (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3">
                  <div>
                    <p className="font-bold text-purple-800 text-base">📨 Signups closed — send reminders</p>
                    <p className="text-sm text-purple-600 mt-0.5">{selectedSignups.length} volunteers signed up for this week</p>
                  </div>
                  {/* Group message to copy for WA group */}
                  <div>
                    <p className="text-xs font-semibold text-purple-700 mb-1">Copy for WhatsApp group:</p>
                    <pre className="text-xs text-gray-700 bg-white rounded-xl p-3 border border-purple-100 whitespace-pre-wrap font-mono leading-relaxed">
{`🫶 Reminder — Seva Commons delivery is this ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][ed.getDay()]}!

Drop-off: ${formatTime(selectedEventData.drop_off_start)}–${formatTime(selectedEventData.drop_off_end)} · ${selectedEventData.drop_off_location}

This week's volunteers:
${selectedSignups.map((s,i) => `${i+1}. ${s.member_name} — ${itemTypeLabel(s.item_type)}`).join('\n')}

Thank you for your seva! 🙏`}
                    </pre>
                    <button
                      onClick={() => {
                        const msg = `🫶 Reminder — Seva Commons delivery is this ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][ed.getDay()]}!\n\nDrop-off: ${formatTime(selectedEventData.drop_off_start)}–${formatTime(selectedEventData.drop_off_end)} · ${selectedEventData.drop_off_location}\n\nThis week's volunteers:\n${selectedSignups.map((s,i) => `${i+1}. ${s.member_name} — ${itemTypeLabel(s.item_type)}`).join('\n')}\n\nThank you for your seva! 🙏`;
                        navigator.clipboard.writeText(msg);
                      }}
                      className="mt-2 w-full bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      📋 Copy Group Message
                    </button>
                  </div>
                  {/* Individual WA links */}
                  <div>
                    <p className="text-xs font-semibold text-purple-700 mb-2">Or message individually:</p>
                    <div className="space-y-2">
                      {selectedSignups.filter(s => s.member_phone).map(s => (
                        <a
                          key={s.id}
                          href={`https://wa.me/${s.member_phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hi ${s.member_name}! 🫶 Just a reminder — your Seva Commons meal bag delivery is this ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][ed.getDay()]}. Drop-off: ${formatTime(selectedEventData.drop_off_start)}–${formatTime(selectedEventData.drop_off_end)} at ${selectedEventData.drop_off_location}. Thank you! 🙏`)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-between bg-white border border-purple-100 rounded-xl px-3 py-2.5 hover:bg-purple-50 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{s.member_name}</p>
                            <p className="text-xs text-gray-400">{itemTypeLabel(s.item_type)}</p>
                          </div>
                          <span className="text-[#25D366] font-bold text-sm">💬 WA</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Share List Modal */}
            {showShareList && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-blue-800 text-base">📋 Share Signup List</p>
                  <button onClick={() => setShowShareList(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
                </div>
                <pre className="text-xs text-gray-700 bg-white rounded-xl p-3 border border-blue-100 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {buildShareText(selectedEventData, selectedSignups)}
                </pre>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(buildShareText(selectedEventData, selectedSignups));
                      setShareListCopied(true);
                      setTimeout(() => setShareListCopied(false), 2500);
                    }}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    {shareListCopied ? '✓ Copied!' : '📋 Copy Text'}
                  </button>
                  <a
                    href={`https://wa.me/${coord?.phone ?? ''}?text=${encodeURIComponent(buildShareText(selectedEventData, selectedSignups))}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    💬 Send via WA
                  </a>
                </div>
              </div>
            )}

            {selectedSignups.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-base"><p>No signups yet — add one above</p></div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide px-1">Members</p>
                {selectedSignups
                  .sort((a, b) => (isDone(a) ? 1 : 0) - (isDone(b) ? 1 : 0))
                  .map(signup => (
                    <div key={signup.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base flex-shrink-0 font-bold ${isDone(signup) ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                          {signup.status === 'confirmed' ? '✅' : isDone(signup) ? '✓' : '⏳'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-gray-800 text-base">{signup.member_name}</p>
                              {signup.added_by_admin && <span className="text-sm text-gray-400">Added by admin</span>}
                            </div>
                            <span className={`text-sm px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${signup.status === 'confirmed' ? 'bg-green-200 text-green-800' : isDone(signup) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-600'}`}>
                              {signup.status === 'confirmed' ? '✅ Confirmed' : isDone(signup) ? 'Delivered' : 'Pending'}
                            </span>
                          </div>
                          <p className="text-sm text-orange-600 mt-0.5">{itemTypeLabel(signup.item_type)}</p>
                          {signup.member_phone && <p className="text-sm text-gray-400 mt-0.5">📞 {signup.member_phone}</p>}
                          {signup.delivered_at && (
                            <p className="text-sm text-gray-400 mt-0.5">
                              {new Date(signup.delivered_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                      {signup.delivery_photo_url && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-400 font-medium mb-1.5">📸 Delivery Photo</p>
                          <div className="rounded-xl overflow-hidden border border-green-200">
                            <Image src={signup.delivery_photo_url} alt="Delivery proof" width={600} height={208} unoptimized className="w-full max-h-52 object-cover" />
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 mt-3">
                        {signup.status === 'pending' ? (
                          <button onClick={() => handleAdminMarkDelivered(signup.id)}
                            className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-semibold py-2.5 rounded-xl border border-green-200 transition-colors">
                            ✓ Mark Delivered
                          </button>
                        ) : signup.status === 'confirmed' ? (
                          <button onClick={() => handleUndoDelivery(signup.id)}
                            className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-500 text-sm font-semibold py-2.5 rounded-xl border border-gray-200 transition-colors">
                            ↩ Undo Confirm
                          </button>
                        ) : (
                          <button onClick={() => handleUndoDelivery(signup.id)}
                            className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm font-semibold py-2.5 rounded-xl border border-amber-200 transition-colors">
                            ↩ Undo Delivery
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
              <div className="space-y-3 mb-4">
                {newDates.map((date, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400 w-14 flex-shrink-0">Date {i+1}</span>
                      <input type="date" value={date}
                        onChange={e => { const u=[...newDates]; u[i]=e.target.value; setNewDates(u); }}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-orange-400" />
                      {newDates.length > 1 && (
                        <button onClick={() => { setNewDates(d => d.filter((_,j) => j !== i)); setNewNotes(n => n.filter((_,j) => j !== i)); }}
                          className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none">✕</button>
                      )}
                    </div>
                    {date && (
                      <input type="text" placeholder="📌 Note for this date (optional)"
                        value={newNotes[i]}
                        onChange={e => { const u=[...newNotes]; u[i]=e.target.value; setNewNotes(u); }}
                        className="ml-[68px] w-[calc(100%-68px)] border border-orange-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-orange-50 placeholder-orange-300" />
                    )}
                  </div>
                ))}
                <button onClick={() => { setNewDates(d => [...d, '']); setNewNotes(n => [...n, '']); }}
                  className="ml-[68px] text-sm text-orange-500 font-medium hover:text-orange-600 transition-colors">
                  + Add date
                </button>
              </div>
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide mb-3">Slot Limits</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">🛍 Meal Bag Slots</label>
                    <input type="number" min={1} value={mealBagSlots} onChange={e => setMealBagSlots(Number(e.target.value))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">🥗 Nutritional Slots</label>
                    <input type="number" min={1} value={nutritionalSlots} onChange={e => setNutritionalSlots(Number(e.target.value))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-orange-400" />
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide mb-3">Drop-Off Window</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">Start Time</label>
                    <input type="time" value={dropOffStart} onChange={e => setDropOffStart(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">End Time</label>
                    <input type="time" value={dropOffEnd} onChange={e => setDropOffEnd(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-orange-400" />
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-sm text-gray-500 font-semibold uppercase tracking-wide mb-3">Drop-Off Location</p>
                <input type="text" value={dropOffLocation} onChange={e => setDropOffLocation(e.target.value)} placeholder={coord.address}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-orange-400" />
                <p className="text-sm text-gray-400 mt-1.5">Default: {coord.address}</p>
              </div>
              {/* Recurring monthly — smart weekday pattern */}
              <div className="border-t border-gray-100 pt-4 mb-5">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setRepeatMonthly(v => !v)}
                    className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 relative ${repeatMonthly ? 'bg-orange-500' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${repeatMonthly ? 'left-5' : 'left-0.5'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">🔁 Repeat monthly (same weekday)</p>
                    <p className="text-xs text-gray-400">e.g. every 1st Tuesday — keeps the right day of week each month</p>
                  </div>
                </label>
                {repeatMonthly && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-gray-500 flex-shrink-0">For</p>
                      <select
                        value={repeatMonths}
                        onChange={e => setRepeatMonths(Number(e.target.value))}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                      >
                        {[2,3,4,5,6].map(n => (
                          <option key={n} value={n}>{n} months</option>
                        ))}
                      </select>
                      <p className="text-sm text-gray-400">months in a row</p>
                    </div>
                    {/* 5th weekday option */}
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div
                        onClick={() => setInclude5th(v => !v)}
                        className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${include5th ? 'bg-orange-500' : 'bg-gray-200'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${include5th ? 'left-4' : 'left-0.5'}`} />
                      </div>
                      <p className="text-sm text-gray-600">Include 5th {newDates.find(d => d) ? DAY_NAMES[getWeekdayPattern(newDates.find(d => d)!).day] : 'weekday'} when available</p>
                    </label>

                    {/* Preview per filled date */}
                    {newDates.some(d => d) && (
                      <div className="space-y-2">
                        {newDates.filter(d => d).map(dateStr => {
                          const preview = getRecurringPreview(dateStr, repeatMonths, include5th);
                          const label   = getPatternLabel(dateStr);
                          return (
                            <div key={dateStr} className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                              <p className="text-xs font-semibold text-orange-700 mb-1">🔁 {label}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {preview.map(d => (
                                  <span key={d} className="text-xs bg-white border border-orange-200 text-orange-700 px-2 py-0.5 rounded-full">
                                    {new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button onClick={handleCreateEvents} disabled={newDates.every(d => !d) || createLoading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white py-3.5 rounded-xl font-semibold text-base">
                {createLoading ? 'Creating…' : repeatMonthly
                  ? `Create ${newDates.filter(d => d).length * repeatMonths} Dates (${repeatMonths} months)`
                  : 'Create Dates'}
              </button>
            </div>
          </div>
        )}

        {/* ── MEMBERS ── */}
        {view === 'members' && (
          <div className="mt-2 space-y-3">
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
              <p className="font-bold text-purple-800 text-base">🫙 Volunteer Contributions</p>
              <p className="text-sm text-purple-600 mt-0.5">{contributions.length} volunteers · {totalMealBags} meal bags{totalNutritional > 0 ? ` · ${totalNutritional} nutritional` : ''} delivered</p>
            </div>

            {contributions.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <div className="text-5xl mb-3">👥</div>
                <p className="font-medium text-lg">No contributions yet</p>
                <p className="text-sm mt-1">Members will appear here once deliveries are marked</p>
              </div>
            ) : (
              <div className="space-y-2">
                {contributions.map((c, i) => {
                  const isEditing = editingMember === c.member_phone;
                  return (
                    <div key={`${c.member_phone}-${i}`} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-base truncate">{c.member_name}</p>
                          {c.member_phone && <p className="text-sm text-gray-400">{c.member_phone}</p>}
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="flex gap-3 flex-shrink-0">
                            <div className="text-right">
                              <p className="text-xl font-bold text-purple-600">{c.total_meal_bags}</p>
                              <p className="text-xs text-gray-400">meal bags</p>
                            </div>
                            {Number(c.nutritional_deliveries) > 0 && (
                              <div className="text-right">
                                <p className="text-xl font-bold text-teal-600">{c.nutritional_deliveries}</p>
                                <p className="text-xs text-gray-400">nutritional</p>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => isEditing ? setEditingMember(null) : openAdjustEditor(c)}
                              className="text-xs text-gray-400 hover:text-orange-500 border border-gray-200 rounded-lg px-2 py-1 mt-0.5 transition-colors"
                            >
                              {isEditing ? 'Cancel' : '✏️ Edit'}
                            </button>
                            <button
                              onClick={() => handleDeleteMember(c.member_phone, c.member_name)}
                              className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg px-2 py-1 mt-0.5 transition-colors"
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-2 flex-wrap">
                        <span className="text-sm text-green-600 font-medium">✓ {c.total_delivered} delivered</span>
                        <span className="text-sm text-gray-400">{c.total_signups} signed up</span>
                        {Number(c.meal_bag_deliveries) > 0 && (
                          <span className="text-sm text-orange-600">🛍 {c.meal_bag_deliveries}× meal bags</span>
                        )}
                        {Number(c.nutritional_deliveries) > 0 && (
                          <span className="text-sm text-teal-600">🥗 {c.nutritional_deliveries}× nutritional</span>
                        )}
                      </div>

                      {c.adjustment_note && (
                        <p className="text-xs text-gray-400 italic mt-1">{c.adjustment_note}</p>
                      )}

                      <p className="text-xs text-gray-300 mt-1.5">
                        First: {c.first_signup ? new Date(c.first_signup).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                        {' · '}
                        Last: {c.last_signup ? new Date(c.last_signup).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                      </p>

                      {/* Inline adjustment editor */}
                      {isEditing && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                          <p className="text-sm font-semibold text-gray-700">Manual adjustment (adds to auto total)</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">🛍 Meal bags ±</label>
                              <input
                                type="number"
                                value={adjMealBags}
                                onChange={e => setAdjMealBags(Number(e.target.value))}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">🥗 Nutritional ±</label>
                              <input
                                type="number"
                                value={adjNutritional}
                                onChange={e => setAdjNutritional(Number(e.target.value))}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                              />
                            </div>
                          </div>
                          <input
                            type="text"
                            placeholder="Note (optional) e.g. brought extra bags in Dec"
                            value={adjNote}
                            onChange={e => setAdjNote(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                          />
                          <button
                            onClick={() => handleSaveAdjustment(c)}
                            disabled={adjSaving}
                            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
                          >
                            {adjSaving ? 'Saving…' : 'Save Adjustment'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {view === 'settings' && (
          <div className="mt-2 space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Chapter Settings</h2>
                <p className="text-sm text-gray-400 mt-0.5">Your members see your address and contact info</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500 font-medium block mb-1">Chapter / Coordinator Name</label>
                  <input type="text" value={settingsName} onChange={e => setSettingsName(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-medium block mb-1">📞 Your Phone Number</label>
                  <input type="text" inputMode="numeric" value={settingsPhone} onChange={e => setSettingsPhone(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400" />
                  <p className="text-xs text-gray-400 mt-1">Members see a Call and WhatsApp button (number not displayed)</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-medium block mb-1">📍 Default Drop-Off Address</label>
                  <input type="text" value={settingsAddress} onChange={e => setSettingsAddress(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400" />
                  <p className="text-xs text-gray-400 mt-1">Used as default for new events (can still override per event)</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500 font-medium block mb-1">🔐 Change Password (leave blank to keep current)</label>
                  <input type="password" placeholder="New password" value={settingsPassword} onChange={e => setSettingsPassword(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-orange-400" />
                </div>
              </div>
            </div>

            {/* Signup Window */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              <div>
                <h2 className="font-bold text-gray-800 text-base">📅 Sign-Up Window</h2>
                <p className="text-sm text-gray-400 mt-0.5">Controls when members can sign up</p>
              </div>

              {/* Auto mode status */}
              {!(signupOpenOverride || signupCloseOverride) ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-500 font-bold text-base">🤖</span>
                    <p className="font-semibold text-green-800 text-sm">Auto Mode is ON</p>
                  </div>
                  {(() => {
                    const win = events.length > 0 && coord ? (() => {
                      const todayStr = new Date().toISOString().slice(0, 10);
                      const upcoming = events.filter(e => e.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date));
                      if (!upcoming.length) return null;
                      const ed = new Date(upcoming[0].date + 'T00:00:00');
                      const dow = ed.getDay();
                      const close = new Date(ed); close.setDate(close.getDate() - (dow === 0 ? 0 : dow));
                      const em = ed.getMonth(); const ey = ed.getFullYear();
                      const open = new Date(em === 0 ? ey-1 : ey, em === 0 ? 11 : em-1, 16);
                      return { open, close };
                    })() : null;
                    return win ? (
                      <p className="text-xs text-green-700">
                        Opens <strong>{win.open.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>
                        {' · '}Closes <strong>{win.close.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>
                        {' '}(Sunday before next delivery)
                      </p>
                    ) : (
                      <p className="text-xs text-green-700">Opens 16th of previous month · Closes Sunday of delivery week</p>
                    );
                  })()}
                  <button
                    onClick={() => setSignupOpenOverride('2000-01-01')}
                    className="mt-2 text-xs text-green-600 underline hover:text-green-800"
                  >
                    Set manual override instead →
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-amber-800 text-sm">⚠️ Manual Override Active</p>
                      <p className="text-xs text-amber-700 mt-0.5">Auto mode is off — using custom dates below</p>
                    </div>
                    <button
                      onClick={async () => {
                        setSignupOpenOverride('');
                        setSignupCloseOverride('');
                        await updateCoordinator(coordId, {
                          signup_open_override: null,
                          signup_close_override: null,
                        });
                        const updated = await getCoordinator(coordId);
                        if (updated) setCoord(updated);
                        setSettingsSaved(true);
                        setTimeout(() => setSettingsSaved(false), 2500);
                      }}
                      className="flex-shrink-0 bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
                    >
                      🤖 Switch to Auto
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Open date</label>
                      <input type="date" value={signupOpenOverride === '2000-01-01' ? '' : signupOpenOverride}
                        onChange={e => setSignupOpenOverride(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Close date</label>
                      <input type="date" value={signupCloseOverride}
                        onChange={e => setSignupCloseOverride(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400" />
                    </div>
                  </div>
                </div>
              )}

              <button onClick={handleSaveSettings} disabled={!settingsName.trim() || settingsLoading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white py-3 rounded-xl text-base font-semibold transition-colors">
                {settingsLoading ? 'Saving…' : settingsSaved ? '✓ Saved!' : 'Save Settings'}
              </button>
            </div>

            {/* Member link info */}
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
              <p className="text-sm font-semibold text-orange-800 mb-1">Your member link</p>
              <p className="text-sm text-orange-700 font-mono break-all">{memberUrl}</p>
              <p className="text-xs text-orange-600 mt-2">Share this with your volunteers. Each coordinator has their own unique link.</p>
            </div>
          </div>
        )}

        {/* ── LOGISTICS ── */}
        {view === 'logistics' && (
          <div className="mt-2 space-y-4">
            {/* Coordinator contact */}
            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
              <div className="bg-orange-500 px-4 py-2.5">
                <p className="text-white font-bold text-base">Coordinator Contact</p>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-semibold text-gray-800 text-base">{coord.name}</p>
                  <p className="text-sm text-gray-400">For questions &amp; drop-off info</p>
                </div>
                <div className="flex gap-2">
                  <a href={`tel:${coord.phone}`} className="flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-xl text-sm font-semibold hover:bg-green-100">📞 Call</a>
                  <a href={`https://wa.me/${coord.phone}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-green-500 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-green-600">💬 WA</a>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
              <div className="bg-orange-100 px-4 py-2.5">
                <p className="text-orange-800 font-bold text-base">How It Works</p>
              </div>
              <div className="px-4 py-3 space-y-3">
                {[
                  { icon: '📅', text: "Sign up at the beginning of each month for that month's dates" },
                  { icon: '🛒', text: 'Shop for ingredients using the list below (most from Costco)' },
                  { icon: '🥪', text: 'Make 20 PB&J sandwiches + pack 5 items per brown bag' },
                  { icon: '😷', text: 'Wear a mask and gloves while making and packing' },
                  { icon: '🏷', text: 'Label bags with Seva or Chirag SJC stickers' },
                  { icon: '📦', text: "Drop off bags at coordinator's address (see date details)" },
                  { icon: '🚐', text: 'Bags are delivered to shelters on delivery day' },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0 text-lg">{step.icon}</div>
                    <p className="text-sm text-gray-700 pt-1">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Each bag */}
            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
              <div className="bg-orange-100 px-4 py-2.5 flex items-center justify-between">
                <p className="text-orange-800 font-bold text-base">Each Bag Contains</p>
                <span className="bg-orange-500 text-white text-sm font-bold px-2 py-0.5 rounded-full">5 items</span>
              </div>
              <div className="grid grid-cols-5 gap-2 p-4">
                {[
                  { icon: '🥪', label: 'PB&J Sandwich' },
                  { icon: '🍊', label: 'Fresh Fruit' },
                  { icon: '🍟', label: 'Snack Packet' },
                  { icon: '🍫', label: 'Granola Bar' },
                  { icon: '🧃', label: 'Juice Drink' },
                ].map(({ icon, label }) => (
                  <div key={label} className="text-center">
                    <div className="bg-orange-50 rounded-xl py-2.5 mb-1.5 text-2xl">{icon}</div>
                    <p className="text-xs text-gray-600 leading-tight font-medium">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Shopping list */}
            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
              <div className="bg-orange-100 px-4 py-2.5 flex items-center justify-between">
                <p className="text-orange-800 font-bold text-base">Shopping List</p>
                <span className="text-orange-600 text-sm font-medium">For 20 bags · Costco</span>
              </div>
              <div className="px-4 py-3 space-y-3">
                {[
                  { item: 'Skippy Peanut Butter', qty: '1 bottle' },
                  { item: 'Kirkland Organic Strawberry Spread', qty: '½ bottle' },
                  { item: 'Oroweat 100% Whole Wheat Bread', qty: '3 packs (Costco 2-pack)' },
                  { item: 'Sandwich Ziplock Bags', qty: '20' },
                  { item: 'Cuties (clementines)', qty: '1 bag' },
                  { item: 'Nature Valley Crunchy Granola Bar', qty: '20' },
                  { item: 'Frito Lay Fun Flavor Mix', qty: '20' },
                  { item: 'Honest Kids Organic Juice Drink', qty: '20' },
                  { item: 'Brown paper bags', qty: '20' },
                  { item: 'Labels, scissors, stapler', qty: 'for packing' },
                ].map((row, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-7 h-7 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{row.item}</p>
                      <p className="text-sm text-gray-400">{row.qty}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PDF link */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="font-semibold text-gray-800 text-base">Full PDF Guide</p>
                <a href="/logistics.pdf" target="_blank" className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg font-medium">Open ↗</a>
              </div>
              <iframe src="/logistics.pdf" className="w-full" style={{ height: '50vh' }} title="Logistics PDF" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
