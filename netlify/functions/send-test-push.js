/*==========================================================
    DAILY OS — Netlify Function
    netlify/functions/send-test-push.js

    HTTP endpoint: POST /.netlify/functions/send-test-push

    Immediately sends a Web Push notification to the stored
    subscription. Used to verify the full push pipeline
    (VAPID keys → Netlify Blobs → device) without waiting
    for the scheduled function.

    Returns JSON { ok: bool, message: string }
==========================================================*/

import webpush      from 'web-push';
import { getStore } from '@netlify/blobs';

const JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export default async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    if (req.method !== 'POST') {
        return json({ ok: false, message: 'Method not allowed.' }, 405);
    }

    // Guard: VAPID keys must be configured
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        return json({
            ok: false,
            message: 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set in Netlify env vars.',
        }, 500);
    }

    // Load stored subscription from Netlify Blobs
    let raw;
    try {
        const store = getStore('dos-push');
        raw = await store.get('subscription');
    } catch (err) {
        return json({ ok: false, message: `Blob store error: ${err.message}` }, 500);
    }

    if (!raw) {
        return json({
            ok: false,
            message: 'No subscription found. Tap "Enable Reminders" in the app first.',
        }, 404);
    }

    let subscription;
    try {
        subscription = JSON.parse(raw);
    } catch {
        return json({ ok: false, message: 'Subscription data is corrupted.' }, 500);
    }

    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@daily-os.app',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
    );

    const now     = new Date();
    const timeIST = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
    const payload = JSON.stringify({
        title: '⏰ Daily OS — Test Push',
        body:  `Pipeline ✅ — sent at ${timeIST} IST`,
        tag:   'dos-test',
    });

    try {
        await webpush.sendNotification(subscription, payload);
        console.log('[test-push] ✅ Sent successfully at', timeIST);
        return json({ ok: true, message: `Test push sent! Check your device. (${timeIST} IST)` });

    } catch (err) {
        console.error('[test-push] Failed:', err.statusCode, err.message);

        if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription expired or invalid — delete it
            try {
                const store = getStore('dos-push');
                await store.delete('subscription');
            } catch {}
            return json({
                ok: false,
                message: 'Subscription expired (re-enable Reminders to re-subscribe).',
            }, 410);
        }

        return json({ ok: false, message: `Push failed: ${err.message}` }, 500);
    }
};

// NOTE: No config.path here — function is accessed at the default
// /.netlify/functions/send-test-push (determined by filename)
