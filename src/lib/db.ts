/**
 * db.ts — All Supabase database operations for Seva Track.
 * Every function is async and returns typed data.
 */
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ItemType      = 'nutritional' | 'meals' | 'both';
export type DeliveryStatus = 'pending' | 'delivered' | 'confirmed';

export interface CoordinatorProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  signup_open_day: number;       // day of month signups open (default 15)
  signup_open_override:  string | null; // YYYY-MM-DD
  signup_close_override: string | null; // YYYY-MM-DD
  notify_on_signup: boolean;     // send WhatsApp notification to coordinator on new signup
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
  total_meal_bags: number;         // (meal_bag_deliveries × 20) + meal_bag_adjustment
  nutritional_deliveries: number;  // auto count + nutritional_adjustment
  meal_bag_adjustment: number;     // manual override added on top
  nutritional_adjustment: number;
  adjustment_note: string;
  first_signup: string;
  last_signup: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function itemTypeLabel(type: ItemType): string {
  if (type === 'meals')       return '20 Meal Bags';
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

/**
 * Smart signup window based on actual event dates:
 * - Opens the 16th of the month BEFORE the delivery month
 * - Closes Sunday morning of the delivery week (week containing first upcoming event)
 * - Admin overrides always win
 */
export function getSignupWindowFromEvents(
  coord: CoordinatorProfile,
  events: SevaEvent[],
): { open: Date; close: Date } {
  if (coord.signup_open_override && coord.signup_close_override) {
    return {
      open:  new Date(coord.signup_open_override + 'T00:00:00'),
      close: new Date(coord.signup_close_override + 'T23:59:59'),
    };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = events
    .filter(e => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (upcoming.length === 0) return getSignupWindow(coord);

  const eventDate = new Date(upcoming[0].date + 'T00:00:00');
  const dow = eventDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Close = Sunday 11:59pm of the event's week
  const close = new Date(eventDate);
  close.setDate(close.getDate() - (dow === 0 ? 0 : dow));
  close.setHours(23, 59, 59);

  // Open = 16th of the month before the event month
  const em = eventDate.getMonth(); // 0-indexed
  const ey = eventDate.getFullYear();
  const open = new Date(em === 0 ? ey - 1 : ey, em === 0 ? 11 : em - 1, 16, 0, 0, 0);

  return { open, close };
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

/** Send a password reset email to the given address. */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/admin`,
  });
  if (error) throw new Error(error.message);
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
    .select('id,name,email,phone,address,signup_open_day,signup_open_override,signup_close_override,notify_on_signup')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as CoordinatorProfile;
}

export async function getCoordinatorByUserId(userId: string): Promise<CoordinatorProfile | null> {
  const { data, error } = await supabase
    .from('coordinators')
    .select('id,name,email,phone,address,signup_open_day,signup_open_override,signup_close_override,notify_on_signup')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data as CoordinatorProfile;
}

/** Returns ALL coordinators including demo. Used for the public member page. */
export async function getAllCoordinators(): Promise<CoordinatorProfile[]> {
  const { data } = await supabase
    .from('coordinators')
    .select('id,name,email,phone,address,signup_open_day,signup_open_override,signup_close_override,notify_on_signup')
    .order('created_at', { ascending: true });
  return (data ?? []) as CoordinatorProfile[];
}

/** Returns all events for the given list of coordinator IDs, sorted by date. */
export async function getAllEvents(coordIds?: string[]): Promise<SevaEvent[]> {
  if (coordIds && coordIds.length > 0) {
    // Fetch per coordinator (works reliably with RLS) then combine
    const arrays = await Promise.all(coordIds.map(id => getEvents(id)));
    return arrays.flat().sort((a, b) => a.date.localeCompare(b.date));
  }
  const { data } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true });
  return (data ?? []) as SevaEvent[];
}

/** Returns all signups for the given list of coordinator IDs. */
export async function getAllSignups(coordIds?: string[]): Promise<Signup[]> {
  if (coordIds && coordIds.length > 0) {
    const arrays = await Promise.all(coordIds.map(id => getSignups(id)));
    return arrays.flat();
  }
  const { data } = await supabase
    .from('signups')
    .select('*')
    .order('signed_up_at', { ascending: true });
  return (data ?? []) as Signup[];
}

/** Returns the first coordinator in the DB — used as fallback when no ?coord= param is in the URL. */
export async function getDefaultCoordinator(): Promise<CoordinatorProfile | null> {
  // Prefer the most recently created non-demo coordinator
  const { data, error } = await supabase
    .from('coordinators')
    .select('id,name,email,phone,address,signup_open_day,signup_open_override,signup_close_override,notify_on_signup')
    .neq('id', 'seva2024')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (!error && data) return data as CoordinatorProfile;
  // Fall back to seva2024 if no other coordinator exists
  const { data: fallback } = await supabase
    .from('coordinators')
    .select('id,name,email,phone,address,signup_open_day,signup_open_override,signup_close_override,notify_on_signup')
    .eq('id', 'seva2024')
    .single();
  return fallback as CoordinatorProfile ?? null;
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
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw new Error(error.message);
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
  // Use the first name on record for this phone number (so family members all get same name)
  let memberName = data.member_name;
  if (data.member_phone) {
    const { data: existing } = await supabase
      .from('signups')
      .select('member_name')
      .eq('coord_id', data.coord_id)
      .eq('member_phone', data.member_phone.replace(/\D/g, ''))
      .order('signed_up_at', { ascending: true })
      .limit(1);
    if (existing?.[0]?.member_name) memberName = existing[0].member_name;
  }
  const { data: row, error } = await supabase
    .from('signups')
    .insert({ ...data, member_name: memberName, status: 'pending' })
    .select()
    .single();
  if (error || !row) throw new Error(error?.message ?? 'Failed to add signup');
  return row as Signup;
}

export async function removeSignup(id: string): Promise<void> {
  await supabase.from('signups').delete().eq('id', id);
}

/** Deletes all signups for a member (by phone) under a coordinator — removes them from Members list */
export async function deleteMember(coordId: string, memberPhone: string): Promise<void> {
  const { error } = await supabase.from('signups').delete()
    .eq('coord_id', coordId)
    .eq('member_phone', memberPhone);
  if (error) throw new Error(error.message);
}

export async function markDelivered(signupId: string, photoUrl: string): Promise<void> {
  const { error } = await supabase.from('signups').update({
    status: 'delivered',
    delivery_photo_url: photoUrl,
    delivered_at: new Date().toISOString(),
  }).eq('id', signupId);
  if (error) throw new Error('DB save failed: ' + error.message);
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

/** Admin confirms a delivery — clears the photo and marks as confirmed */
export async function confirmDelivery(signupId: string): Promise<void> {
  const { error } = await supabase.from('signups').update({
    status: 'confirmed',
    delivery_photo_url: null,
  }).eq('id', signupId);
  if (error) throw new Error(error.message);
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

  // Try insert first; if file already exists, delete and re-upload
  const { error } = await supabase.storage
    .from('delivery-photos')
    .upload(path, blob, { upsert: false, contentType: blob.type });

  if (error) {
    if (error.message.includes('already exists') || error.statusCode === '409' || (error as {statusCode?: string | number}).statusCode === 409) {
      await supabase.storage.from('delivery-photos').remove([path]);
      const { error: err2 } = await supabase.storage
        .from('delivery-photos')
        .upload(path, blob, { upsert: false, contentType: blob.type });
      if (err2) throw new Error(err2.message);
    } else {
      throw new Error(error.message);
    }
  }

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
    ['Date', 'Member Name', 'Phone', 'Item Type', 'Meal Bags', 'Nutritional Items', 'Status',
     'Signed Up At', 'Delivered At', 'Drop-Off Location'],
  ];
  for (const s of signups) {
    const ev = events.find(e => e.id === s.event_id);
    const done = s.status === 'delivered' || s.status === 'confirmed';
    const mealBags     = done && (s.item_type === 'meals'       || s.item_type === 'both') ? '20' : '0';
    const nutritional  = done && (s.item_type === 'nutritional' || s.item_type === 'both') ? '1'  : '0';
    rows.push([
      ev?.date ?? '',
      s.member_name,
      s.member_phone,
      itemTypeLabel(s.item_type),
      mealBags,
      nutritional,
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
