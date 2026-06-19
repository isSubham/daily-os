/*==========================================================
    DAILY OS — Netlify Function
    netlify/functions/send-test-push.js

    HTTP endpoint: POST /.netlify/functions/send-test-push

    Immediately sends a Web Push notification to the stored
    subscription. Used to verify the full push pipeline
    (VAPID keys → Netlify Blobs → device) without waiting
    for the scheduled function to fire.

    No request body needed. Returns JSON { ok, message }.
==========================================================*/

import webpush    from 'web-push';
import { getStore } from '@netlify/blobs';

export default async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    // Guard: VAPID keys must be configured
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        return new Response(
            JSON.stringify({ ok: false, message: 'VAPID keys not configured in env vars.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Load stored subscription
    const store = getStore('dos-push');
    const raw   = await store.get('subscription').catch(() => null);

    if (!raw) {
        return new Response(
            JSON.stringify({ ok: false, message: 'No subscription found. Enable Reminders first.' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
    }

    let subscription;
    try {
        subscription = JSON.parse(raw);
    } catch {
        return new Response(
            JSON.stringify({ ok: false, message: 'Subscription data corrupted.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@daily-os.app',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
    );

    const now = new Date();
    const payload = JSON.stringify({
        title: '⏰ Daily OS — Test Push',
        body:  `Push pipeline working! Sent at ${now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
        tag:   'dos-test',
    });

    try {
        await webpush.sendNotification(subscription, payload);
        console.log('[test-push] ✅ Test notification sent successfully');

        return new Response(
            JSON.stringify({ ok: true, message: 'Test push sent! Check your device.' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (err) {
        console.error('[test-push] Failed:', err.message);

        if (err.statusCode === 410) {
            // Subscription expired
            await store.delete('subscription').catch(() => {});
            return new Response(
                JSON.stringify({ ok: false, message: 'Subscription expired (410). Please re-enable Reminders.' }),
                { status: 410, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ ok: false, message: `Push failed: ${err.message}` }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};

export const config = {
    path: '/send-test-push',
};
