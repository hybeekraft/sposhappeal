/* =================================================================
   booking.html page bootstrap  —  booking.js
   ─────────────────────────────────────────────────────────────────
   This file is the dedicated entry point for booking.html. It does
   NOT duplicate any logic from app.js — instead it wires up the
   booking wizard for the standalone booking page (vs the modal flow
   on index.html). Responsibilities:

   1. RESCHEDULE ROUTING — reads ?reschedule=<id>&remote=true&email=
      from the URL and hands off to initRescheduleFlow() (app.js)
      so returning clients land directly on the date/time step.

   2. FRESH BOOKING — calls resetState() + renderStep(1) when there
      are no URL params, starting the wizard from step 1.

   3. STEPPER CLICK NAV — attaches click listeners to wstep-1..5
      so users can click completed steps to navigate backwards.

   4. INLINE FIELD ERROR CLEARING — clears validation errors on
      f-name, f-phone, f-email, f-address as the user types.

   All core state, API calls, and rendering live in app.js, which is
   loaded before this file on booking.html.
   ================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  // Check if we are in reschedule mode
  const urlParams = new URLSearchParams(window.location.search);
  const rescheduleId = urlParams.get('reschedule');
  const isRemoteReschedule = urlParams.get('remote') === 'true';
  const clientEmail = urlParams.get('email') || '';

  if (rescheduleId) {
    if (typeof initRescheduleFlow === 'function') {
      initRescheduleFlow(rescheduleId, isRemoteReschedule, clientEmail);
    }
  } else {
    // Reuses the same resetState/renderStep logic from app.js,
    // but skips anything modal-specific (no backdrop, no overflow lock).
    if (typeof resetState === 'function') resetState();
    if (typeof renderStep === 'function') renderStep(1);
  }

  // Clear inline field errors as soon as the user starts correcting them
  ['f-name', 'f-phone', 'f-email', 'f-address'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('input', () => {
      const errEl = document.getElementById(`err-${id}`);
      if (errEl) errEl.textContent = '';
      input.classList.remove('field-invalid');
    });
  });

  // Stepper Click Navigation: Allow clicking completed steps to navigate back
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`wstep-${i}`);
    if (!el) continue;
    el.addEventListener('click', () => {
      if (typeof state !== 'undefined' && i < state.step) {
        // If rescheduling, block going back before step 3
        if (state.isRescheduling && i < 3) return;
        state.step = i;
        renderStep(i);
      }
    });
  }
});
