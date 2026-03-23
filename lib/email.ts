import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

interface BookingEmailParams {
  to: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  startTimeIso: string;
  endTimeIso: string;
  zoomLink: string;
  notes?: string | null;
  hostName: string;
}

function toIcsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildGoogleCalUrl(params: BookingEmailParams): string {
  const start = toIcsDate(params.startTimeIso);
  const end = toIcsDate(params.endTimeIso);
  const title = encodeURIComponent(`Meeting with ${params.hostName}`);
  const details = encodeURIComponent(
    `Zoom: ${params.zoomLink}${params.notes ? `\n\nNotes: ${params.notes}` : ""}`
  );
  const location = encodeURIComponent(params.zoomLink);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
}

function buildIcsContent(params: BookingEmailParams): string {
  const start = toIcsDate(params.startTimeIso);
  const end = toIcsDate(params.endTimeIso);
  const now = toIcsDate(new Date().toISOString());
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}@opencal.dev`;
  const description = `Zoom: ${params.zoomLink}${params.notes ? `\\nNotes: ${params.notes}` : ""}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OpenCal//Meeting Booker//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `DTSTAMP:${now}`,
    `UID:${uid}`,
    `SUMMARY:Meeting with ${params.hostName}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${params.zoomLink}`,
    `ORGANIZER;CN=${params.hostName}:mailto:${process.env.EMAIL_FROM || "noreply@example.com"}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export async function sendBookingConfirmation(params: BookingEmailParams) {
  const { to, name, date, startTime, endTime, zoomLink, notes, hostName } = params;
  const googleCalUrl = buildGoogleCalUrl(params);
  const icsContent = buildIcsContent(params);

  await getResend().emails.send({
    from: `${hostName} <${process.env.EMAIL_FROM || "noreply@example.com"}>`,
    to: [to],
    subject: `Meeting Confirmed — ${date} at ${startTime}`,
    attachments: [
      {
        filename: "meeting.ics",
        content: Buffer.from(icsContent).toString("base64"),
        contentType: "text/calendar",
      },
    ],
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:48px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#18181b;padding:32px 40px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Meeting Confirmed</h1>
      </div>
      <div style="padding:32px 40px;">
        <p style="margin:0 0 24px;color:#3f3f46;font-size:16px;line-height:1.6;">
          Hi ${name}, your meeting with ${hostName} has been confirmed.
        </p>
        <div style="background:#f4f4f5;border-radius:8px;padding:20px 24px;margin:0 0 24px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;color:#71717a;font-size:14px;width:80px;">Date</td>
              <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:500;">${date}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#71717a;font-size:14px;">Time</td>
              <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:500;">${startTime} — ${endTime} (UK)</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#71717a;font-size:14px;">Duration</td>
              <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:500;">1 hour</td>
            </tr>
            ${notes ? `
            <tr>
              <td style="padding:6px 0;color:#71717a;font-size:14px;vertical-align:top;">Notes</td>
              <td style="padding:6px 0;color:#18181b;font-size:14px;">${notes}</td>
            </tr>
            ` : ""}
          </table>
        </div>
        <div style="margin:0 0 24px;">
          <a href="${zoomLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;">
            Join Zoom Meeting
          </a>
        </div>
        <div style="border-top:1px solid #e4e4e7;padding-top:20px;">
          <p style="margin:0 0 12px;color:#71717a;font-size:13px;font-weight:500;">Add to your calendar</p>
          <a href="${googleCalUrl}" style="display:inline-block;background:#ffffff;color:#18181b;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:500;border:1px solid #d4d4d8;margin-right:8px;">
            Google Calendar
          </a>
          <span style="display:inline-block;color:#a1a1aa;font-size:12px;vertical-align:middle;">
            or open the attached .ics file
          </span>
        </div>
        <p style="margin:20px 0 0;color:#a1a1aa;font-size:13px;line-height:1.5;">
          If you need to reschedule or cancel, please reply to this email.
        </p>
      </div>
    </div>
    <p style="margin:24px 0 0;text-align:center;color:#a1a1aa;font-size:12px;">
      Sent via OpenCal
    </p>
  </div>
</body>
</html>
    `,
  });
}

interface CancellationEmailParams {
  to: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  hostName: string;
}

export async function sendCancellationEmail(params: CancellationEmailParams) {
  const { to, name, date, startTime, endTime, hostName } = params;

  await getResend().emails.send({
    from: `${hostName} <${process.env.EMAIL_FROM || "noreply@example.com"}>`,
    to: [to],
    subject: `Meeting Cancelled — ${date} at ${startTime}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:48px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#18181b;padding:32px 40px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Meeting Cancelled</h1>
      </div>
      <div style="padding:32px 40px;">
        <p style="margin:0 0 24px;color:#3f3f46;font-size:16px;line-height:1.6;">
          Hi ${name}, your meeting with ${hostName} has been cancelled.
        </p>
        <div style="background:#f4f4f5;border-radius:8px;padding:20px 24px;margin:0 0 24px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;color:#71717a;font-size:14px;width:80px;">Date</td>
              <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:500;">${date}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#71717a;font-size:14px;">Time</td>
              <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:500;">${startTime} — ${endTime} (UK)</td>
            </tr>
          </table>
        </div>
        <p style="margin:0;color:#a1a1aa;font-size:13px;line-height:1.5;">
          If you'd like to rebook, please use your original booking link.
        </p>
      </div>
    </div>
    <p style="margin:24px 0 0;text-align:center;color:#a1a1aa;font-size:12px;">
      Sent via OpenCal
    </p>
  </div>
</body>
</html>
    `,
  });
}

export async function sendBookingNotification(params: BookingEmailParams & { bookerEmail: string }) {
  const { to, name, date, startTime, endTime, notes, bookerEmail, hostName } = params;

  await getResend().emails.send({
    from: "Bookings <${process.env.EMAIL_FROM || "noreply@example.com"}>",
    to: [to],
    subject: `New Booking — ${name} on ${date}`,
    html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:48px 16px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#18181b;padding:32px 40px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">New Meeting Booked</h1>
      </div>
      <div style="padding:32px 40px;">
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;">Hi ${hostName}, someone booked a meeting with you.</p>
        <div style="background:#f4f4f5;border-radius:8px;padding:20px 24px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;color:#71717a;font-size:14px;width:80px;">Who</td>
              <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:500;">${name} (${bookerEmail})</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#71717a;font-size:14px;">Date</td>
              <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:500;">${date}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#71717a;font-size:14px;">Time</td>
              <td style="padding:6px 0;color:#18181b;font-size:14px;font-weight:500;">${startTime} — ${endTime} (UK)</td>
            </tr>
            ${notes ? `
            <tr>
              <td style="padding:6px 0;color:#71717a;font-size:14px;vertical-align:top;">Notes</td>
              <td style="padding:6px 0;color:#18181b;font-size:14px;">${notes}</td>
            </tr>
            ` : ""}
          </table>
        </div>
      </div>
    </div>
    <p style="margin:24px 0 0;text-align:center;color:#a1a1aa;font-size:12px;">
      Sent via OpenCal
    </p>
  </div>
</body>
</html>
    `,
  });
}
