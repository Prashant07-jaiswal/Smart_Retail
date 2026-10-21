/**
 * Notification sound for new-order alerts.
 *
 * Browsers block audio that isn't tied to a user gesture. Creating a brand
 * new AudioContext inside an async Socket.IO callback (as the previous
 * implementation did) gets silently suspended by the browser — no error,
 * just no sound. The fix: create ONE AudioContext for the whole session and
 * "unlock" it during any real user click/keypress (login, navigating, etc.),
 * then reuse that already-running context for every later notification,
 * even ones triggered by a background socket event with no gesture attached.
 */
let audioCtx = null;

function getContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

/** Call from any real user-gesture handler (click, keydown) to unlock audio for the session. */
export function unlockNotificationAudio() {
  const ctx = getContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

/**
 * A sharp, loud, long bell strike — like a service-counter "ding!" bell,
 * not a synth beep. Uses additive synthesis with inharmonic partials (the
 * classic technique for a metallic bell timbre: overtones that are NOT
 * clean multiples of the fundamental, each ringing out at its own decay
 * rate) — a sharp near-instant attack, then a long natural decay tail.
 * Struck twice ("ding-ding!") for a total length of roughly 2.5–3 seconds.
 */
function strikeBell(ctx, startTime, fundamental, peakGain) {
  // [frequency ratio, relative loudness, ring-out time in seconds]
  const partials = [
    [1.0, 1.0, 2.2],
    [2.0, 0.55, 1.7],
    [3.0, 0.35, 1.3],
    [4.2, 0.22, 0.9],
    [5.4, 0.14, 0.6],
    [6.8, 0.08, 0.4],
  ];

  partials.forEach(([ratio, relGain, decay]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = fundamental * ratio;
    osc.connect(gain);
    gain.connect(ctx.destination);

    const peak = peakGain * relGain;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peak, startTime + 0.006); // sharp attack
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay); // long ring-out

    osc.start(startTime);
    osc.stop(startTime + decay + 0.05);
  });
}

export function playNewOrderSound() {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    strikeBell(ctx, now, 1000, 0.5); // first strike — bright and loud
    strikeBell(ctx, now + 0.7, 1000, 0.45); // second strike — reinforces it
  } catch {
    // Audio is a nice-to-have alert, never worth breaking the app over.
  }
}

/**
 * Best-effort OS-level desktop notification, so the owner notices a new
 * order even if the browser tab isn't focused. Silently does nothing if
 * permission isn't granted — the in-app toast + sound are the guaranteed path.
 */
export function requestDesktopNotificationPermission() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

export function showNewOrderDesktopNotification(order) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const notification = new Notification('🔔 New order received', {
      body: `Order #${order.id} from ${order.customer_name} — ₹${order.total_amount}`,
      tag: `order-${order.id}`,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Non-critical — ignore.
  }
}
