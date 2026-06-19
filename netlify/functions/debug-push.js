import { getStore } from '@netlify/blobs';
export default async (req) => {
    try {
        const store = getStore('dos-push');
        const log = await store.get('scheduler_log') || 'No log found';
        const sub = await store.get('subscription') || 'No sub found';
        return new Response(JSON.stringify({ log, sub }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
};
