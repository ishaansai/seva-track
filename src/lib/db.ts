/**
 * db.ts — All Supabase database operations for Seva Track.
 * Every function is async and returns typed data.
 */
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ItemType      = 'nutritional' | 'meals' | 'both';
export type DeliveryStatus = 'pending' | 'delivered';

export interface CoordinatorProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  signup_open_day: number;       // day of month signups open (default 15)
  signup_open_override:  string | null; // YYYY-MM-DD
  signup_close_override: string | null; // YYYY-MM-DD
}

export interface SevaEvent {
  id: string;
  coord_id: string;
  date: string;           // YYYY-MM-DD
  meal_bag_slots: number;
  nutritional_slots: number;
  drop_off_start: string; // HH:MM
  drop_off_end: string;
  drop_off_location: string;
  note?: string;
}

export interface Signup {
  id: string;
  event_id: string;
  coord_id: string;
  member_name: string;
  member_phone: string;
  item_type: ItemType;
  status: DeliveryStatus;
  delivery_photo_url?: string;
  delivered_at?: string;
  added_by_admin: boolean;
  signed_up_at: string;
}

export interface MemberContribution {
  coord_id: string;
  member_name: string;
  member_phone: string;
  total_signups: number;
  total_delivered: number;
  meal_bag_deliveries: number;
  total_meal_bags: number;         // (meal_bag_deliveries × 25) + meal_bag_adjustment
  nutritional_deliveries: number;  // auto count + nutritional_adjustment
  meal_bag_adjustment: number;     // manual override added on top
  nutritional_adjustment: number;
  adjustment_note: string;
  first_signup: string;
  last_signup: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function itemTypeLabel(type: ItemType): string {
  if (type === 'meals')       return '25 Meal Bags';
  if (type === 'nutritional') return 'Nutritional Items';
  return 'Meal Bags + Nutritional Items';
}

/** Returns the signup window for a coordinator based on today's date */
export function getSignupWindow(coord: CoordinatorProfile): { open: Date; close: Date } {
  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth(); // 0-indexed

  // If admin set explicit overrides, use those
  if (coord.signup_open_override && coord.signup_close_override) {
    return {
      open:  new Date(coord.signup_open_override  + 'T00:00:00'),
      close: new Date(coord.signup_close_override + 'T23:59:59'),
    };
  }

  // Default: opens on signup_open_day of current month, closes last day of month
  const openDay = coord.signup_open_day ?? 15;
  const open    = new Date(year, month, openDay, 0, 0, 0);
  const close   = new Date(year, month + 1, 0, 23, 59, 59); // last day of current month
  return { open, close };
}

/** Is the signup window currently open? */
export function isSignupOpen(coord: CoordinatorProfile): boolean {
  const { open, close } = getSignupWindow(coord);
  const now = new Date();
  return now >= open && now <= close;
}

const DEFAULT_ADDRESS  = '925 Roselma Pl, Pleasanton CA 94566';
const DEFAULT_PHONE    = '9258904273';
const DEFAULT_COORD_ID = ''; // unused — getDefaultCoordinator() queries the DB dynamically

// ─── Auth ────────────────────────────────────────────────────────────────────

/** Sign in a coordinator with email + password via Supabase Auth. */
export async function signInCoordinator(
  email: string,
  password: string,
): Promise<CoordinatorProfile> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(error?.message ?? 'Login failed');
  const coord = await getCoordinatorByUserId(data.user.id);
  if (!coord) throw new Error('No coordinator account found for this login.');
  return coord;
}

/** Sign out the current coordinator session. */
export async function signOutCoordinator(): Promise<void> {
  await supabase.auth.signOut();
}

/** Change the current coordinator's password via Supabase Auth. */
export async function updateCoordinatorPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

// ─── Coordinators ─────────────────────────────────────────────────────────────

export async function getCoordinator(id: string): Promise<CoordinatorProfile | null> {
  const { data, error } = await supabase
    .from('coordinators')
    .select('id,name,email,phone,address,signup_open_day,signup_open_override,signup_close_override')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as CoordinatorProfile;
}

export async function getCoordinatorByUserId(userId: string): Promise<CoordinatorProfile | null> {
  const { data, error } = await supabase
    .from('coordinators')
    .select('id,name,email,phone,address,signup_open_day,signup_open_override,signup_close_override')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data as CoordinatorProfile;
}

/** Returns the first coordinator in the DB — used as fallback when no ?coord= param is in the URL. */
export async function getDefaultCoordinator(): Promise<CoordinatorProfile | null> {
  const { data, error } = await supabase
    .from('coordinators')
    .select('id,name,email,phone,address,signup_open_day,signup_open_override,signup_close_override')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  if (error || !data) return null;
  return data as CoordinatorProfile;
}

/** Registration is handled server-side via /api/auth/register to keep the
 *  service role key off the browser. This client helper calls that route. */
export async function registerCoordinator(data: {
  name: string; email: string; password: string; phone: string; address: string;
}): Promise<CoordinatorProfile> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Registration failed');

  // Sign in immediately after registration so the client has a session
  return signInCoordinator(data.email, data.password);
}

export async function updateCoordinator(
  id: string,
  patch: Partial<Omit<CoordinatorProfile, 'id'>>,
): Promise<void> {
  await supabase.from('coordinators').update(patch).eq('id', id);
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function getEvents(coordId: string): Promise<SevaEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('coord_id', coordId)
    .order('date', { ascending: true });
  if (error || !data) return [];
  return data as SevaEvent[];
}

export async function addEvent(
  event: Omit<SevaEvent, 'id' | 'coord_id'>,
  coordId: string,
): Promise<SevaEvent> {
  const { data, error } = await supabase
    .from('events')
    .insert({ ...event, coord_id: coordId })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to create event');
  return data as SevaEvent;
}

export async function updateEvent(
  id: string,
  patch: Partial<Omit<SevaEvent, 'id' | 'coord_id'>>,
): Promise<void> {
  await supabase.from('events').update(patch).eq('id', id);
}

export async function deleteEvent(id: string): Promise<void> {
  // Signups cascade-delete via FK
  await supabase.from('events').delete().eq('id', id);
}

// ─── Signups ──────────────────────────────────────────────────────────────────

export async function getSignups(coordId: string): Promise<Signup[]> {
  const { data, error } = await supabase
    .from('signups')
    .select('*')
    .eq('coord_id', coordId)
    .order('signed_up_at', { ascending: true });
  if (error || !data) return [];
  return data as Signup[];
}

export async function getSignupById(id: string): Promise<Signup | null> {
  const { data, error } = await supabase
    .from('signups')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as Signup;
}

export async function addSignup(data: {
  event_id: string;
  coord_id: string;
  member_name: string;
  member_phone: string;
  item_type: ItemType;
  added_by_admin?: boolean;
}): Promise<Signup> {
  const { data: row, error } = await supabase
    .from('signups')
    .insert({ ...data, status: 'pending' })
    .select()
    .single();
  if (error || !row) throw new Error(error?.message ?? 'Failed to add signup');
  return row as Signup;
}

export async function removeSignup(id: string): Promise<void> {
  await supabase.from('signups').delete().eq('id', id);
}

export async function markDelivered(signupId: string, photoUrl: string): Promise<void> {
  await supabase.from('signups').update({
    status: 'delivered',
    delivery_photo_url: photoUrl,
    delivered_at: new Date().toISOString(),
  }).eq('id', signupId);
}

export async function adminMarkDelivered(signupId: string): Promise<void> {
  await supabase.from('signups').update({
    status: 'delivered',
    delivered_at: new Date().toISOString(),
  }).eq('id', signupId);
}

export async function undoDelivery(signupId: string): Promise<void> {
  await supabase.from('signups').update({
    status: 'pending',
    delivery_photo_url: null,
    delivered_at: null,
  }).eq('id', signupId);
}

// ─── Slot counting (client-side, from already-loaded signups) ─────────────────

export function getSlotsUsed(eventId: string, signups: Signup[]) {
  const ev = signups.filter(s => s.event_id === eventId);
  return {
    mealBagUsed:      ev.filter(s => s.item_type === 'meals' || s.item_type === 'both').length,
    nutritionalUsed:  ev.filter(s => s.item_type === 'nutritional' || s.item_type === 'both').length,
  };
}

// ─── Member contributions ─────────────────────────────────────────────────────

export async function getMemberContributions(coordId: string): Promise<MemberContribution[]> {
  const { data, error } = await supabase
    .from('member_contributions')
    .select('*')
    .eq('coord_id', coordId);
  if (error || !data) return [];
  return data as MemberContribution[];
}

// ─── Photo upload to Supabase Storage ────────────────────────────────────────

export async function uploadDeliveryPhoto(
  signupId: string,
  dataUrl: string,
): Promise<string> {
  // Convert base64 data URL to Blob
  const res   = await fetch(dataUrl);
  const blob  = await res.blob();
  const ext   = blob.type.includes('png') ? 'png' : 'jpg';
  const path  = `${signupId}.${ext}`;

  const { error } = await supabase.storage
    .from('delivery-photos')
    .upload(path, blob, { upsert: true, contentType: blob.type });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage
    .from('delivery-photos')
    .getPublicUrl(path);

  return data.publicUrl;
}

// ─── Manual adjustments ───────────────────────────────────────────────────────

/** Upsert a manual adjustment for a member's contribution totals. */
export async function setMemberAdjustment(data: {
  coord_id: string;
  member_phone: string;
  member_name: string;
  meal_bag_adjustment: number;
  nutritional_adjustment: number;
  note: string;
}): Promise<void> {
  const { error } = await supabase
    .from('member_adjustments')
    .upsert(
      { ...data, updated_at: new Date().toISOString() },
      { onConflict: 'coord_id,member_phone' },
    );
  if (error) throw new Error(error.message);
}

// ─── CSV export ───────────────────────────────────────────────────────────────

export function downloadCsv(events: SevaEvent[], signups: Signup[], monthFilter?: string): void {
  // monthFilter format: 'YYYY-MM' — if provided, only include signups for that month
  if (monthFilter) {
    const filteredEventIds = new Set(events.filter(e => e.date.startsWith(monthFilter)).map(e => e.id));
    signups = signups.filter(s => filteredEventIds.has(s.event_id));
  }
  const rows: string[][] = [
    ['Date', 'Member Name', 'Phone', 'Item Type', 'Meal Bags', 'Status',
     'Signed Up At', 'Delivered At', 'Drop-Off Location'],
  ];
  for (const s of signups) {
    const ev = events.find(e => e.id === s.event_id);
    const mealBags = s.status === 'delivered' && (s.item_type === 'meals' || s.item_type === 'both')
      ? '25' : '0';
    rows.push([
      ev?.date ?? '',
      s.member_name,
      s.member_phone,
      itemTypeLabel(s.item_type),
      mealBags,
      s.status,
      s.signed_up_at ? new Date(s.signed_up_at).toLocaleString() : '',
      s.delivered_at ? new Date(s.delivered_at).toLocaleString() : '',
      ev?.drop_off_location ?? '',
    ]);
  }
  const csv  = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `seva-deliveries-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { DEFAULT_ADDRESS, DEFAULT_PHONE, DEFAULT_COORD_ID };
