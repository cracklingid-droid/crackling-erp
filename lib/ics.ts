// Bikin undangan kalender standar (.ics) untuk jadwal interview - dikenali
// otomatis oleh Gmail/Google Calendar/Outlook sbg undangan meeting (tombol
// Ya/Tidak/Mungkin), tanpa HR atau kandidat perlu connect akun Google
// apapun ke sistem ini. Permintaan Kevin 2026-09-11.
function toICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeICSText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

export function buildInterviewICS(opts: {
  uid: string;
  start: Date;
  durationMinutes?: number; // default 30 menit - sesuaikan kalau interview biasanya lebih lama
  summary: string;
  description: string;
  organizerEmail: string;
  organizerName?: string;
  attendees: { email: string; name?: string }[];
}): string {
  const duration = opts.durationMinutes ?? 30;
  const end = new Date(opts.start.getTime() + duration * 60000);
  const lines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Crackling HR//Rekrutmen//ID",
    "VERSION:2.0",
    "METHOD:REQUEST",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(opts.start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escapeICSText(opts.summary)}`,
    `DESCRIPTION:${escapeICSText(opts.description)}`,
    `ORGANIZER;CN=${escapeICSText(opts.organizerName ?? "Crackling HR")}:mailto:${opts.organizerEmail}`,
    ...opts.attendees.map(
      (a) => `ATTENDEE;CN=${escapeICSText(a.name ?? a.email)};ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${a.email}`
    ),
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}
