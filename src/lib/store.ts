export type ItemType = 'nutritional' | 'meals' | 'both';
export type DeliveryStatus = 'pending' | 'delivered';

export const DEFAULT_LOCATION = '925 Roselma Pl, Pleasanton CA 94566';
export const DEFAULT_PHONE = '9258904273';

// ── Coordinator profiles ──────────────────────────────────────────────────────

export interface CoordinatorProfile {
  id: string;       // short stable ID used in URLs and storage keys
  name: string;     // display name, e.g. "Anupama – Pleasanton"
  password: string;
  phone: string;    // coordinator's WhatsApp/call number
  address: string;  // default drop-off location for their events
}

const COORDS_KEY = 'seva_coordinators';

export function getCoordinators(): CoordinatorProfile[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(COORDS_KEY) || '[]'); }
  catch { return []; }
}

export function saveCoordinators(coords: CoordinatorProfile[]): void {
  localStorage.setItem(COORDS_KEY, JSON.stringify(coords));
}

export function getCoordinator(id: string): CoordinatorProfile | undefined {
  return getCoordinators().find(c => c.id === id);
}

export function addCoordinator(data: Omit<CoordinatorProfile, 'id'>): CoordinatorProfile {
  const id = Math.random().toString(36).slice(2, 8); // 6-char random ID
  const coord: CoordinatorProfile = { id, ...data };
  saveCoordinators([...getCoordinators(), coord]);
  return coord;
}

export function updateCoordinator(id: string, patch: Partial<Omit<CoordinatorProfile, 'id'>>): void {
  saveCoordinators(getCoordinators().map(c => c.id === id ? { ...c, ...patch } : c));
}

export function findCoordinatorByPassword(password: string): CoordinatorProfile | undefined {
  return getCoordinators().find(c => c.password === password);
}

/** Seed the default demo coordinator if none exist yet */
export function seedDefaultCoordinator(): CoordinatorProfile {
  const existing = getCoordinators();
  if (existing.length > 0) return existing[0];
  const coord: CoordinatorProfile = {
    id: 'seva2024',
    name: 'Seva Commons – Pleasanton',
    password: 'seva2024',
    phone: DEFAULT_PHONE,
    address: DEFAULT_LOCATION,
  };
  saveCoordinators([coord]);
  return coord;
}

// ── Events ────────────────────────────────────────────────────────────────────

export interface SevaEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  mealBagSlots: number;
  nutritionalSlots: number;
  dropOffStart: string;
  dropOffEnd: string;
  dropOffLocation: string;
  note?: string;
}

function eventsKey(coordId: string) { return `seva_events_${coordId}`; }
function signupsKey(coordId: string) { return `seva_signups_${coordId}`; }

export function getEvents(coordId: string): SevaEvent[] {
  if (typeof window === 'undefined') return [];
  const coord = getCoordinator(coordId);
  try {
    const raw: Partial<SevaEvent>[] = JSON.parse(localStorage.getItem(eventsKey(coordId)) || '[]');
    return raw.map(e => ({
      id: e.id ?? '',
      date: e.date ?? '',
      title: e.title ?? '',
      mealBagSlots: e.mealBagSlots ?? 7,
      nutritionalSlots: e.nutritionalSlots ?? 3,
      dropOffStart: e.dropOffStart ?? '18:00',
      dropOffEnd: e.dropOffEnd ?? '21:00',
      dropOffLocation: e.dropOffLocation ?? coord?.address ?? DEFAULT_LOCATION,
      note: e.note,
    }));
  }
  catch { return []; }
}

export function saveEvents(events: SevaEvent[], coordId: string): void {
  localStorage.setItem(eventsKey(coordId), JSON.stringify(events));
}

export function addEvent(event: Omit<SevaEvent, 'id'>, coordId: string): SevaEvent {
  const newEvent: SevaEvent = { ...event, id: crypto.randomUUID() };
  saveEvents([...getEvents(coordId), newEvent], coordId);
  return newEvent;
}

export function updateEvent(id: string, patch: Partial<Omit<SevaEvent, 'id'>>, coordId: string): void {
  saveEvents(getEvents(coordId).map(e => e.id === id ? { ...e, ...patch } : e), coordId);
}

export function deleteEvent(id: string, coordId: string): void {
  saveEvents(getEvents(coordId).filter(e => e.id !== id), coordId);
  saveSignups(getSignups(coordId).filter(s => s.eventId !== id), coordId);
}

// ── Signups ───────────────────────────────────────────────────────────────────

export interface Signup {
  id: string;
  eventId: string;
  memberName: string;
  memberContact: string; // phone number
  itemType: ItemType;
  status: DeliveryStatus;
  deliveryPhotoUrl?: string;
  deliveredAt?: string;
  signedUpAt: string;
  addedByAdmin?: boolean;
}

export function getSignups(coordId: string): Signup[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(signupsKey(coordId)) || '[]'); }
  catch { return []; }
}

export function saveSignups(signups: Signup[], coordId: string): void {
  localStorage.setItem(signupsKey(coordId), JSON.stringify(signups));
}

export function addSignup(data: {
  eventId: string;
  memberName: string;
  memberContact: string;
  itemType: ItemType;
  addedByAdmin?: boolean;
}, coordId: string): Signup {
  const newSignup: Signup = {
    id: crypto.randomUUID(),
    ...data,
    status: 'pending',
    signedUpAt: new Date().toISOString(),
  };
  saveSignups([...getSignups(coordId), newSignup], coordId);
  return newSignup;
}

export function removeSignup(signupId: string, coordId: string): void {
  saveSignups(getSignups(coordId).filter(s => s.id !== signupId), coordId);
}

export function markDelivered(signupId: string, photoUrl: string, coordId: string): void {
  saveSignups(
    getSignups(coordId).map(s =>
      s.id === signupId
        ? { ...s, status: 'delivered' as DeliveryStatus, deliveryPhotoUrl: photoUrl, deliveredAt: new Date().toISOString() }
        : s
    ),
    coordId,
  );
}

export function adminMarkDelivered(signupId: string, coordId: string): void {
  saveSignups(
    getSignups(coordId).map(s =>
      s.id === signupId
        ? { ...s, status: 'delivered' as DeliveryStatus, deliveredAt: new Date().toISOString() }
        : s
    ),
    coordId,
  );
}

export function getSlotsUsed(eventId: string, signups: Signup[]) {
  const ev = signups.filter(s => s.eventId === eventId);
  return {
    mealBagUsed: ev.filter(s => s.itemType === 'meals' || s.itemType === 'both').length,
    nutritionalUsed: ev.filter(s => s.itemType === 'nutritional' || s.itemType === 'both').length,
  };
}

export function itemTypeLabel(type: ItemType): string {
  if (type === 'meals') return '25 Meal Bags';
  if (type === 'nutritional') return 'Nutritional Items';
  return 'Meal Bags + Nutritional Items';
}
