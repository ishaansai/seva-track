export type ReminderOffset = '3days' | '1day' | '1hour';

const REMINDER_LABELS: Record<ReminderOffset, string> = {
  '3days': '3 Days Before',
  '1day':  '1 Day Before',
  '1hour': '1 Hour Before',
};

// ICS VALARM TRIGGER strings
const TRIGGERS: Record<ReminderOffset, string> = {
  '3days': '-P3D',
  '1day':  '-P1D',
  '1hour': '-PT1H',
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatIcsDateFull(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/** Returns a Google Calendar "Add Event" URL that opens pre-filled in the browser. */
export function googleCalendarUrl(
  eventDate: string,
  memberName: string,
  itemType: string,
  dropOffStart: string,
  dropOffEnd: string,
  location: string,
): string {
  const deliveryDate  = new Date(eventDate + 'T00:00:00');
  const dropOffDate   = new Date(deliveryDate);
  dropOffDate.setDate(dropOffDate.getDate() - 1);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const [startH, startM] = dropOffStart.split(':').map(Number);
  const [endH,   endM]   = dropOffEnd.split(':').map(Number);

  const dateStr = `${dropOffDate.getFullYear()}${pad(dropOffDate.getMonth() + 1)}${pad(dropOffDate.getDate())}`;
  const start   = `${dateStr}T${pad(startH)}${pad(startM)}00`;
  const end     = `${dateStr}T${pad(endH)}${pad(endM)}00`;

  const title   = encodeURIComponent('Seva Commons – Drop off meal bags');
  const details = encodeURIComponent(
    `Hi ${memberName}! Drop off your ${itemType}.\nDelivery day: ${deliveryDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
  );
  const loc     = encodeURIComponent(location);

  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${loc}`;
}

export function generateIcs(
  eventDate: string,   // YYYY-MM-DD (delivery date)
  memberName: string,
  itemType: string,
  dropOffStart: string,  // "18:00"
  dropOffEnd: string,    // "21:00"
  reminder: ReminderOffset,
  location?: string,
): void {
  const uid = `seva-${eventDate}-${memberName.replace(/\s+/g, '')}-${Date.now()}@sevatrack`;

  // The reminder is for the DROP-OFF date (1 day before the delivery date)
  const deliveryDate = new Date(eventDate + 'T00:00:00');
  const dropOffDate = new Date(deliveryDate);
  dropOffDate.setDate(dropOffDate.getDate() - 1); // day before delivery

  const [startH, startM] = dropOffStart.split(':').map(Number);
  const dropOffStart12 = formatTime(dropOffStart);
  const dropOffEnd12 = formatTime(dropOffEnd);

  const eventStart = `${formatIcsDateFull(dropOffDate).slice(0, 8)}T${pad(startH)}${pad(startM)}00`;
  const eventTitle = `Seva Commons – Drop off meal bags`;
  const loc = location || '925 Roselma Pl, Pleasanton CA 94566';
  const description = `Hi ${memberName}! Drop off your ${itemType} at:\\n${loc}\\nTime: ${dropOffStart12} – ${dropOffEnd12}\\n\\nDelivery day: ${deliveryDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Seva Track//Meal Bag Delivery//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDateFull(new Date())}`,
    `DTSTART:${eventStart}`,
    `SUMMARY:${eventTitle}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${loc.replace(/,/g, '\\,')}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:${TRIGGERS[reminder]}`,
    `DESCRIPTION:Reminder: ${REMINDER_LABELS[reminder]} – Drop off seva bags`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `seva-dropoff-${eventDate}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function formatTime(t: string | undefined): string {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

export { REMINDER_LABELS };
export type { };
