const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
const http = require('https');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

// ─── Admin / Staff Passcodes ────────────────────────────────
// No weak fallback defaults — if these aren't set in the
// environment, the admin/staff dashboard is locked out entirely
// rather than silently accepting 'admin123' / 'staff123'.
const ADMIN_PASSCODE = process.env.ADMIN_PASSWORD || null;
const STAFF_PASSCODE = process.env.STAFF_PASSWORD || null;
if (!ADMIN_PASSCODE || !STAFF_PASSCODE) {
  console.warn('[Security] ADMIN_PASSWORD and/or STAFF_PASSWORD are not set. The staff dashboard will reject all logins until these are configured.');
}

const twilio = require('twilio');
const nodemailer = require('nodemailer');

// Twilio Setup
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
const adminWhatsApp = process.env.ADMIN_WHATSAPP_NUMBER || '';

let twilioClient = null;
if (accountSid && authToken && !accountSid.startsWith('AC_mock')) {
  twilioClient = twilio(accountSid, authToken);
}

// Nodemailer Setup
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT || 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || 'sposhappeal@gmail.com';
const adminEmail = process.env.ADMIN_EMAIL || '';

let emailTransporter = null;
if (smtpHost && smtpUser && smtpPass && !smtpHost.startsWith('smtp_mock')) {
  emailTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: Number(smtpPort) === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

// Notifications Dispatcher Helper
async function sendWhatsAppMessage(to, body) {
  const normalizedTo = normalizeToE164(to);
  const formattedTo = normalizedTo.startsWith('whatsapp:') ? normalizedTo : `whatsapp:${normalizedTo}`;
  if (twilioClient) {
    try {
      await twilioClient.messages.create({
        body,
        from: twilioFrom,
        to: formattedTo
      });
      console.log(`[Twilio SMS] Notification successfully sent to ${formattedTo}`);
    } catch (err) {
      console.error(`[Twilio SMS] Failed to send to ${formattedTo}:`, err.message);
    }
  } else {
    const _msgPreview = body ? body.slice(0, 120).replace(/\n/g, ' ') : ''; console.log(`[WhatsApp MOCK] To: ${formattedTo} | ${_msgPreview}`);
  }
}

async function sendEmail(to, subject, html) {
  if (emailTransporter) {
    try {
      await emailTransporter.sendMail({
        from: smtpFrom,
        to,
        subject,
        html
      });
      console.log(`[Nodemailer] Email successfully sent to ${to}`);
    } catch (err) {
      console.error(`[Nodemailer] Failed to send to ${to}:`, err.message);
    }
  } else {
    const htmlPreview = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
    console.log(`\n===================== EMAIL NOTIFICATION (MOCK) =====================\nTo: ${to}\nSubject: ${subject}\nPreview: ${htmlPreview}...\n[Full HTML suppressed in logs for privacy]\n====================================================================\n`);
  }
}


// Unified Premium Email Template Compiler
function compileEmailTemplate({ title, headerAccentColor, name, description, detailsCardTitle, detailsRowsHtml, financialsHtml, buttonsHtml, nextStepsHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>${title}</title>
    <style>
      @media only screen and (max-width: 600px) {
        .outer-table {
          padding: 0 !important;
        }
        .main-container {
          border-radius: 0 !important;
          border: none !important;
          box-shadow: none !important;
        }
        .header-cell {
          padding: 36px 16px !important;
        }
        .body-cell {
          padding: 36px 16px !important;
        }
        .footer-cell {
          padding: 36px 16px !important;
        }
        .action-btn {
          display: block !important;
          margin: 10px 0 !important;
          width: 100% !important;
          box-sizing: border-box !important;
          text-align: center !important;
        }
        .detail-label {
          width: 100px !important;
          font-size: 0.75rem !important;
          padding: 10px 0 !important;
        }
        .detail-value {
          font-size: 0.9rem !important;
          padding: 10px 0 !important;
        }
        .financial-label {
          width: 100px !important;
          font-size: 0.75rem !important;
          padding: 6px 0 !important;
        }
        .financial-value {
          font-size: 1.0rem !important;
          padding: 6px 0 !important;
        }
      }
    </style>
  </head>
<body style="margin:0;padding:0;background:#11100f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" class="outer-table" style="background:#11100f;padding:40px 0;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table width="100%" cellpadding="0" cellspacing="0" class="main-container" style="max-width:620px;background:#FAF6F0;border-radius:12px;overflow:hidden;border:1px solid #ebdcb9;box-shadow:0 20px 50px rgba(0,0,0,0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td class="header-cell" style="background:#1a1917;padding:40px 20px;text-align:center;border-bottom:3px solid ${headerAccentColor};">
              <div style="margin-bottom:16px;">
                <img src="https://sposhappeal.vercel.app/assets/sposh_logo.png" alt="S'posh APPEAL Logo" style="height:60px;width:auto;display:inline-block;border:none;">
              </div>
              <div style="color:#c8a261;font-size:0.8rem;letter-spacing:5px;text-transform:uppercase;margin-bottom:10px;font-weight:700;font-family:sans-serif;">
                S'POSH APPEAL
              </div>
              <div style="color:#FAF6F0;font-size:2.0rem;font-weight:400;font-family:Georgia,serif;letter-spacing:1px;line-height:1.3;">
                ${title}
              </div>
            </td>
          </tr>
          
          <!-- Body Content Area -->
          <tr>
            <td class="body-cell" style="padding:40px 20px;background:#FAF6F0;">
              <p style="color:#1a1917;font-size:1.15rem;line-height:1.6;margin:0 0 24px;font-family:Georgia,serif;">
                Hi <strong style="color:#1a1917;font-weight:700;">${name}</strong>,
              </p>
              <p style="color:#1a1917;font-size:1.05rem;line-height:1.8;margin:0 0 36px;font-family:Georgia,serif;font-style:italic;">
                ${description}
              </p>
              
              <!-- Core Details Card -->
              <!-- Core Details (Simplified: no nested card div) -->
                <div style="color:#1a1917;font-size:0.8rem;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:0 0 20px;border-bottom:2px solid #ebdcb9;padding-bottom:12px;font-family:sans-serif;">
                  ${detailsCardTitle}
                </div>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="color:#1a1917;font-size:0.95rem;line-height:1.7;font-family:Georgia,serif;margin-bottom:20px;">
                  ${detailsRowsHtml}
                </table>
                
                <!-- Financial Breakdown Section -->
                ${financialsHtml}
              
              <!-- Action Buttons -->
              <div style="text-align:center;margin:36px 0 24px;">
                ${buttonsHtml}
              </div>
              
              <!-- Next Steps / Policy Section -->
              ${nextStepsHtml}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td class="footer-cell" style="padding:40px 20px;background:#1a1917;text-align:center;border-top:1px solid #ebdcb9;">
              <div style="color:#c8a261;font-size:0.85rem;font-weight:700;letter-spacing:3px;margin-bottom:8px;font-family:sans-serif;">
                S'POSH APPEAL
              </div>
              <div style="color:#ebdcb9;font-size:0.78rem;margin-bottom:20px;font-family:sans-serif;">
                Plot 15, Admiralty Way, Lekki Phase 1, Lagos &bull; Nigeria
              </div>
              <div style="margin-top:20px;margin-bottom:20px;">
                <a href="https://instagram.com/sposhappeal_001" target="_blank" style="text-decoration:none;margin:0 8px;">
                  <img src="https://img.icons8.com/ios-glyphs/30/c8a261/instagram-new.png" alt="Instagram" style="width:24px;height:24px;display:inline-block;vertical-align:middle;border:none;">
                </a>
                <a href="https://web.facebook.com/profile.php?id=61573953737973" target="_blank" style="text-decoration:none;margin:0 8px;">
                  <img src="https://img.icons8.com/ios-glyphs/30/c8a261/facebook-new.png" alt="Facebook" style="width:24px;height:24px;display:inline-block;vertical-align:middle;border:none;">
                </a>
                <a href="https://tiktok.com/@sposhappeal" target="_blank" style="text-decoration:none;margin:0 8px;">
                  <img src="https://img.icons8.com/ios-glyphs/30/c8a261/tiktok.png" alt="TikTok" style="width:24px;height:24px;display:inline-block;vertical-align:middle;border:none;">
                </a>
              </div>
              <div style="color:#a59f95;font-size:0.75rem;margin-top:10px;font-family:sans-serif;">
                &copy; 2026 S'posh APPEAL. All rights reserved.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function dispatchBookingNotifications(booking, actionType) {
  const serviceNames = Array.isArray(booking.services) ? booking.services.map(s => s.name).join(', ') : booking.serviceNames || '';
  const dateStr = booking.dateDisplay;
  const timeStr = booking.time;
  const ref = booking.reference_id;
  const name = booking.clientName;
  const email = booking.clientEmail;
  const phone = booking.clientPhone;
  const total = booking.total;
  const deposit = booking.depositDue;

    const balanceDue = booking.paymentStatus === 'fully_paid' ? 0 : (total - deposit);
  
  let paymentStatusBadge = 'Pending ⚠️';
  let badgeBorder = '#ebdcb9';
  let badgeColor = '#b38f36';
  
  if (booking.paymentStatus === 'paid') {
    paymentStatusBadge = 'Deposit Paid ✅';
    badgeBorder = '#22c87a';
    badgeColor = '#22c87a';
  } else if (booking.paymentStatus === 'fully_paid') {
    paymentStatusBadge = 'Fully Paid ✅';
    badgeBorder = '#22c87a';
    badgeColor = '#22c87a';
  } else if (booking.paymentStatus === 'unpaid') {
    paymentStatusBadge = 'Unpaid ❌';
    badgeBorder = '#e74c3c';
    badgeColor = '#e74c3c';
  } else if (booking.paymentStatus === 'refunded') {
    paymentStatusBadge = 'Refunded ↩️';
    badgeBorder = '#3498db';
    badgeColor = '#3498db';
  }

  // Google Calendar URL Generator
  let calendarUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  try {
    const datePart = booking.dateISO ? booking.dateISO.replace(/-/g, '') : '';
    if (datePart && booking.time) {
      const timeMatch = booking.time.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
      if (timeMatch) {
        const startHour = timeMatch[1];
        const startMin = timeMatch[2];
        const endHour = timeMatch[3];
        const endMin = timeMatch[4];
        const datesParam = datePart + 'T' + startHour + startMin + '00/' + datePart + 'T' + endHour + endMin + '00';
        calendarUrl += '&text=' + encodeURIComponent("S'posh APPEAL Appointment") + 
                       '&dates=' + datesParam + 
                       '&details=' + encodeURIComponent("Reference ID: " + ref + "\nServices: " + serviceNames) + 
                       '&location=' + encodeURIComponent(booking.serviceType === 'home' ? (booking.address || '') : 'Plot 15, Admiralty Way, Lekki Phase 1, Lagos');
      }
    }
  } catch (e) {
    console.error('Error generating calendar url:', e.message);
  }

  let clientSubject = '';
  let clientHtml = '';
  let clientWa = '';

  let adminSubject = '';
  let adminHtml = '';
  let adminWa = '';

  if (actionType === 'confirmed') {
    clientSubject = `Appointment Confirmed! 🌟 Ref: ${ref}`;
    clientHtml = compileEmailTemplate({
      title: "You're All Set!",
      headerAccentColor: "#c8a261",
      name: name,
      description: "Your appointment at S'posh APPEAL has been confirmed and your deposit secured. We have set aside this time exclusively for you. We look forward to welcoming you to the salon. ✨",
      detailsCardTitle: "📋 Booking Details",
      detailsRowsHtml: `
        <tr>
          <td class="detail-label" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#555047;font-size:0.8rem;width:140px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Reference ID</td>
          <td class="detail-value" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#c8a261;font-weight:700;font-size:1.05rem;">${ref}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Service(s)</td>
          <td class="detail-value" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#1a1917;font-weight:700;font-size:1.0rem;">${serviceNames}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Date</td>
          <td class="detail-value" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#1a1917;font-weight:700;font-size:1.0rem;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Time / Slot</td>
          <td class="detail-value" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#1a1917;font-weight:700;font-size:1.0rem;">${timeStr}</td>
        </tr>
        <tr>
          <td class="detail-label" style="padding:12px 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Expert</td>
          <td class="detail-value" style="padding:12px 0;color:#1a1917;font-weight:700;font-size:1.0rem;">${booking.expertName || 'Any Available Expert'}</td>
        </tr>
      `,
      financialsHtml: `
        <div style="border-top:2px solid #ebdcb9;margin-top:24px;padding-top:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="color:#1a1917;font-size:0.95rem;line-height:1.7;font-family:Georgia,serif;">
            <tr>
              <td class="financial-label" style="padding:8px 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;width:140px;">Total Cost</td>
              <td class="financial-value" style="padding:8px 0;color:#1a1917;font-weight:800;font-size:1.1rem;">₦${total.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="financial-label" style="padding:8px 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Deposit Paid</td>
              <td class="financial-value" style="padding:8px 0;color:#1a1917;font-weight:800;font-size:1.1rem;">₦${deposit.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="financial-label" style="padding:8px 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Balance Due</td>
              <td class="financial-value" style="padding:8px 0;color:#1a1917;font-weight:900;font-size:1.2rem;">₦${balanceDue.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="financial-label" style="padding:12px 0 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Payment Status</td>
              <td class="financial-value" style="padding:12px 0 0;">
                <span style="border:2px solid ${badgeColor};color:${badgeColor};padding:6px 16px;border-radius:4px;font-size:0.8rem;font-weight:700;display:inline-block;font-family:sans-serif;text-transform:uppercase;letter-spacing:1.5px;background:transparent;">
                  ${paymentStatusBadge}
                </span>
              </td>
            </tr>
          </table>
        </div>
      `,
      buttonsHtml: `
        <a href="https://sposhappeal.vercel.app/booking.html?email=${email}" class="action-btn" style="display:inline-block;background:#1a1917;color:#FAF6F0;text-decoration:none;padding:16px 32px;border-radius:6px;font-size:0.85rem;font-weight:700;margin:8px 6px;letter-spacing:2px;text-transform:uppercase;border:1px solid #1a1917;box-shadow: 0 4px 10px rgba(0,0,0,0.15);">View Booking</a>
        <a href="${calendarUrl}" target="_blank" class="action-btn" style="display:inline-block;background:#1a1917;color:#FAF6F0;text-decoration:none;padding:16px 32px;border-radius:6px;font-size:0.85rem;font-weight:700;margin:8px 6px;letter-spacing:2px;text-transform:uppercase;border:1px solid #1a1917;box-shadow: 0 4px 10px rgba(0,0,0,0.15);">📅 Add to Calendar</a>
        <a href="https://wa.me/2347011083217" target="_blank" class="action-btn" style="display:inline-block;background:transparent;color:#25d366;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:0.85rem;font-weight:700;margin:8px 6px;letter-spacing:2px;text-transform:uppercase;border:1px solid #25d366;vertical-align:middle;">
          <img src="https://img.icons8.com/ios-glyphs/30/25d366/whatsapp.png" alt="WhatsApp" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;border:none;">WhatsApp Support
        </a>
      `,
      nextStepsHtml: `
        <div style="background:#ffffff;border:1px dashed #c8a261;border-radius:12px;padding:20px;margin-top:24px;box-shadow:0 4px 15px rgba(26,25,23,0.01);">
          <h4 style="color:#1a1917;margin:0 0 16px;font-size:0.85rem;letter-spacing:3px;text-transform:uppercase;font-weight:700;font-family:sans-serif;border-bottom:1px dashed #ebdcb9;padding-bottom:10px;">📍 Next Steps & Info</h4>
          <ul style="color:#1a1917;font-size:0.92rem;line-height:1.7;margin:0;padding-left:20px;font-family:Georgia,serif;">
            <li style="margin-bottom:10px;"><strong style="color:#1a1917;font-weight:700;">Service Type:</strong> ${booking.serviceType === 'home' ? 'Home Service (Our expert will arrive at: <span style="color:#c8a261;font-weight:600;">' + (booking.address || '') + '</span>)' : 'In-Studio (Plot 15, Admiralty Way, Lekki Phase 1, Lagos)'}</li>
            ${booking.serviceType === 'home' ? '<li style="margin-bottom:10px;"><strong style="color:#1a1917;font-weight:700;">Preparation:</strong> Please prepare a clean space with power access for our expert prior to arrival.</li>' : ''}
            <li style="margin-bottom:10px;"><strong style="color:#1a1917;font-weight:700;">Contact Number:</strong> <a href="tel:+2349131282016" style="color:#c8a261;text-decoration:none;font-weight:600;">09131282016</a></li>
            <li><strong style="color:#1a1917;font-weight:700;">Policy:</strong> Need to change your slot? Contact us at least <span style="color:#c8a261;font-weight:600;">24 hours before</span> your appointment. Rescheduling or cancellation within 24 hours is locked.</li>
          </ul>
        </div>
      `
    });
    clientWa = `Hi ${name}, your booking at S'posh APPEAL is CONFIRMED! 🎉\n\nRef: ${ref}\nServices: ${serviceNames}\nDate: ${dateStr}\nTime: ${timeStr}\nDeposit Paid: ₦${deposit.toLocaleString()}\n\nThank you for choosing S'posh APPEAL!`;

    adminSubject = `[ALERT] New Confirmed Booking 🌟 Ref: ${ref}`;
    adminHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.6;">
        <h2 style="color: #2ecc71;">New Confirmed Appointment</h2>
        <p>A customer has successfully completed deposit payment and confirmed their booking.</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px; font-weight: bold; width: 120px;">Reference ID:</td><td style="padding: 8px; font-weight: bold; color: #E0447A;">${ref}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Client Name:</td><td style="padding: 8px;">${name}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Client Contact:</td><td style="padding: 8px;">${phone} &bull; dots</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Services:</td><td style="padding: 8px;">${serviceNames}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Date & Time:</td><td style="padding: 8px;">${dateStr} (${timeStr})</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Service Type:</td><td style="padding: 8px;">${booking.serviceType === 'home' ? 'Home Service (Address: ' + booking.address + ')' : 'In-Studio'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Total Price:</td><td style="padding: 8px;">₦${total.toLocaleString()}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Deposit Paid:</td><td style="padding: 8px; font-weight: bold; color: green;">₦${deposit.toLocaleString()}</td></tr>
        </table>
      </div>`;
    adminWa = `[ALERT] New Confirmed Booking! 🎉.\n\nRef: ${ref}\nClient: ${name} (${phone})\nServices: ${serviceNames}\nDate/Time: ${dateStr} (&nbsp;${timeStr})\nType: &nbsp;${booking.serviceType === 'home' ? 'Home' : 'Salon'}\nTotal: ₦${total.toLocaleString()}`;

  } else if (actionType === 'rescheduled') {
    clientSubject = `Appointment Rescheduled 📅 Ref: ${ref}`;
    clientHtml = compileEmailTemplate({
      title: "Appointment Moved!",
      headerAccentColor: "#3498db",
      name: name,
      description: "Your S'posh APPEAL appointment has been successfully rescheduled. Below are your updated booking details:",
      detailsCardTitle: "📅 Updated Summary",
      detailsRowsHtml: `
        <tr>
          <td class="detail-label" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#555047;font-size:0.8rem;width:140px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Reference ID</td>
          <td class="detail-value" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#e0447a;font-weight:700;font-size:1.05rem;">${ref}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Service(s)</td>
          <td class="detail-value" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#1a1917;font-weight:700;font-size:1.0rem;">${serviceNames}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">New Date</td>
          <td class="detail-value" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#3498db;font-weight:700;font-size:1.05rem;">${dateStr}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">New Time</td>
          <td class="detail-value" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#3498db;font-weight:700;font-size:1.05rem;">${timeStr}</td>
        </tr>
        <tr>
          <td class="detail-label" style="padding:12px 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Expert</td>
          <td class="detail-value" style="padding:12px 0;color:#1a1917;font-weight:700;font-size:1.0rem;">${booking.expertName || 'Any Available Expert'}</td>
        </tr>
      `,
      financialsHtml: `
        <div style="border-top:2px solid #ebdcb9;margin-top:24px;padding-top:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="color:#1a1917;font-size:0.95rem;line-height:1.7;font-family:Georgia,serif;">
            <tr>
              <td class="financial-label" style="padding:8px 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;width:140px;">Total Cost</td>
              <td class="financial-value" style="padding:8px 0;color:#1a1917;font-weight:800;font-size:1.1rem;">₦${total.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="financial-label" style="padding:8px 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Deposit Paid</td>
              <td class="financial-value" style="padding:8px 0;color:#1a1917;font-weight:800;font-size:1.1rem;">₦${deposit.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="financial-label" style="padding:8px 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Balance Due</td>
              <td class="financial-value" style="padding:8px 0;color:#1a1917;font-weight:900;font-size:1.2rem;">₦${balanceDue.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="financial-label" style="padding:12px 0 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Payment Status</td>
              <td class="financial-value" style="padding:12px 0 0;">
                <span style="border:2px solid ${badgeColor};color:${badgeColor};padding:6px 16px;border-radius:4px;font-size:0.8rem;font-weight:700;display:inline-block;font-family:sans-serif;text-transform:uppercase;letter-spacing:1.5px;background:transparent;">
                  ${paymentStatusBadge}
                </span>
              </td>
            </tr>
          </table>
        </div>
      `,
      buttonsHtml: `
        <a href="https://sposhappeal.vercel.app/booking.html?email=${email}" class="action-btn" style="display:inline-block;background:#1a1917;color:#FAF6F0;text-decoration:none;padding:16px 32px;border-radius:6px;font-size:0.85rem;font-weight:700;margin:8px 6px;letter-spacing:2px;text-transform:uppercase;border:1px solid #1a1917;box-shadow: 0 4px 10px rgba(0,0,0,0.15);">View Booking</a>
        <a href="${calendarUrl}" target="_blank" class="action-btn" style="display:inline-block;background:#1a1917;color:#FAF6F0;text-decoration:none;padding:16px 32px;border-radius:6px;font-size:0.85rem;font-weight:700;margin:8px 6px;letter-spacing:2px;text-transform:uppercase;border:1px solid #1a1917;box-shadow: 0 4px 10px rgba(0,0,0,0.15);">📅 Add to Calendar</a>
        <a href="https://wa.me/2347011083217" target="_blank" class="action-btn" style="display:inline-block;background:transparent;color:#25d366;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:0.85rem;font-weight:700;margin:8px 6px;letter-spacing:2px;text-transform:uppercase;border:1px solid #25d366;vertical-align:middle;">
          <img src="https://img.icons8.com/ios-glyphs/30/25d366/whatsapp.png" alt="WhatsApp" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;border:none;">WhatsApp Support
        </a>
      `,
      nextStepsHtml: `
        <div style="background:#ffffff;border:1px dashed #c8a261;border-radius:12px;padding:20px;margin-top:24px;box-shadow:0 4px 15px rgba(26,25,23,0.01);">
          <h4 style="color:#1a1917;margin:0 0 16px;font-size:0.85rem;letter-spacing:3px;text-transform:uppercase;font-weight:700;font-family:sans-serif;border-bottom:1px dashed #ebdcb9;padding-bottom:10px;">📍 Next Steps & Info</h4>
          <ul style="color:#1a1917;font-size:0.92rem;line-height:1.7;margin:0;padding-left:20px;font-family:Georgia,serif;">
            <li style="margin-bottom:10px;"><strong style="color:#1a1917;font-weight:700;">Service Type:</strong> ${booking.serviceType === 'home' ? 'Home Service (Our expert will arrive at: <span style="color:#c8a261;font-weight:600;">' + (booking.address || '') + '</span>)' : 'In-Studio (Plot 15, Admiralty Way, Lekki Phase 1, Lagos)'}</li>
            ${booking.serviceType === 'home' ? '<li style="margin-bottom:10px;"><strong style="color:#1a1917;font-weight:700;">Preparation:</strong> Please prepare a clean space with power access for our expert prior to arrival.</li>' : ''}
            <li style="margin-bottom:10px;"><strong style="color:#1a1917;font-weight:700;">Contact Number:</strong> <a href="tel:+2349131282016" style="color:#c8a261;text-decoration:none;font-weight:600;">09131282016</a></li>
            <li><strong style="color:#1a1917;font-weight:700;">Policy:</strong> Need to change your slot? Contact us at least <span style="color:#c8a261;font-weight:600;">24 hours before</span> your appointment. Rescheduling or cancellation within 24 hours is locked.</li>
          </ul>
        </div>
      `
    });
    clientWa = `Hi ${name}, your S'posh APPEAL appointment has been RESCHEDULED to ${dateStr} (&nbsp;${timeStr})! Ref: ${ref}`;

    adminSubject = `[ALERT] Appointment Rescheduled 📅 Ref: ${ref}`;
    adminHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.6;">
        <h2 style="color: #3498db;">Appointment Rescheduled</h2>
        <p>Booking ${ref} has been rescheduled to a new date/time.</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px; font-weight: bold; width: 120px;">Reference ID:</td><td style="padding: 8px; font-weight: bold; color: #E0447A;">${ref}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Client Name:</td><td style="padding: 8px;">${name}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">New Date & Time:</td><td style="padding: 8px; font-weight: bold; color: #3498db;">&nbsp;${dateStr} (&nbsp;${timeStr})</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Services:</td><td style="padding: 8px;">${serviceNames}</td></tr>
        </table>
      </div>`;
    adminWa = `[ALERT] Booking Rescheduled!\n\nRef: &nbsp;${ref}\nClient: &nbsp;${name}\nNew Date/Time: &nbsp;${dateStr} (&nbsp;${timeStr})`;

  } else if (actionType === 'cancelled') {
    clientSubject = `Appointment Cancelled ❌ Ref: ${ref}`;
    clientHtml = compileEmailTemplate({
      title: "Appointment Cancelled",
      headerAccentColor: "#e74c3c",
      name: name,
      description: "Your S'posh APPEAL appointment has been cancelled. Below is a summary of the cancelled appointment:",
      detailsCardTitle: "❌ Cancelled Summary",
      detailsRowsHtml: `
        <tr>
          <td class="detail-label" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#555047;font-size:0.8rem;width:140px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Reference ID</td>
          <td class="detail-value" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#e74c3c;font-weight:700;font-size:1.05rem;">${ref}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Service(s)</td>
          <td class="detail-value" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#1a1917;font-weight:700;font-size:1.0rem;">${serviceNames}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Original Date</td>
          <td class="detail-value" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#1a1917;font-weight:700;font-size:1.0rem;">${dateStr}</td>
        </tr>
        <tr>
          <td class="detail-label" style="padding:12px 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Original Time</td>
          <td class="detail-value" style="padding:12px 0;color:#1a1917;font-weight:700;font-size:1.0rem;">${timeStr}</td>
        </tr>
      `,
      financialsHtml: `
        <div style="border-top:2px solid #ebdcb9;margin-top:24px;padding-top:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="color:#1a1917;font-size:0.95rem;line-height:1.7;font-family:Georgia,serif;">
            <tr>
              <td class="financial-label" style="padding:8px 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;width:140px;">Total Cost</td>
              <td class="financial-value" style="padding:8px 0;color:#1a1917;font-weight:800;font-size:1.1rem;">₦${total.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="financial-label" style="padding:8px 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Deposit Refund</td>
              <td class="financial-value" style="padding:8px 0;color:#1a1917;font-weight:800;font-size:1.1rem;">₦${deposit.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="financial-label" style="padding:12px 0 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Booking Status</td>
              <td class="financial-value" style="padding:12px 0 0;">
                <span style="border:2px solid #e74c3c;color:#e74c3c;padding:6px 16px;border-radius:4px;font-size:0.8rem;font-weight:700;display:inline-block;font-family:sans-serif;text-transform:uppercase;letter-spacing:1.5px;background:transparent;">
                  CANCELLED ❌
                </span>
              </td>
            </tr>
          </table>
        </div>
      `,
      buttonsHtml: `
        <a href="https://wa.me/2347011083217" target="_blank" class="action-btn" style="display:inline-block;background:transparent;color:#25d366;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:0.85rem;font-weight:700;margin:8px 6px;letter-spacing:2px;text-transform:uppercase;border:1px solid #25d366;vertical-align:middle;">
          <img src="https://img.icons8.com/ios-glyphs/30/25d366/whatsapp.png" alt="WhatsApp" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;border:none;">WhatsApp Support
        </a>
      `,
      nextStepsHtml: `
        <div style="background:#ffffff;border:1px dashed #e74c3c;border-radius:12px;padding:20px;margin-top:24px;box-shadow:0 4px 15px rgba(26,25,23,0.01);">
          <h4 style="color:#e74c3c;margin:0 0 16px;font-size:0.85rem;letter-spacing:3px;text-transform:uppercase;font-weight:700;font-family:sans-serif;border-bottom:1px dashed #ebdcb9;padding-bottom:10px;">📍 Refunds & Info</h4>
          <ul style="color:#1a1917;font-size:0.92rem;line-height:1.7;margin:0;padding-left:20px;font-family:Georgia,serif;">
            <li style="margin-bottom:10px;"><strong style="color:#1a1917;font-weight:700;">Refunds:</strong> If you did not request this cancellation or have questions about a deposit refund, please contact us on WhatsApp as soon as possible.</li>
            <li><strong style="color:#1a1917;font-weight:700;">Contact Number:</strong> <a href="tel:+2349131282016" style="color:#e0447a;text-decoration:none;font-weight:600;">09131282016</a></li>
          </ul>
        </div>
      `
    });
    clientWa = `Hi ${name}, your S'posh APPEAL booking ${ref} scheduled for ${dateStr} has been CANCELLED. If you did not request this, please contact us immediately.`;

    adminSubject = `[ALERT] Appointment Cancelled ❌ Ref: ${ref}`;
    adminHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.6;">
        <h2 style="color: #e74c3c;">Appointment Cancelled</h2>
        <p>Booking ${ref} for client ${name} has been cancelled.</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px; font-weight: bold; width: 120px;">Reference ID:</td><td style="padding: 8px; font-weight: bold;">${ref}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Client:</td><td style="padding: 8px;">${name}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Original Date:</td><td style="padding: 8px;">${dateStr}</td></tr>
        </table>
      </div>`;
    adminWa = `[ALERT] Booking Cancelled!\n\nRef: &nbsp;${ref}\nClient: &nbsp;${name}\nOriginal Date: &nbsp;${dateStr}`;

  } else if (actionType === 'pending') {
    clientSubject = `Booking Received ⏳ Complete Your Payment | Ref: ${ref}`;
    clientHtml = compileEmailTemplate({
      title: "Booking Received!",
      headerAccentColor: "#c8a261",
      name: name,
      description: "We have reserved your slot at S'posh APPEAL! Complete your deposit payment below to confirm your appointment.",
      detailsCardTitle: "⏳ Booking Summary",
      detailsRowsHtml: `
        <tr>
          <td class="detail-label" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#555047;font-size:0.8rem;width:140px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Reference ID</td>
          <td class="detail-value" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#e0447a;font-weight:700;font-size:1.05rem;">${ref}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Service(s)</td>
          <td class="detail-value" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#1a1917;font-weight:700;font-size:1.0rem;">${serviceNames}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Date</td>
          <td class="detail-value" style="padding:12px 0;border-bottom:1px solid #ebdcb9;color:#1a1917;font-weight:700;font-size:1.0rem;">${dateStr}</td>
        </tr>
        <tr>
          <td class="detail-label" style="padding:12px 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Time / Slot</td>
          <td class="detail-value" style="padding:12px 0;color:#1a1917;font-weight:700;font-size:1.0rem;">${timeStr}</td>
        </tr>
      `,
      financialsHtml: `
        <div style="border-top:2px solid #ebdcb9;margin-top:24px;padding-top:24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="color:#1a1917;font-size:0.95rem;line-height:1.7;font-family:Georgia,serif;">
            <tr>
              <td class="financial-label" style="padding:8px 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;width:140px;">Total Cost</td>
              <td class="financial-value" style="padding:8px 0;color:#1a1917;font-weight:800;font-size:1.1rem;">₦${total.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="financial-label" style="padding:8px 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Deposit Due</td>
              <td class="financial-value" style="padding:8px 0;color:#e74c3c;font-weight:900;font-size:1.2rem;">₦${deposit.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="financial-label" style="padding:8px 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Balance Due</td>
              <td class="financial-value" style="padding:8px 0;color:#1a1917;font-weight:800;font-size:1.1rem;">₦${balanceDue.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="financial-label" style="padding:12px 0 0;color:#555047;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-family:sans-serif;">Payment Status</td>
              <td class="financial-value" style="padding:12px 0 0;">
                <span style="border:2px solid #e67e22;color:#e67e22;padding:6px 16px;border-radius:4px;font-size:0.8rem;font-weight:700;display:inline-block;font-family:sans-serif;text-transform:uppercase;letter-spacing:1.5px;background:transparent;">
                  AWAITING DEPOSIT ⏳
                </span>
              </td>
            </tr>
          </table>
        </div>
      `,
      buttonsHtml: `
        <a href="https://sposhappeal.vercel.app/booking.html?ref=${ref}" class="action-btn" style="display:inline-block;background:#e0447a;color:#ffffff;text-decoration:none;padding:16px 32px;border-radius:6px;font-size:0.85rem;font-weight:700;margin:8px 6px;letter-spacing:2px;text-transform:uppercase;border:1px solid #e0447a;box-shadow: 0 4px 12px rgba(224,68,122,0.25);">Pay Deposit Now</a>
        <a href="https://wa.me/2347011083217" target="_blank" class="action-btn" style="display:inline-block;background:transparent;color:#25d366;text-decoration:none;padding:14px 28px;border-radius:6px;font-size:0.85rem;font-weight:700;margin:8px 6px;letter-spacing:2px;text-transform:uppercase;border:1px solid #25d366;vertical-align:middle;">
          <img src="https://img.icons8.com/ios-glyphs/30/25d366/whatsapp.png" alt="WhatsApp" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:6px;border:none;">WhatsApp Support
        </a>
      `,
      nextStepsHtml: `
        <div style="background:#ffffff;border:1px dashed #ebdcb9;border-radius:12px;padding:20px;margin-top:24px;box-shadow:0 4px 15px rgba(26,25,23,0.01);">
          <h4 style="color:#1a1917;margin:0 0 16px;font-size:0.85rem;letter-spacing:3px;text-transform:uppercase;font-weight:700;font-family:sans-serif;border-bottom:1px dashed #ebdcb9;padding-bottom:10px;">⚠️ Secure Reservation</h4>
          <ul style="color:#1a1917;font-size:0.92rem;line-height:1.7;margin:0;padding-left:20px;font-family:Georgia,serif;">
            <li style="margin-bottom:10px;"><strong style="color:#1a1917;font-weight:700;">Expiry:</strong> We will reserve your selected slot for up to <span style="color:#e0447a;font-weight:600;">30 minutes</span>. If deposit payment is not completed within this time, the reservation will expire and the slot will be released back to the public.</li>
            <li><strong style="color:#1a1917;font-weight:700;">Questions:</strong> Having trouble paying? Message us on WhatsApp support.</li>
          </ul>
        </div>
      `
    });
    clientWa = `Hi ${name}, your booking at S'posh APPEAL has been received! ⏳\n\nRef: &nbsp;${ref}\nServices: &nbsp;${serviceNames}\nDate: &nbsp;${dateStr}\nTime: &nbsp;${timeStr}\nDeposit Due: ₦&nbsp;${deposit.toLocaleString()}\n\n⚠️ Your slot is NOT confirmed until the deposit is paid. Please complete payment on our booking page.`;

    adminSubject = `[ALERT] Pending Booking ⏳ Ref: ${ref}`;
    adminHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.6;">
        <h2 style="color: #f39c12;">New Pending Booking (Awaiting Payment)</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px; font-weight: bold; width: 120px;">Reference ID:</td><td style="padding: 8px; font-weight: bold; color: #E0447A;">${ref}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Client:</td><td style="padding: 8px;">${name} &bull; ${phone} &bull; dots</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Services:</td><td style="padding: 8px;">${serviceNames}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Date & Time:</td><td style="padding: 8px;">${dateStr} (${timeStr})</td></tr>
          <tr><td style="padding: 8px; color: #f39c12; font-weight: bold;">Status:</td><td style="padding: 8px;">PENDING PAYMENT</td></tr>
        </table>
      </div>`;
    adminWa = `[ALERT] Pending Booking!\n\nRef: &nbsp;${ref}\nClient: ${name} (${phone})\nServices: ${serviceNames}\nDate/Time: ${dateStr} (${timeStr})\nStatus: AWAITING PAYMENT`;
  }

  if (email) {
    await sendEmail(email, clientSubject, clientHtml);
  }
  if (phone) {
    await sendWhatsAppMessage(phone, clientWa);
  }

  // Dispatch Admin Notifications
  if (adminEmail) {
    await sendEmail(adminEmail, adminSubject, adminHtml);
  }
  if (adminWhatsApp) {
    await sendWhatsAppMessage(adminWhatsApp, adminWa);
  }
}


// ─── Server-side Sanitization Helper ────────────────────────
function sanitizeInput(str) {
  if (!str) return '';
  return String(str).replace(/<[^>]*>/g, '').trim();
}

// ─── XML Escape Helper (for Twilio TwiML responses) ─────────
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const Booking = require('./models/Booking');
const Staff = require('./models/Staff');
const { ServiceCategory, ServiceOption } = require('./models/Service');

// ─── Shared Catalog Constants ────────────────────────────────────────────────
// Single source of truth for both the in-memory mock store AND seedDatabase().
// To add/edit services or staff: update here only.

const DEFAULT_CATEGORIES = [
  { id: 'hair_making', name: 'Hair Making', icon: 'fa-solid fa-magic', priceFrom: 5000, description: "Natural Hair Styling, Braids, Weaves, Twists, Wash and Set. Hair Treatments and Retouching.", displayOrder: 1 },
  { id: 'wigs', name: 'Wig Install & Sales', icon: 'fa-solid fa-crown', priceFrom: 7000, description: "Wig Revamping & Restyling, frontal or closure custom installations, custom wig making, and premium wig sales.", displayOrder: 2 },
  { id: 'nails', name: 'Nails', icon: 'fa-solid fa-hand-sparkles', priceFrom: 3000, description: "Deep exfoliating hand & foot nail care, cuticle cleaning, massage, custom nail art and gel polish.", displayOrder: 3 },
  { id: 'lash', name: 'Lash & Brow', icon: 'fa-solid fa-eye', priceFrom: 8000, description: "Natural individual lash extensions and volume lash sets for a perfect defined look.", displayOrder: 4 },
  { id: 'makeup', name: 'Makeup Studio', icon: 'fa-solid fa-wand-magic-sparkles', priceFrom: 8000, description: "Flawless glam cosmetics beats, everyday natural makeup, and luxury bridal makeup sets.", displayOrder: 5 },
  { id: 'care', name: 'Personal Care', icon: 'fa-solid fa-spa', priceFrom: 10000, description: "Luxury facial & mask treatments, steam facials, deep pore extraction, and skincare sessions.", displayOrder: 6 },
  { id: 'men', name: "Men's Grooming", icon: 'fa-solid fa-user-tie', priceFrom: 2500, description: "Precision cuts, fades, and styles tailored for men. Beard sculpting, trimming, and hot towel finishes.", displayOrder: 7 }
];

const DEFAULT_OPTIONS = [
  // men
  { id: 'haircut-cut', name: 'Precision Haircut', price: 4000, durationMinutes: 45, categoryId: 'men' },
  { id: 'haircut-fade', name: 'Fade Cut', price: 5000, durationMinutes: 60, categoryId: 'men' },
  { id: 'haircut-beard', name: 'Beard Grooming', price: 5000, durationMinutes: 60, categoryId: 'men' },
  { id: 'haircut-towel', name: 'Hot Towel Finish', price: 3000, durationMinutes: 30, categoryId: 'men' },
  // hair_making
  { id: 'styling-natural', name: 'Natural Hair Styling', price: 5000, durationMinutes: 90, categoryId: 'hair_making' },
  { id: 'styling-braids', name: 'Braids', price: 12000, durationMinutes: 180, categoryId: 'hair_making' },
  { id: 'styling-weaves', name: 'Weaves', price: 10000, durationMinutes: 120, categoryId: 'hair_making' },
  { id: 'styling-twists', name: 'Twists', price: 8000, durationMinutes: 120, categoryId: 'hair_making' },
  { id: 'styling-wash-set', name: 'Wash and Set', price: 5000, durationMinutes: 60, categoryId: 'hair_making' },
  { id: 'styling-treatment', name: 'Hair Treatment', price: 7000, durationMinutes: 75, categoryId: 'hair_making' },
  { id: 'styling-retouch', name: 'Retouching', price: 6000, durationMinutes: 75, categoryId: 'hair_making' },
  { id: 'locs-starter', name: 'Starter Locs', price: 15000, durationMinutes: 180, categoryId: 'hair_making' },
  { id: 'locs-micro', name: 'SisterLocks / Micro Locs Installation', price: 25000, durationMinutes: 240, categoryId: 'hair_making' },
  { id: 'locs-maintenance', name: 'Maintenance and Retouch', price: 10000, durationMinutes: 120, categoryId: 'hair_making' },
  { id: 'locs-styling', name: 'Loc Styling', price: 8000, durationMinutes: 90, categoryId: 'hair_making' },
  { id: 'locs-coloring', name: 'Loc Coloring', price: 12000, durationMinutes: 120, categoryId: 'hair_making' },
  { id: 'locs-treatment', name: 'Loc Treatment', price: 9000, durationMinutes: 90, categoryId: 'hair_making' },
  // wigs
  { id: 'wig-revamp', name: 'Wig Revamping', price: 8000, durationMinutes: 90, categoryId: 'wigs' },
  { id: 'wig-restyle', name: 'Wig Restyling', price: 7000, durationMinutes: 75, categoryId: 'wigs' },
  { id: 'wig-frontal', name: 'Frontal Installation', price: 12000, durationMinutes: 120, categoryId: 'wigs' },
  { id: 'wig-closure', name: 'Closure Installation', price: 10000, durationMinutes: 90, categoryId: 'wigs' },
  { id: 'wig-custom', name: 'Custom Wig Making', price: 18000, durationMinutes: 180, categoryId: 'wigs' },
  { id: 'wig-sale-closure', name: 'Premium Closure Wig (Purchase)', price: 85000, durationMinutes: 30, categoryId: 'wigs' },
  { id: 'wig-sale-frontal', name: 'Premium Frontal Wig (Purchase)', price: 110000, durationMinutes: 30, categoryId: 'wigs' },
  // nails
  { id: 'nails-pedicure', name: 'Pedicure', price: 7000, durationMinutes: 60, categoryId: 'nails' },
  { id: 'nails-manicure', name: 'Manicure', price: 6000, durationMinutes: 45, categoryId: 'nails' },
  { id: 'nails-pedi-mani', name: 'Pedicure and Manicure', price: 10000, durationMinutes: 75, categoryId: 'nails' },
  { id: 'nails-gel', name: 'Luxury Gel Polish', price: 5000, durationMinutes: 45, categoryId: 'nails' },
  { id: 'nails-cuticle', name: 'Cuticle Cleaning', price: 3000, durationMinutes: 30, categoryId: 'nails' },
  { id: 'makeup-nail-art', name: 'Custom Nail Art', price: 7000, durationMinutes: 75, categoryId: 'nails' },
  // lash
  { id: 'makeup-lash', name: 'Natural Individual Lash Extensions', price: 10000, durationMinutes: 90, categoryId: 'lash' },
  { id: 'lash-volume', name: 'Volume Lash Extensions', price: 15000, durationMinutes: 105, categoryId: 'lash' },
  { id: 'lash-brow-tint', name: 'Brow Tint & Shaping', price: 5000, durationMinutes: 45, categoryId: 'lash' },
  // makeup
  { id: 'makeup-natural', name: 'Everyday Natural Makeup', price: 8000, durationMinutes: 60, categoryId: 'makeup' },
  { id: 'makeup-glam', name: 'Flawless Glam Makeup', price: 12000, durationMinutes: 90, categoryId: 'makeup' },
  { id: 'makeup-bridal', name: 'Bridal Glam', price: 25000, durationMinutes: 150, categoryId: 'makeup' },
  // care
  { id: 'care-mask', name: 'Facial & Mask Treatment', price: 10000, durationMinutes: 75, categoryId: 'care' },
  { id: 'care-steam', name: 'Steam Facial', price: 8000, durationMinutes: 60, categoryId: 'care' },
  { id: 'care-pore', name: 'Deep Pore Extraction', price: 12000, durationMinutes: 90, categoryId: 'care' },
  { id: 'care-session', name: 'Skincare Session', price: 15000, durationMinutes: 90, categoryId: 'care' }
];

const DEFAULT_STAFF = [
  {
    id: 'temi', name: 'Stylist 1', role: 'Lead Stylist & Wig Expert',
    bio: '7+ years crafting iconic hair and wig transformations.', ig: '#',
    img: 'assets/stylist_kunle.jpg',
    passcodeHash: process.env.STAFF_PASSWORD || 'change_me_immediately',
    permissions: { canViewBookings: true, canCancelBookings: true, canRescheduleBookings: true, canEditCatalog: true }
  },
  {
    id: 'adaeze', name: 'Stylist 2', role: 'Nail Tech & Pedicure Specialist',
    bio: '5 years of nail artistry and luxury pedicure treatments.', ig: '#',
    img: 'assets/stylist_kunle.jpg',
    passcodeHash: process.env.STAFF_PASSWORD || 'change_me_immediately',
    permissions: { canViewBookings: true, canCancelBookings: false, canRescheduleBookings: false, canEditCatalog: false }
  },
  {
    id: 'chisom', name: 'Stylist 3', role: 'Lash & Brow Specialist',
    bio: 'Expert in lash extensions and brow sculpting for every eye shape.', ig: '#',
    img: 'assets/stylist_kunle.jpg',
    passcodeHash: process.env.STAFF_PASSWORD || 'change_me_immediately',
    permissions: { canViewBookings: true, canCancelBookings: false, canRescheduleBookings: true, canEditCatalog: false }
  },
  {
    id: 'kunle', name: 'Stylist 4', role: "Men's Grooming Specialist",
    bio: 'Precision cuts and clean fades, every time.', ig: '#',
    img: 'assets/stylist_kunle.jpg',
    passcodeHash: process.env.STAFF_PASSWORD || 'change_me_immediately',
    permissions: { canViewBookings: true, canCancelBookings: false, canRescheduleBookings: false, canEditCatalog: false }
  }
];

// ─── In-memory mock stores (used when MongoDB is offline) ────────────────────
let mockCategories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
let mockOptions = DEFAULT_OPTIONS.map(o => ({ ...o }));
let mockStaff = DEFAULT_STAFF.map(s => ({ ...s, passcode: s.passcodeHash }));

let mockBookings = [];

const app = express();

// Enable trust proxy for Vercel — ensures rate-limiting sees real client IPs
app.set('trust proxy', 1);

// ─── Security Headers ───────────────────────────────────────
app.use(helmet());

// ── Inline NoSQL injection protection ──────────────────────────
app.use((req, _res, next) => {
  const strip = (obj) => {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(k => {
        if (k.startsWith('$') || k.startsWith('.')) delete obj[k];
        else strip(obj[k]);
      });
    }
  };
  strip(req.body); strip(req.query); strip(req.params);
  next();
});

// ── Inline XSS sanitizer ───────────────────────────────────────
const _xss = (v) => typeof v === 'string'
  ? v.trim().replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;')
  : v;

// ─── Rate Limiting ──────────────────────────────────────────
// Booking creation: 10 per IP per hour
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many booking requests from this IP. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment endpoints: 20 per IP per hour
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many payment requests from this IP. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Staff/admin: 15 attempts per IP per 15 minutes
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Please wait a few minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Core Middleware ────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'https://sposhappeal.vercel.app',
      'https://sposhappeal.vercel.app',
      'http://localhost:3000',
      'http://localhost:5000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5000'
    ];
    // Allow requests with no origin (Vercel SSR, Paystack webhooks, mobile apps)
    if (!origin || allowed.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));
// Capture raw body buffer for signature verification
app.use(express.json({
  limit: '5mb', // Increased for base64 staff photo uploads
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

async function seedDatabase() {
  try {
    const categoryCount = await ServiceCategory.countDocuments();
    if (categoryCount === 0) {
      console.log('Seeding service categories...');
      await ServiceCategory.insertMany(DEFAULT_CATEGORIES);
    }

    const optionCount = await ServiceOption.countDocuments();
    if (optionCount === 0) {
      console.log('Seeding service options...');
      await ServiceOption.insertMany(DEFAULT_OPTIONS);
    }

    const staffCount = await Staff.countDocuments();
    if (staffCount === 0) {
      console.log('Seeding staff...');
      // passcodeHash values here are PLAIN TEXT — the pre-save hook will bcrypt them
      // In production, update staff passcodes via the admin API after first deploy
      for (const staffData of DEFAULT_STAFF) {
        const s = new Staff(staffData);
        await s.save();
      }
    }

    console.log('[DB] Seed check complete.');
  } catch (err) {
    console.error('[DB] Seed error:', err);
  }
}

// MongoDB Connection (serverless-optimized: caches connection across warm invocations)
mongoose.set('bufferCommands', false);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sposh_appeal';
let cachedConnection = null;
async function connectDB() {
  if (cachedConnection && mongoose.connection.readyState === 1) return cachedConnection;
  try {
    cachedConnection = await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('MongoDB Connected successfully.');
    await seedDatabase();
    return cachedConnection;
  } catch (err) {
    console.error('MongoDB Connection error:', err);
    cachedConnection = null;
  }
}
connectDB();

// Middleware: ensure DB is connected before any /api route
app.use('/api', async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
  } catch (err) {
    console.error('[DB Middleware] Failed to connect:', err.message);
  }
  next();
});

// Helper: Make HTTP request to Paystack API
function initializePaystackTransaction(email, amountKobo, reference, callbackUrl) {
  return new Promise((resolve, reject) => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey || secretKey.startsWith('sk_test_mock')) {
      // Simulate mock environment fallback
      return resolve({
        status: true,
        data: {
          authorization_url: 'mock-checkout',
          reference: reference
        }
      });
    }

    const payload = JSON.stringify({
      email: email,
      amount: amountKobo,
      reference: reference,
      callback_url: callbackUrl || process.env.PAYSTACK_CALLBACK_URL || 'https://sposhappeal.vercel.app/booking.html'
    });

    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: '/transaction/initialize',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200 && parsed.status) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || `HTTP error ${res.statusCode}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(payload);
    req.end();
  });
}

async function getStaffMemberByPasscode(passcode) {
  if (!passcode) return null;
  const useDb = mongoose.connection.readyState === 1;
  if (useDb) {
    // Can't query by hash — fetch all and compare using bcrypt
    const allStaff = await Staff.find({});
    for (const staff of allStaff) {
      if (await staff.verifyPasscode(passcode)) return staff;
    }
    return null;
  } else {
    // Mock fallback: plain comparison
    return mockStaff.find(s => s.passcode === passcode) || null;
  }
}


// ── DB Status endpoint (for staff portal mock-mode indicator) ──
app.get('/api/status', (req, res) => {
  const isLive = mongoose.connection.readyState === 1;
  res.json({ db: isLive ? 'live' : 'mock', timestamp: new Date().toISOString() });
});

// ─── API ROUTES ─────────────────────────────────────────────────────────────
// ─── CRON JOBS ────────────────────────────────────────────────────────────────

// 24hr Appointment Reminder (GET/POST /api/cron/reminders)
// Called daily by Vercel Cron — sends WhatsApp reminder to clients
// whose appointment is tomorrow. Protected by CRON_SECRET env var.
app.all('/api/cron/reminders', async (req, res) => {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = req.headers['authorization'];
    const secret = req.headers['x-cron-secret'] || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized cron request.' });
    }

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const startOfTomorrow = new Date(tomorrow);
    startOfTomorrow.setHours(0, 0, 0, 0);
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);
    const tomorrowStr = tomorrow.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
    });

    const useDb = mongoose.connection.readyState === 1;
    let bookings = [];

    if (useDb) {
      bookings = await Booking.find({
        dateISO: { $gte: startOfTomorrow, $lte: endOfTomorrow },
        status: { $in: ['confirmed', 'rescheduled'] },
        reminderSent: { $ne: true }
      });
    } else {
      bookings = mockBookings.filter(b => {
        const bDate = new Date(b.dateISO);
        return bDate >= startOfTomorrow && bDate <= endOfTomorrow &&
               ['confirmed', 'rescheduled'].includes(b.status) &&
               !b.reminderSent;
      });
    }

    let sent = 0;
    let failed = 0;

    for (const booking of bookings) {
      try {
        const serviceNames = Array.isArray(booking.services)
          ? booking.services.map(s => s.name).join(', ')
          : booking.serviceNames || 'your service';

        const msg = `Hello ${booking.clientName}! 👋

This is a reminder from *S'posh APPEAL* 💅

` +
          `Your appointment is *tomorrow* (${booking.dateDisplay || tomorrowStr}) at *${booking.time || booking.startTime}*.

` +
          `📍 Service: ${serviceNames}
` +
          `🔖 Booking Ref: ${booking.reference_id}

` +
          `Please arrive 5–10 minutes early. If you need to reschedule, contact us at least 24hrs before.

` +
          `See you tomorrow! ✨ — S'posh APPEAL`;

        await sendWhatsAppMessage(booking.clientPhone, msg);

        // Mark reminder as sent
        if (useDb) {
          await Booking.updateOne({ _id: booking._id }, { reminderSent: true, reminderSentAt: new Date() });
        } else {
          booking.reminderSent = true;
          booking.reminderSentAt = new Date();
        }
        sent++;
      } catch (err) {
        console.error(`[Reminder] Failed for ${booking.reference_id}:`, err.message);
        failed++;
      }
    }

    res.json({ success: true, sent, failed, checked: bookings.length, date: tomorrowStr });
  } catch (err) {
    console.error('[Cron Reminder] Error:', err);
    res.status(500).json({ error: 'Cron job failed.' });
  }
});

// Revenue Summary (GET /api/admin/revenue)
// Returns deposit totals for admin dashboard
app.get('/api/admin/revenue', adminLimiter, async (req, res) => {
  try {
    const passcode = req.headers['x-admin-passcode'];
    if (!passcode || !(await verifyAdminPasscode(passcode))) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const useDb = mongoose.connection.readyState === 1;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let allBookings = [];
    if (useDb) {
      allBookings = await Booking.find({ status: { $nin: ['cancelled'] } });
    } else {
      allBookings = mockBookings.filter(b => b.status !== 'cancelled');
    }

    const thisMonth = allBookings.filter(b => new Date(b.createdAt || b.dateISO) >= startOfMonth);
    const today = allBookings.filter(b => new Date(b.createdAt || b.dateISO) >= startOfToday);
    const completed = allBookings.filter(b => b.status === 'completed');

    const sum = (arr, field) => arr.reduce((acc, b) => acc + (Number(b[field]) || 0), 0);

    res.json({
      today: {
        bookings: today.length,
        deposits: sum(today, 'depositDue'),
      },
      thisMonth: {
        bookings: thisMonth.length,
        deposits: sum(thisMonth, 'depositDue'),
        completed: thisMonth.filter(b => b.status === 'completed').length,
        totalRevenue: sum(thisMonth.filter(b => b.status === 'completed'), 'total'),
      },
      allTime: {
        bookings: allBookings.length,
        deposits: sum(allBookings, 'depositDue'),
        completed: completed.length,
        totalRevenue: sum(completed, 'total'),
      },
      pending: allBookings.filter(b => b.status === 'pending').length,
      confirmed: allBookings.filter(b => b.status === 'confirmed').length,
    });
  } catch (err) {
    console.error('[Revenue] Error:', err);
    res.status(500).json({ error: 'Failed to load revenue data.' });
  }
});



// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// 1. New Booking Submission (POST /api/bookings/new)
app.post('/api/bookings/new', bookingLimiter, async (req, res) => {
  try {
    const {
      clientName: _cn, clientEmail: _ce, clientPhone: _cp,
      services, expert, expertName,
      dateISO, dateDisplay, time, startTime,
      total, depositDue, serviceType, address: _addr, notes: _notes
    } = req.body;
    const clientName  = _xss(_cn);
    const clientEmail = _xss(_ce);
    const clientPhone = _xss(_cp);
    const address     = _xss(_addr);
    const notes       = _xss(_notes);

    // Validate request fields
    if (!clientName || !clientEmail || !clientPhone || !services || services.length === 0 || !dateISO || !time || !startTime) {
      return res.status(400).json({ error: 'Missing required booking fields.' });
    }

    // Generate collision-resistant reference ID using crypto randomness
    // Falls back to Math.random if crypto is unavailable (shouldn't happen in Node)
    const genRefId = () => {
      try {
        const bytes = require('crypto').randomBytes(3);
        const num = parseInt(bytes.toString('hex'), 16) % 900000 + 100000;
        return `SP-${num}`;
      } catch {
        return `SP-${Math.floor(100000 + Math.random() * 900000)}`;
      }
    };
    let reference_id = genRefId();
    // Ensure uniqueness in DB (retry up to 5 times — probability of collision is < 1-in-800k per attempt)
    if (mongoose.connection.readyState === 1) {
      let attempts = 0;
      while (attempts < 5 && await Booking.exists({ reference_id })) {
        reference_id = genRefId();
        attempts++;
      }
    }

    const useDb = mongoose.connection.readyState === 1;
    const bookingData = {
      reference_id,
      clientName: sanitizeInput(clientName),
      clientEmail: clientEmail.toLowerCase().trim(),
      clientPhone,
      services,
      expert,
      expertName,
      dateISO: new Date(new Date(dateISO).setHours(12, 0, 0, 0)),
      dateDisplay,
      time,
      startTime,
      total,
      depositDue,
      serviceType,
      address: sanitizeInput(address),
      notes: sanitizeInput(notes),
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (useDb) {
      const booking = new Booking(bookingData);
      await booking.save();

      // Immediately notify client that their booking is received and pending payment
      // (a second "confirmed" notification fires later via the Paystack webhook)
      dispatchBookingNotifications(booking, 'pending');

      // Call Paystack API to initialize payment checkout link
      const amountKobo = depositDue * 100;
      const origin = req.headers.origin || `${req.protocol}://${req.headers.host}`;
      const callbackUrl = `${origin}/booking.html`;
      try {
        const paystackRes = await initializePaystackTransaction(clientEmail, amountKobo, reference_id, callbackUrl);

        // Update booking with Paystack reference if it was generated by Paystack
        if (paystackRes.data && paystackRes.data.reference) {
          booking.paystackReference = paystackRes.data.reference;
          await booking.save();
        }

        res.status(201).json({
          status: 'success',
          reference_id: booking.reference_id,
          checkout_url: paystackRes.data.authorization_url,
          paystack_ref: paystackRes.data.reference
        });
      } catch (paystackErr) {
        console.warn('[Paystack] Session initialization failed:', paystackErr.message);
        res.status(201).json({
          status: 'success',
          reference_id: booking.reference_id,
          checkout_url: 'mock-checkout',
          paystack_ref: 'TEST-' + reference_id
        });
      }
    } else {
      bookingData.paystackReference = 'TEST-' + reference_id;
      mockBookings.push(bookingData);
      dispatchBookingNotifications(bookingData, 'pending');
      res.status(201).json({
        status: 'success',
        reference_id: bookingData.reference_id,
        checkout_url: 'mock-checkout',
        paystack_ref: 'TEST-' + reference_id
      });
    }
  } catch (err) {
    console.error('[New Booking] Server error:', err);
    res.status(500).json({ error: 'Server error processing booking.' });
  }
});

// 2. Fetch Bookings by Client Email or Reference ID (GET /api/bookings/my)
app.get('/api/bookings/my', bookingLimiter, async (req, res) => {
  try {
    const queryVal = (req.query.email || req.query.query || req.query.ref || '').trim();
    if (!queryVal) {
      return res.status(400).json({ error: 'Email or Reference ID is required.' });
    }

    const useDb = mongoose.connection.readyState === 1;
    if (useDb) {
      let bookings;
      if (queryVal.includes('@')) {
        bookings = await Booking.find({ clientEmail: queryVal.toLowerCase() })
          .sort({ createdAt: -1 })
          .lean();
      } else {
        bookings = await Booking.find({
          $or: [
            { reference_id: queryVal.toUpperCase() },
            { reference_id: queryVal }
          ]
        })
          .sort({ createdAt: -1 })
          .lean();
      }
      res.json({ bookings });
    } else {
      let bookings;
      if (queryVal.includes('@')) {
        bookings = mockBookings.filter(b => b.clientEmail.toLowerCase() === queryVal.toLowerCase());
      } else {
        bookings = mockBookings.filter(b => b.reference_id.toUpperCase() === queryVal.toUpperCase() || b.reference_id === queryVal);
      }
      bookings.sort((a, b) => b.createdAt - a.createdAt);
      res.json({ bookings });
    }
  } catch (err) {
    console.error('[Get Bookings] Server error:', err);
    res.status(500).json({ error: 'Server error fetching bookings.' });
  }
});

// 3. Cancel Active Slot (PATCH /api/bookings/cancel/:id)
app.patch('/api/bookings/cancel/:id', bookingLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const bookingId = req.params.id;

    if (!email) {
      return res.status(400).json({ error: 'Client email is required to cancel.' });
    }

    const useDb = mongoose.connection.readyState === 1;
    let booking = null;
    if (useDb) {
      booking = await Booking.findOne({ reference_id: bookingId });
    } else {
      booking = mockBookings.find(b => b.reference_id === bookingId);
    }

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Check staff permissions if passcode is provided
    const passcode = req.headers['x-admin-passcode'];

    let isAuthorizedStaff = false;
    let canCancel = false;

    if (passcode) {
      if (await verifyAdminPasscode(passcode)) {
        isAuthorizedStaff = true;
        canCancel = true;
      } else {
        const staff = await getStaffMemberByPasscode(passcode);
        if (staff) {
          isAuthorizedStaff = true;
          canCancel = staff.permissions?.canCancelBookings;
        }
      }

      if (isAuthorizedStaff && !canCancel) {
        return res.status(403).json({ error: 'Forbidden. You do not have permission to cancel bookings.' });
      }
    }

    if (!isAuthorizedStaff) {
      // Ensure matching email request ownership
      if (booking.clientEmail.toLowerCase() !== email.toLowerCase()) {
        return res.status(403).json({ error: 'Unauthorized to cancel this booking.' });
      }

      // Check cancellation policy (24-hour limit) for clients
      const appointmentDate = new Date(booking.dateISO);
      const [time, period] = booking.startTime.split(' ');
      let [h, m] = time.split(':').map(Number);
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      appointmentDate.setHours(h, m, 0, 0);

      const now = new Date();
      const hoursDiff = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursDiff < 24) {
        return res.status(400).json({ error: 'Appointments cannot be cancelled within 24 hours of the scheduled time.' });
      }
    }

    // Update status
    if (useDb) {
      booking.status = 'cancelled';
      await booking.save();
    } else {
      booking.status = 'cancelled';
      booking.updatedAt = new Date();
    }

    dispatchBookingNotifications(booking, 'cancelled');
    res.json({ status: 'success', message: 'Booking cancelled successfully.', booking });
  } catch (err) {
    console.error('[Cancel Booking] Server error:', err);
    res.status(500).json({ error: 'Server error cancelling booking.' });
  }
});

// 4. Reschedule Slot Date/Time (PATCH /api/bookings/reschedule/:id)
app.patch('/api/bookings/reschedule/:id', bookingLimiter, async (req, res) => {
  try {
    const { email, appointment_date, appointment_time } = req.body;
    const bookingId = req.params.id;

    if (!email || !appointment_date || !appointment_time) {
      return res.status(400).json({ error: 'Email, date, and start time are required.' });
    }

    // Calculate display date format (e.g. Sat, 20 June 2026)
    const dateObj = new Date(appointment_date);
    dateObj.setHours(12, 0, 0, 0);

    // Ensure the new date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(appointment_date);
    selectedDate.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      return res.status(400).json({ error: 'Cannot reschedule to a past date.' });
    }

    const dateDisplay = dateObj.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const useDb = mongoose.connection.readyState === 1;
    let targetBooking = null;

    if (useDb) {
      targetBooking = await Booking.findOne({ reference_id: bookingId });
    } else {
      targetBooking = mockBookings.find(b => b.reference_id === bookingId);
    }

    if (!targetBooking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Check staff permissions if passcode is provided
    const passcode = req.headers['x-admin-passcode'];

    let isAuthorizedStaff = false;
    let canReschedule = false;

    if (passcode) {
      if (await verifyAdminPasscode(passcode)) {
        isAuthorizedStaff = true;
        canReschedule = true;
      } else {
        const staff = await getStaffMemberByPasscode(passcode);
        if (staff) {
          isAuthorizedStaff = true;
          canReschedule = staff.permissions?.canRescheduleBookings;
        }
      }

      if (isAuthorizedStaff && !canReschedule) {
        return res.status(403).json({ error: 'Forbidden. You do not have permission to reschedule bookings.' });
      }
    }

    if (!isAuthorizedStaff) {
      // Ensure matching email request ownership
      if (targetBooking.clientEmail.toLowerCase() !== email.toLowerCase()) {
        return res.status(403).json({ error: 'Unauthorized to reschedule this booking.' });
      }

      // Check cancellation/reschedule policy (24-hour limit) for clients
      const appointmentDate = new Date(targetBooking.dateISO);
      const [time, period] = targetBooking.startTime.split(' ');
      let [h, m] = time.split(':').map(Number);
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      appointmentDate.setHours(h, m, 0, 0);

      const now = new Date();
      const hoursDiff = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursDiff < 24) {
        return res.status(400).json({ error: 'Appointments cannot be rescheduled within 24 hours of the scheduled time.' });
      }
    }

    // Duration is preserved. Format new time range label:
    let durationMinutes = 60;
    const parenMatch = targetBooking.time.match(/\(([^)]+)\)/);
    const dotMatch = targetBooking.time.match(/·\s*(\d+)\s*min/);
    if (parenMatch) {
      const durStr = parenMatch[1];
      if (durStr.includes('hr')) {
        const hrs = parseFloat(durStr.replace('hr', '').trim());
        if (!isNaN(hrs)) durationMinutes = Math.round(hrs * 60);
      } else if (durStr.includes('min')) {
        const mins = parseInt(durStr.replace('min', '').trim(), 10);
        if (!isNaN(mins)) durationMinutes = mins;
      }
    } else if (dotMatch) {
      const mins = parseInt(dotMatch[1], 10);
      if (!isNaN(mins)) durationMinutes = mins;
    }

    const [startH, startM] = appointment_time.split(':').map(Number);
    const startDate = new Date(2000, 0, 1, startH, startM, 0, 0);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    const endH = String(endDate.getHours()).padStart(2, '0');
    const endM = String(endDate.getMinutes()).padStart(2, '0');
    const durationLabel = durationMinutes % 60 === 0 ? `${durationMinutes / 60} hr` : `${durationMinutes} min`;

    const formattedTime = `${appointment_time} - ${endH}:${endM} (${durationLabel})`;

    if (useDb) {
      targetBooking.dateISO = dateObj;
      targetBooking.dateDisplay = dateDisplay;
      targetBooking.startTime = appointment_time;
      targetBooking.time = formattedTime;
      targetBooking.status = 'rescheduled';
      await targetBooking.save();
    } else {
      targetBooking.dateISO = dateObj;
      targetBooking.dateDisplay = dateDisplay;
      targetBooking.startTime = appointment_time;
      targetBooking.time = formattedTime;
      targetBooking.status = 'rescheduled';
      targetBooking.updatedAt = new Date();
    }

    dispatchBookingNotifications(targetBooking, 'rescheduled');
    res.json({ status: 'success', message: 'Booking rescheduled successfully.', booking: targetBooking });
  } catch (err) {
    console.error('[Reschedule Booking] Server error:', err);
    res.status(500).json({ error: 'Server error rescheduling booking.' });
  }
});


// 5. Confirm Service Complete & Collect Balance (PATCH /api/bookings/:id/complete)
app.patch('/api/bookings/:id/complete', adminLimiter, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { paymentMethod, completionNotes } = req.body;

    const passcode = req.headers['x-admin-passcode'];
    if (!passcode) return res.status(401).json({ error: 'Passcode required.' });

    let canComplete = false;
    // Smart admin check: supports both plaintext and bcrypt-hashed ADMIN_PASSWORD
    const isAdmin = await verifyAdminPasscode(passcode);
    if (isAdmin) {
      canComplete = true;
    } else {
      const staff = await getStaffMemberByPasscode(passcode);
      if (staff) canComplete = staff.permissions?.canConfirmComplete !== false;
    }
    if (!canComplete) return res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });

    const useDb = mongoose.connection.readyState === 1;
    let booking = null;
    if (useDb) {
      booking = await Booking.findOne({ reference_id: bookingId });
    } else {
      booking = mockBookings.find(b => b.reference_id === bookingId);
    }

    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.status === 'completed') return res.status(400).json({ error: 'Booking already marked complete.' });
    if (booking.status === 'cancelled') return res.status(400).json({ error: 'Cannot complete a cancelled booking.' });

    if (useDb) {
      booking.status = 'completed';
      booking.paymentStatus = 'fully_paid';
      booking.completedAt = new Date();
      booking.completionNotes = _xss(completionNotes) || '';
      booking.balancePaymentMethod = paymentMethod || 'cash';
      await booking.save();
    } else {
      Object.assign(booking, {
        status: 'completed', paymentStatus: 'fully_paid',
        completedAt: new Date(), completionNotes: _xss(completionNotes) || '',
        balancePaymentMethod: paymentMethod || 'cash', updatedAt: new Date()
      });
    }

    res.json({ status: 'success', message: 'Booking marked as complete.', booking });
  } catch (err) {
    console.error('[Complete Booking] Server error:', err);
    res.status(500).json({ error: 'Server error marking booking complete.' });
  }
});

// 6. Paystack Webhook Handler (POST /api/payments/webhook)
app.post('/api/payments/webhook', paymentLimiter, async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    // Paystack uses the Secret Key (not a separate webhook secret) to sign webhooks
    const webhookSecret = process.env.PAYSTACK_SECRET_KEY;

    if (!webhookSecret) {
      console.error('[Paystack Webhook] PAYSTACK_SECRET_KEY is not configured. Rejecting webhook.');
      return res.status(503).send('Webhook not configured');
    }
    if (!signature) {
      return res.status(401).send('Missing signature');
    }

    const hash = crypto.createHmac('sha512', webhookSecret)
      .update(req.rawBody)
      .digest('hex');

    if (hash !== signature) {
      return res.status(401).send('Invalid signature');
    }

    const event = req.body;

    // Listen for charge.success event
    if (event.event === 'charge.success') {
      const reference = event.data.reference;

      const useDb = mongoose.connection.readyState === 1;
      if (useDb) {
        const booking = await Booking.findOne({
          $or: [
            { reference_id: reference },
            { paystackReference: reference }
          ]
        });

        if (booking) {
          booking.paymentStatus = 'paid';
          booking.status = 'confirmed';
          await booking.save();
          console.log(`[Paystack Webhook] Booking ${booking.reference_id} confirmed via payment.`);
          dispatchBookingNotifications(booking, 'confirmed');
        }
      } else {
        const booking = mockBookings.find(b => b.reference_id === reference || b.paystackReference === reference);
        if (booking) {
          booking.paymentStatus = 'paid';
          booking.status = 'confirmed';
          booking.updatedAt = new Date();
          console.log(`[Paystack Webhook Mock] Booking ${booking.reference_id} confirmed.`);
          dispatchBookingNotifications(booking, 'confirmed');
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[Paystack Webhook] Error:', err);
    res.sendStatus(500);
  }
});

// Suffix match phone numbers to bypass formatting/country code discrepancies
function cleanPhoneSuffix(phoneStr) {
  if (!phoneStr) return '';
  const digits = phoneStr.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function normalizeToE164(phone) {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) {
    digits = '234' + digits.substring(1);
  }
  if (!digits.startsWith('234') && digits.length === 10) {
    digits = '234' + digits;
  }
  return digits.startsWith('+') ? digits : '+' + digits;
}

async function findRecentBooking(phoneNum, mustBeActive = false) {
  const targetSuffix = cleanPhoneSuffix(phoneNum);
  if (!targetSuffix) return null;

  const useDb = mongoose.connection.readyState === 1;
  let bookings = [];
  if (useDb) {
    const query = mustBeActive ? { status: { $ne: 'cancelled' } } : {};
    bookings = await Booking.find(query).sort({ createdAt: -1 }).lean();
  } else {
    bookings = [...mockBookings].sort((a, b) => b.createdAt - a.createdAt);
    if (mustBeActive) {
      bookings = bookings.filter(b => b.status !== 'cancelled');
    }
  }
  return bookings.find(b => cleanPhoneSuffix(b.clientPhone) === targetSuffix) || null;
}

// 5a. Busy Slots Sync Endpoint (GET /api/bookings/busy)
app.get('/api/bookings/busy', async (req, res) => {
  try {
    const useDb = mongoose.connection.readyState === 1;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let bookings = [];
    if (useDb) {
      bookings = await Booking.find({
        status: { $in: ['confirmed', 'rescheduled', 'completed'] },
        dateISO: { $gte: startOfToday }
      }).lean();
    } else {
      bookings = mockBookings.filter(b => {
        const bDate = new Date(b.dateISO);
        return ['confirmed', 'rescheduled', 'completed'].includes(b.status) && bDate >= startOfToday;
      });
    }

    const busySlots = bookings.map(b => {
      let durationMinutes = 0;
      if (b.services && b.services.length) {
        durationMinutes = b.services.reduce((sum, s) => sum + (s.durationMinutes || 60), 0);
      } else {
        const parenMatch = b.time.match(/\(([^)]+)\)/);
        if (parenMatch) {
          const durStr = parenMatch[1];
          if (durStr.includes('hr')) {
            const hrs = parseFloat(durStr.replace('hr', '').trim());
            if (!isNaN(hrs)) durationMinutes = Math.round(hrs * 60);
          } else if (durStr.includes('min')) {
            const mins = parseInt(durStr.replace('min', '').trim(), 10);
            if (!isNaN(mins)) durationMinutes = mins;
          }
        }
      }
      if (durationMinutes === 0) durationMinutes = 60;

      return {
        reference_id: b.reference_id,
        date: b.dateISO,
        startTime: b.startTime,
        durationMinutes
      };
    });

    res.json({ busySlots });
  } catch (err) {
    console.error('[Busy Slots] Error:', err);
    res.status(500).json({ error: 'Server error retrieving busy slots.' });
  }
});

// Temporary in-memory store for pending WhatsApp cancel confirmations
// { phoneNum: { reference_id, expiresAt } }
const pendingWaCancels = new Map();
const WA_CANCEL_TTL_MS = 5 * 60 * 1000; // 5 minutes

// 5b. WhatsApp Webhook endpoint (POST /api/webhook/whatsapp)
app.post('/api/webhook/whatsapp', async (req, res) => {
  try {
    const fromNum = req.body.From || '';
    const msgBody = req.body.Body ? req.body.Body.trim().toUpperCase() : '';

    console.log(`[WhatsApp Webhook] Received message from ${fromNum}: "${msgBody}"`);

    let replyMessage = '';

    if (msgBody === 'STATUS') {
      const booking = await findRecentBooking(fromNum, false);
      if (!booking) {
        replyMessage = "We couldn't find any booking associated with your phone number. To book a slot, visit our scheduling portal: https://sposhappeal.vercel.app/booking.html";
      } else {
        const serviceNames = Array.isArray(booking.services) ? booking.services.map(s => s.name).join(', ') : booking.serviceNames || '';
        replyMessage = `Your most recent booking details:

Ref: ${booking.reference_id}
Services: ${serviceNames}
Date: ${booking.dateDisplay}
Time: ${booking.time}
Status: ${booking.status.toUpperCase()}
Payment: ${booking.paymentStatus.toUpperCase()}

To cancel this booking, reply with CANCEL.`;
      }

    } else if (msgBody === 'CANCEL') {
      // Step 1: Ask for confirmation — do NOT cancel yet
      const booking = await findRecentBooking(fromNum, true);
      if (!booking) {
        replyMessage = "You have no active bookings to cancel.";
      } else {
        const serviceNames = Array.isArray(booking.services) ? booking.services.map(s => s.name).join(', ') : booking.serviceNames || '';
        // Store pending cancel with 5-minute TTL
        pendingWaCancels.set(fromNum, {
          reference_id: booking.reference_id,
          expiresAt: Date.now() + WA_CANCEL_TTL_MS
        });
        replyMessage = `⚠️ Are you sure you want to cancel your booking?\n\nRef: ${booking.reference_id}\nServices: ${serviceNames}\nDate: ${booking.dateDisplay}\nTime: ${booking.time}\n\nReply YES to confirm cancellation, or ignore this message to keep your appointment.\n\n(This request expires in 5 minutes.)`;
      }

    } else if (msgBody === 'YES') {
      // Step 2: Execute the cancel if there's a pending request
      const pending = pendingWaCancels.get(fromNum);
      if (!pending || Date.now() > pending.expiresAt) {
        pendingWaCancels.delete(fromNum);
        replyMessage = "There is no active cancellation request to confirm. Reply CANCEL to start a new one.";
      } else {
        pendingWaCancels.delete(fromNum);
        const useDb = mongoose.connection.readyState === 1;
        let booking = null;
        if (useDb) {
          booking = await Booking.findOne({ reference_id: pending.reference_id });
          if (booking) {
            booking.status = 'cancelled';
            await booking.save();
          }
        } else {
          booking = mockBookings.find(b => b.reference_id === pending.reference_id);
          if (booking) {
            booking.status = 'cancelled';
            booking.updatedAt = new Date();
          }
        }

        if (booking) {
          const updatedBooking = { ...booking, status: 'cancelled' };
          dispatchBookingNotifications(updatedBooking, 'cancelled');
          replyMessage = `✅ Your booking ${pending.reference_id} has been cancelled successfully. A confirmation email and notification have been sent.\n\nWe hope to see you again soon! 🌸`;
        } else {
          replyMessage = "Could not find that booking. It may have already been cancelled.";
        }
      }

    } else {
      // Clear any stale pending cancel if user sends something else
      pendingWaCancels.delete(fromNum);
      replyMessage = `Welcome to the S'posh APPEAL WhatsApp Assistant! 🌸

Reply with:
• STATUS - To check the details of your most recent booking.
• CANCEL - To request cancellation of your active booking.

To schedule a new appointment, visit our site: https://sposhappeal.vercel.app/booking.html`;
    }

    res.header('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(replyMessage)}</Message>
</Response>`);
  } catch (err) {
    console.error('[WhatsApp Webhook] Error:', err);
    res.header('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>An error occurred processing your request. Please try again later.</Message>
</Response>`);
  }
});

// 6. Get Catalog (GET /api/services)
app.get('/api/services', async (req, res) => {
  try {
    const useDb = mongoose.connection.readyState === 1;
    let categoriesList = [];
    let optionsList = [];

    if (useDb) {
      categoriesList = await ServiceCategory.find({}).sort({ displayOrder: 1 }).lean();
      optionsList = await ServiceOption.find({}).lean();
    } else {
      categoriesList = [...mockCategories].sort((a, b) => a.displayOrder - b.displayOrder);
      optionsList = [...mockOptions];
    }

    const servicesList = categoriesList.map(cat => {
      const catOptions = optionsList.filter(opt => opt.categoryId === cat.id);
      const minPrice = catOptions.length ? Math.min(...catOptions.map(o => o.price)) : cat.priceFrom || 0;

      return {
        id: `s-${cat.id}`,
        category: cat.id,
        name: cat.name,
        price: minPrice,
        duration: catOptions.length ? `${catOptions[0].durationMinutes} min` : '',
        description: cat.description,
        icon: cat.icon
      };
    });

    const groupsList = categoriesList.map(cat => {
      const catOptions = optionsList.filter(opt => opt.categoryId === cat.id).map(opt => ({
        id: opt.id,
        name: opt.name,
        price: opt.price,
        durationMinutes: opt.durationMinutes
      }));

      return {
        id: cat.id,
        name: cat.name,
        options: catOptions
      };
    });

    res.json({ services: servicesList, groups: groupsList });
  } catch (err) {
    console.error('[Get Services] Error:', err);
    res.status(500).json({ error: 'Server error retrieving catalog.' });
  }
});

// 7. Get All Bookings for Staff/Admin (GET /api/staff/bookings)
app.get('/api/staff/bookings', adminLimiter, async (req, res) => {
  try {
    const passcode = req.headers['x-admin-passcode'];
    const expectedStaffPasscode = STAFF_PASSCODE;

    if (!ADMIN_PASSCODE || !expectedStaffPasscode) {
      return res.status(503).json({ error: 'Admin access is not configured on this server yet.' });
    }
    if (!passcode) {
      return res.status(401).json({ error: 'Unauthorized. Passcode required.' });
    }

    // Enforce strict role-passcode match
    const selectedRole = req.headers['x-selected-role'] || '';
    let isAdmin = false;

    const matchesAdmin = await verifyAdminPasscode(passcode);

    if (selectedRole === 'admin') {
      // Admin dropdown - only admin passcode accepted
      if (!matchesAdmin) {
        return res.status(401).json({ error: 'Incorrect passcode. Access Denied.' });
      }
      isAdmin = true;
    } else {
      // Staff dropdown - admin passcode explicitly rejected
      if (matchesAdmin) {
        return res.status(401).json({ error: 'Incorrect passcode. Access Denied.' });
      }
      if (passcode !== expectedStaffPasscode) {
        // Also check individual staff passcodes in DB
        const staffByPass = await getStaffMemberByPasscode(passcode);
        if (!staffByPass) {
          return res.status(401).json({ error: 'Incorrect passcode. Access Denied.' });
        }
      }
      isAdmin = false;
    }

    const role = isAdmin ? 'admin' : 'staff';

    // Resolve permissions and identity from the authenticated staff member
    let permissions = {};
    let staffId = null;
    let staffName = null;

    if (isAdmin) {
      permissions = {
        canViewBookings: true,
        canCancelBookings: true,
        canRescheduleBookings: true,
        canEditCatalog: true
      };
      staffId = 'admin';
      staffName = 'Admin';
    } else {
      const staffMember = await getStaffMemberByPasscode(passcode);
      if (staffMember) {
        permissions = staffMember.permissions || {};
        staffId = staffMember.id || null;
        staffName = staffMember.name || null;
      }
    }

    const useDb = mongoose.connection.readyState === 1;
    let bookings = [];
    if (useDb) {
      bookings = await Booking.find({}).sort({ createdAt: -1 }).lean();
    } else {
      bookings = [...mockBookings].sort((a, b) => b.createdAt - a.createdAt);
    }

    res.json({ bookings, role, permissions, staffId, staffName });
  } catch (err) {
    console.error('[Staff Get Bookings] Error:', err);
    res.status(500).json({ error: 'Server error retrieving bookings.' });
  }
});

// Alias for compatibility
app.get('/api/admin/bookings', (req, res) => {
  res.redirect(307, '/api/staff/bookings');
});

// 8. Update Service Option (PUT /api/admin/services/:id)
app.put('/api/admin/services/:id', adminLimiter, async (req, res) => {
  try {
    const passcode = req.headers['x-admin-passcode'];

    if (!ADMIN_PASSCODE) {
      return res.status(503).json({ error: 'Admin access is not configured on this server yet.' });
    }
    if (!passcode || !(await verifyAdminPasscode(passcode))) {
      return res.status(401).json({ error: 'Unauthorized. Invalid passcode.' });
    }

    const serviceId = req.params.id;
    const { name, price, durationMinutes } = req.body;

    if (price === undefined || isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Invalid price value.' });
    }

    const useDb = mongoose.connection.readyState === 1;
    if (useDb) {
      const option = await ServiceOption.findOne({ id: serviceId });
      if (!option) {
        return res.status(404).json({ error: 'Service not found.' });
      }

      if (name) option.name = _xss(name);
      option.price = Number(price);
      if (durationMinutes !== undefined && !isNaN(durationMinutes)) option.durationMinutes = Number(durationMinutes);
      await option.save();

      console.log(`[Admin Service Edit] Service ${serviceId} updated successfully.`);
      res.json({ status: 'success', message: 'Service updated successfully.', service: option });
    } else {
      const option = mockOptions.find(o => o.id === serviceId);
      if (!option) {
        return res.status(404).json({ error: 'Service not found.' });
      }
      if (name) option.name = _xss(name);
      option.price = Number(price);
      if (durationMinutes !== undefined && !isNaN(durationMinutes)) option.durationMinutes = Number(durationMinutes);
      res.json({ status: 'success', message: 'Service updated successfully.', service: option });
    }
  } catch (err) {
    console.error('[Admin Update Service] Error:', err);
    res.status(500).json({ error: 'Server error updating service.' });
  }
});

// 9. Add New Service Option (POST /api/admin/services)
app.post('/api/admin/services', adminLimiter, async (req, res) => {
  try {
    const passcode = req.headers['x-admin-passcode'];

    if (!ADMIN_PASSCODE) {
      return res.status(503).json({ error: 'Admin access is not configured on this server yet.' });
    }
    if (!passcode || !(await verifyAdminPasscode(passcode))) {
      return res.status(401).json({ error: 'Unauthorized. Invalid passcode.' });
    }

    const { categoryId, name, price, durationMinutes } = req.body;

    if (!categoryId || !name || price === undefined || isNaN(price) || price < 0 || !durationMinutes || isNaN(durationMinutes)) {
      return res.status(400).json({ error: 'Missing or invalid service option fields.' });
    }

    const useDb = mongoose.connection.readyState === 1;
    if (useDb) {
      // Check if category exists
      const category = await ServiceCategory.findOne({ id: categoryId });
      if (!category) {
        return res.status(404).json({ error: 'Category not found.' });
      }

      // Generate unique slug-like ID: e.g. "nails-glitter-1234"
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const rand = Math.floor(1000 + Math.random() * 9000);
      const serviceId = `${categoryId}-${slug}-${rand}`;

      const newOption = new ServiceOption({
        id: serviceId,
        name: _xss(name),
        price: Number(price),
        durationMinutes: Number(durationMinutes),
        categoryId
      });

      await newOption.save();

      console.log(`[Admin Service Create] Service ${serviceId} created under category ${categoryId}.`);
      res.status(201).json({ status: 'success', message: 'Service created successfully.', service: newOption });
    } else {
      const category = mockCategories.find(c => c.id === categoryId);
      if (!category) {
        return res.status(404).json({ error: 'Category not found.' });
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const rand = Math.floor(1000 + Math.random() * 9000);
      const serviceId = `${categoryId}-${slug}-${rand}`;

      const newOption = {
        id: serviceId,
        name,
        price: Number(price),
        durationMinutes: Number(durationMinutes),
        categoryId
      };
      mockOptions.push(newOption);
      res.status(201).json({ status: 'success', message: 'Service created successfully.', service: newOption });
    }
  } catch (err) {
    console.error('[Admin Create Service] Error:', err);
    res.status(500).json({ error: 'Server error creating service.' });
  }
});

// 10. Delete Service Option (DELETE /api/admin/services/:id)
app.delete('/api/admin/services/:id', adminLimiter, async (req, res) => {
  try {
    const passcode = req.headers['x-admin-passcode'];

    if (!ADMIN_PASSCODE) {
      return res.status(503).json({ error: 'Admin access is not configured on this server yet.' });
    }
    if (!passcode || !(await verifyAdminPasscode(passcode))) {
      return res.status(401).json({ error: 'Unauthorized. Invalid passcode.' });
    }

    const serviceId = req.params.id;

    const useDb = mongoose.connection.readyState === 1;
    if (useDb) {
      const result = await ServiceOption.deleteOne({ id: serviceId });
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Service not found.' });
      }

      console.log(`[Admin Service Delete] Service ${serviceId} deleted.`);
      res.json({ status: 'success', message: 'Service deleted successfully.' });
    } else {
      const idx = mockOptions.findIndex(o => o.id === serviceId);
      if (idx === -1) {
        return res.status(404).json({ error: 'Service not found.' });
      }
      mockOptions.splice(idx, 1);
      res.json({ status: 'success', message: 'Service deleted successfully.' });
    }
  } catch (err) {
    console.error('[Admin Delete Service] Error:', err);
    res.status(500).json({ error: 'Server error deleting service.' });
  }
});

// 11. GET /api/services/experts
app.get('/api/services/experts', async (req, res) => {
  try {
    const useDb = mongoose.connection.readyState === 1;
    let staffList = [];
    if (useDb) {
      staffList = await Staff.find({}).lean();
    } else {
      staffList = mockStaff;
    }
    // Filter out passcode and permissions
    const publicList = staffList.map(s => ({
      id: s.id,
      name: s.name,
      role: s.role,
      bio: s.bio,
      ig: s.ig,
      img: s.img
    }));
    res.json({ experts: publicList });
  } catch (err) {
    console.error('[Get Experts] Error:', err);
    res.status(500).json({ error: 'Server error retrieving experts.' });
  }
});

async function verifyAdminPasscode(passcode) {
  if (!passcode || !ADMIN_PASSCODE) return false;
  try {
    if (ADMIN_PASSCODE.startsWith('$2')) {
      return await bcrypt.compare(passcode, ADMIN_PASSCODE);
    }
    return passcode === ADMIN_PASSCODE;
  } catch (err) {
    console.error('[verifyAdminPasscode] Error:', err);
    return false;
  }
}

// Admin-only middleware/check helper (supports both plaintext and bcrypt-hashed ADMIN_PASSWORD)
async function verifyAdmin(req, res, next) {
  const passcode = req.headers['x-admin-passcode'];
  if (!passcode || !ADMIN_PASSCODE) {
    return res.status(401).json({ error: 'Unauthorized. Admin passcode required.' });
  }
  try {
    const isValid = await verifyAdminPasscode(passcode);
    if (!isValid) {
      return res.status(401).json({ error: 'Unauthorized. Invalid admin passcode.' });
    }
    next();
  } catch (err) {
    console.error('[verifyAdmin] Error:', err);
    return res.status(500).json({ error: 'Server error verifying passcode.' });
  }
}

// 12. GET /api/admin/staff
app.get('/api/admin/staff', verifyAdmin, async (req, res) => {
  try {
    const useDb = mongoose.connection.readyState === 1;
    if (useDb) {
      const staffList = await Staff.find({}).sort({ createdAt: 1 }).lean();
      // Strip passcodeHash — never send credentials to the client
      const safeList = staffList.map(({ passcodeHash, ...rest }) => rest);
      res.json({ staff: safeList });
    } else {
      // Mock: strip passcode field too
      const safeList = mockStaff.map(({ passcode, ...rest }) => rest);
      res.json({ staff: safeList });
    }
  } catch (err) {
    console.error('[Admin Get Staff] Error:', err);
    res.status(500).json({ error: 'Server error fetching staff list.' });
  }
});

// 13. POST /api/admin/staff
app.post('/api/admin/staff', adminLimiter, verifyAdmin, async (req, res) => {
  try {
    const { name: _name, role: _role, bio: _bio, ig: _ig, fb: _fb, tiktok: _tiktok, img: _img, passcode, permissions } = req.body;
    const name   = _xss(_name);
    const role   = _xss(_role);
    const bio    = _xss(_bio);
    const ig     = _xss(_ig);
    const fb     = _xss(_fb);
    const tiktok = _xss(_tiktok);
    const img    = _xss(_img);
    if (!name || !passcode) {
      return res.status(400).json({ error: 'Name and passcode are required.' });
    }

    // Generate unique slug-like ID: e.g. "ngozi-1234"
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const staffId = `${slug}-${rand}`;

    const newStaffData = {
      id: staffId,
      name,
      role: role || 'Stylist',
      bio: bio || '',
      ig: ig || '#',
      fb: fb || '',
      tiktok: tiktok || '',
      img: img || 'assets/stylist_kunle.jpg',
      passcodeHash: passcode,   // pre-save hook in Staff model will bcrypt this
      permissions: {
        canViewBookings: permissions?.canViewBookings ?? true,
        canCancelBookings: permissions?.canCancelBookings ?? false,
        canRescheduleBookings: permissions?.canRescheduleBookings ?? false,
        canEditCatalog: permissions?.canEditCatalog ?? false,
        canConfirmComplete: permissions?.canConfirmComplete ?? true
      }
    };

    const useDb = mongoose.connection.readyState === 1;
    if (useDb) {
      const newStaff = new Staff(newStaffData);
      await newStaff.save();
      const { passcodeHash: _, ...safeStaff } = newStaff.toObject();
      res.status(201).json({ status: 'success', message: 'Staff member added successfully.', staff: safeStaff });
    } else {
      // Mock store keeps plain passcode for in-memory comparison
      const mockEntry = { ...newStaffData, passcode, id: staffId };
      delete mockEntry.passcodeHash;
      mockStaff.push(mockEntry);
      res.status(201).json({ status: 'success', message: 'Staff member added successfully.', staff: mockEntry });
    }
  } catch (err) {
    console.error('[Admin Create Staff] Error:', err);
    res.status(500).json({ error: 'Server error adding staff member.' });
  }
});

// 14. PUT /api/admin/staff/:id
app.put('/api/admin/staff/:id', adminLimiter, verifyAdmin, async (req, res) => {
  try {
    const staffId = req.params.id;
    const { name: _name, role: _role, bio: _bio, ig: _ig, fb: _fb, tiktok: _tiktok, img: _img, passcode, permissions } = req.body;
    const _fb_clean     = _fb     !== undefined ? _xss(_fb)     : undefined;
    const _tiktok_clean = _tiktok !== undefined ? _xss(_tiktok) : undefined;

    const useDb = mongoose.connection.readyState === 1;
    if (useDb) {
      const staff = await Staff.findOne({ id: staffId });
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found.' });
      }

      if (_name !== undefined) staff.name = _xss(_name);
      if (_role !== undefined) staff.role = _xss(_role);
      if (_bio !== undefined) staff.bio = _xss(_bio);
      if (_ig !== undefined) staff.ig = _xss(_ig);
      if (_fb_clean !== undefined) staff.fb = _fb_clean;
      if (_tiktok_clean !== undefined) staff.tiktok = _tiktok_clean;
      if (_img !== undefined) staff.img = _xss(_img);
      if (passcode !== undefined) staff.passcodeHash = passcode; // pre-save hook will re-hash
      if (permissions !== undefined) {
        staff.permissions = {
          canViewBookings: permissions.canViewBookings ?? staff.permissions.canViewBookings,
          canCancelBookings: permissions.canCancelBookings ?? staff.permissions.canCancelBookings,
          canRescheduleBookings: permissions.canRescheduleBookings ?? staff.permissions.canRescheduleBookings,
          canEditCatalog: permissions.canEditCatalog ?? staff.permissions.canEditCatalog,
          canConfirmComplete: permissions.canConfirmComplete ?? staff.permissions.canConfirmComplete
        };
      }

      await staff.save();
      const { passcodeHash: _, ...safeStaff } = staff.toObject();
      res.json({ status: 'success', message: 'Staff member updated successfully.', staff: safeStaff });
    } else {
      const staff = mockStaff.find(s => s.id === staffId);
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found.' });
      }

      if (_name !== undefined) staff.name = _xss(_name);
      if (_role !== undefined) staff.role = _xss(_role);
      if (_bio !== undefined) staff.bio = _xss(_bio);
      if (_ig !== undefined) staff.ig = _xss(_ig);
      if (fb !== undefined) staff.fb = fb;
      if (tiktok !== undefined) staff.tiktok = tiktok;
      if (_img !== undefined) staff.img = _xss(_img);
      if (passcode !== undefined) staff.passcode = passcode;
      if (permissions !== undefined) {
        staff.permissions = {
          canViewBookings: permissions.canViewBookings ?? staff.permissions.canViewBookings,
          canCancelBookings: permissions.canCancelBookings ?? staff.permissions.canCancelBookings,
          canRescheduleBookings: permissions.canRescheduleBookings ?? staff.permissions.canRescheduleBookings,
          canEditCatalog: permissions.canEditCatalog ?? staff.permissions.canEditCatalog,
          canConfirmComplete: permissions.canConfirmComplete ?? staff.permissions.canConfirmComplete
        };
      }

      const { passcode: _p, ...safeMock } = staff;
      res.json({ status: 'success', message: 'Staff member updated successfully.', staff: safeMock });
    }
  } catch (err) {
    console.error('[Admin Update Staff] Error:', err);
    res.status(500).json({ error: 'Server error updating staff member.' });
  }
});

// 15. DELETE /api/admin/staff/:id
app.delete('/api/admin/staff/:id', adminLimiter, verifyAdmin, async (req, res) => {
  try {
    const staffId = req.params.id;

    const useDb = mongoose.connection.readyState === 1;
    if (useDb) {
      const result = await Staff.deleteOne({ id: staffId });
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Staff member not found.' });
      }
      res.json({ status: 'success', message: 'Staff member deleted successfully.' });
    } else {
      const idx = mockStaff.findIndex(s => s.id === staffId);
      if (idx === -1) {
        return res.status(404).json({ error: 'Staff member not found.' });
      }
      mockStaff.splice(idx, 1);
      res.json({ status: 'success', message: 'Staff member deleted successfully.' });
    }
  } catch (err) {
    console.error('[Admin Delete Staff] Error:', err);
    res.status(500).json({ error: 'Server error deleting staff member.' });
  }
});

// Export application for Vercel Serverless Function context
module.exports = app;

// Listen only when script is run directly
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}
