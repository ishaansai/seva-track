export type ItemType = 'nutritional' | 'meals' | 'both';
export type DeliveryStatus = 'pending' | 'delivered';

export interface SevaEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  mealBagSlots: number;
  nutritionalSlots: number;
  dropOffStart: string;
  dropOffEnd: string;
  note?: string;
}

export interface Signup {
  id: string;
  eventId: string;
  memberName: string;
  memberContact: string;
  itemType: ItemType;
  status: DeliveryStatus;
  deliveryPhotoUrl?: string;
  deliveredAt?: string;
  signedUpAt: string;
  addedByAdmin?: boolean;
}

const EVENTS_KEY = 'seva_events';
const SIGNUPS_KEY = 'seva_signups';

export function getEvents(): SevaEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw: Partial<SevaEvent>[] = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
    return raw.map(e => ({
      id: e.id ?? '',
      date: e.date ?? '',
      title: e.title ?? '',
      mealBagSlots: e.mealBagSlots ?? 7,
      nutritionalSlots: e.nutritionalSlots ?? 3,
      dropOffStart: e.dropOffStart ?? '18:00',
      dropOffEnd: e.dropOffEnd ?? '21:00',
      note: e.note,
    }));
  }
  catch { return []; }
}

export function saveEvents(events: SevaEvent[]): void {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

export function addEvent(event: Omit<SevaEvent, 'id'>): SevaEvent {
  const newEvent: SevaEvent = { ...event, id: crypto.randomUUID() };
  saveEvents([...getEvents(), newEvent]);
  return newEvent;
}

export function updateEvent(id: string, patch: Partial<Omit<SevaEvent, 'id'>>): void {
  saveEvents(getEvents().map(e => e.id === id ? { ...e, ...patch } : e));
}

export function deleteEvent(id: string): void {
  saveEvents(getEvents().filter(e => e.id !== id));
  saveSignups(getSignups().filter(s => s.eventId !== id));
}

export function getSignups(): Signup[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(SIGNUPS_KEY) || '[]'); }
  catch { return []; }
}

export function saveSignups(signups: Signup[]): void {
  localStorage.setItem(SIGNUPS_KEY, JSON.stringify(signups));
}

export function addSignup(data: {
  eventId: string;
  memberName: string;
  memberContact: string;
  itemType: ItemType;
  addedByAdmin?: boolean;
}): Signup {
  const newSignup: Signup = {
    id: crypto.randomUUID(),
    ...data,
    status: 'pending',
    signedUpAt: new Date().toISOString(),
  };
  saveSignups([...getSignups(), newSignup]);
  return newSignup;
}

export function removeSignup(signupId: string): void {
  saveSignups(getSignups().filter(s => s.id !== signupId));
}

export function markDelivered(signupId: string, photoUrl: string): void {
  saveSignups(
    getSignups().map(s =>
      s.id === signupId
        ? { ...s, status: 'delivered' as DeliveryStatus, deliveryPhotoUrl: photoUrl, deliveredAt: new Date().toISOString() }
        : s
    )
  );
}

export function adminMarkDelivered(signupId: string): void {
  saveSignups(
    getSignups().map(s =>
      s.id === signupId
        ? { ...s, status: 'delivered' as DeliveryStatus, deliveredAt: new Date().toISOString() }
        : s
    )
  );
}

export function getSlotsUsed(eventId: string, signups: Signup[]) {
  const ev = signups.filter(s => s.eventId === eventId);
  return {
    mealBagUsed: ev.filter(s => s.itemType === 'meals' || s.itemType === 'both').length,
    nutritionalUsed: ev.filter(s => s.itemType === 'nutritional' || s.itemType === 'both').length,
  };
}
