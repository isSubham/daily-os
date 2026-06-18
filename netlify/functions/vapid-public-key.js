/*==========================================================
    DAILY OS — Netlify Function
    netlify/functions/vapid-public-key.js

    Returns the VAPID public key so the client can subscribe
    to Web Push without hardcoding the key in the frontend.
==========================================================*/

export default async () => {
    const key = process.env.VAPID_PUBLIC_KEY;

    if (!key) {
        return new Response(
            JSON.stringify({ error: 'VAPID_PUBLIC_KEY not configured' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
        JSON.stringify({ key }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            },
        }
    );
};
