/*==========================================================
    DAILY OS — Netlify Scheduled Function
    netlify/functions/push-scheduler.js

    Runs every minute via cron.
    Checks current IST time against Subham's fixed block
    schedule, then fires a Web Push notification to the
    stored device subscription when a block is 5 min away
    or just started.

    Works even when the PWA is closed or the phone is offline
    (notification queues and delivers once connected).

    Required env vars (set in Netlify dashboard):
      VAPID_PUBLIC_KEY   — from: npx web-push generate-vapid-keys
      VAPID_PRIVATE_KEY  — from: npx web-push generate-vapid-keys
      VAPID_SUBJECT      — mailto:your@email.com
==========================================================*/

import webpush  from 'web-push';
import { getStore } from '@netlify/blobs';

/* ─── IST timezone helper ─────────────────────────────── */

function getNowIST() {
    const now    = new Date();
    // IST = UTC + 5h 30min
    const istMs  = now.getTime() + (5 * 60 + 30) * 60 * 1000;
    const ist    = new Date(istMs);
    const day    = ist.getUTCDay();          // 0=Sun 1=Mon … 6=Sat
    const h      = ist.getUTCHours();
    const m      = ist.getUTCMinutes();
    const nowMin = h * 60 + m;
    return { day, nowMin, h, m };
}

/* ─── Block schedule (IST minutes) ───────────────────── */
/*
  Each entry: { start, end?, name, emoji }
  end is optional — used for "ending in 5 min" alerts.
*/

const MWF = [
    { start:  7*60+30, end:  7*60+30, name: 'Wake Anchor',        emoji: '🌅' },
    { start: 10*60,    end: 19*60,    name: 'Office Mode',         emoji: '💼', longBlock: true },
    { start: 13*60,    end: 14*60,    name: 'Lunch · Job Scout',   emoji: '🍱' },
    { start: 19*60,    end: 19*60+30, name: 'Office Sign-off',     emoji: '🚪' },
    { start: 20*60,    end: 21*60,    name: 'DSA Session',         emoji: '📘' },
    { start: 21*60,    end: 24*60,    name: 'Free Time',           emoji: '🌙' },
];

const TT = [
    { start:  7*60+30, end:  7*60+30, name: 'Wake Anchor',        emoji: '🌅' },
    { start: 10*60,    end: 19*60,    name: 'Office Mode',         emoji: '💼', longBlock: true },
    { start: 13*60,    end: 14*60,    name: 'Lunch · Job Scout',   emoji: '🍱' },
    { start: 19*60,    end: 19*60+30, name: 'Office Sign-off',     emoji: '🚪' },
    { start: 20*60,    end: 21*60,    name: 'Node.js Side Project',emoji: '💻' },
    { start: 21*60,    end: 24*60,    name: 'Free Time',           emoji: '🌙' },
];

const SAT = [
    { start:  7*60+30, name: 'Wake Anchor',    emoji: '🌅' },
    { start:  8*60+30, end:  9*60,    name: 'T2 Preparation',   emoji: '📋' },
    { start:  9*60,    end:  9*60+30, name: 'Bulk Apply',        emoji: '🚀' },
    { start:  9*60+30, end: 10*60,    name: 'Cold Outreach',     emoji: '📧' },
    { start: 10*60,    end: 10*60+30, name: 'Follow-ups',        emoji: '🔄' },
    { start: 10*60+30,               name: 'Recovery Day',       emoji: '🌴' },
];

const SUN = [
    { start:  7*60+30, name: 'Wake Anchor',   emoji: '🌅' },
    { start:  9*60,    end: 10*60, name: 'Weekly Review',  emoji: '📊' },
    { start: 10*60,               name: 'Recharge Day',    emoji: '🌙' },
];

// Map JS getDay() → schedule
const SCHEDULE = {
    0: SUN,   // Sunday
    1: MWF,   // Monday
    2: TT,    // Tuesday
    3: MWF,   // Wednesday
    4: TT,    // Thursday
    5: MWF,   // Friday
    6: SAT,   // Saturday
};

/* ─── Push helper ─────────────────────────────────────── */

async function sendPush(subscription, title, body, tag) {
    const payload = JSON.stringify({ title, body, tag });

    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT  || 'mailto:admin@daily-os.app',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
    );

    try {
        await webpush.sendNotification(subscription, payload);
        console.log(`[push] ✅ Sent: "${title}" — ${body}`);
    } catch (err) {
        if (err.statusCode === 410) {
            // Subscription expired — clear it
            console.warn('[push] Subscription gone (410). Clearing.');
            const store = getStore('dos-push');
            await store.delete('subscription');
        } else {
            console.error('[push] Failed to send:', err.message);
        }
    }
}

/* ─── Main scheduled handler ──────────────────────────── */

export default async () => {
    // Guard: ensure VAPID keys are configured
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        console.warn('[push] VAPID keys not set. Skipping.');
        return;
    }

    // Load stored subscription
    const store = getStore('dos-push');
    const raw   = await store.get('subscription');
    if (!raw) {
        // No subscription yet — user hasn't enabled reminders
        return;
    }

    let subscription;
    try {
        subscription = JSON.parse(raw);
    } catch {
        console.error('[push] Corrupted subscription JSON');
        return;
    }

    const { day, nowMin } = getNowIST();
    const blocks = SCHEDULE[day] ?? MWF;

    for (const block of blocks) {
        const { start, end, name, emoji, longBlock } = block;

        // ── 5 minutes before block starts ──────────────
        if (nowMin === start - 5) {
            await sendPush(
                subscription,
                `${emoji} Coming up in 5 min`,
                `${name} starts at ${fmtMin(start)}`,
                `dos-pre-${day}-${start}`,
            );
        }

        // ── Block starts NOW ────────────────────────────
        if (nowMin === start && !longBlock) {
            // Skip 9-hour office "longBlock" start — too noisy at 10AM
            await sendPush(
                subscription,
                `${emoji} Starting now`,
                name,
                `dos-start-${day}-${start}`,
            );
        }

        // ── 5 minutes before block ends ─────────────────
        if (end && nowMin === end - 5) {
            await sendPush(
                subscription,
                `⏱ Wrapping up in 5 min`,
                `${name} ends at ${fmtMin(end)}`,
                `dos-end-${day}-${end}`,
            );
        }
    }
};

/* ─── Cron: every minute ──────────────────────────────── */

export const config = {
    schedule: '* * * * *',
};

/* ─── Util ────────────────────────────────────────────── */

function fmtMin(mins) {
    const h  = Math.floor(mins / 60) % 24;
    const m  = mins % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 || 12;
    return `${hh}:${String(m).padStart(2,'0')} ${ap}`;
}
