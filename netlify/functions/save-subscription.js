/*==========================================================
    DAILY OS — Netlify Function
    netlify/functions/save-subscription.js

    Receives the browser's PushSubscription object and stores
    it in Netlify Blobs (built-in key-value store, no DB needed).

    Called once when the user taps "Enable Reminders".
==========================================================*/

import { getStore } from '@netlify/blobs';

export default async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    let subscription;
    try {
        subscription = await req.json();
    } catch {
        return new Response(
            JSON.stringify({ error: 'Invalid JSON body' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    if (!subscription?.endpoint) {
        return new Response(
            JSON.stringify({ error: 'Missing subscription.endpoint' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        const store = getStore('dos-push');
        await store.set('subscription', JSON.stringify(subscription), {
            metadata: { savedAt: new Date().toISOString() },
        });

        console.log('[push] Subscription saved to Netlify Blobs');

        return new Response(
            JSON.stringify({ ok: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (err) {
        console.error('[push] Failed to save subscription:', err);
        return new Response(
            JSON.stringify({ error: 'Storage error', detail: err.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
