import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Validate Signature
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });

    const rawBody = await request.text();
    const hmac = crypto.createHmac('sha256', secret);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signature = Buffer.from(request.headers.get('x-signature') || '', 'utf8');

    if (!crypto.timingSafeEqual(digest, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const { meta, data } = payload;
    const eventName = meta.event_name;
    const customData = meta.custom_data || {};
    const deviceId = customData.device_id;
    const variantId = data.attributes.variant_id; // This tells us WHAT they bought

    if (eventName === 'order_created' && deviceId) {
        
        // 2. Init Admin Client (Standard Supabase Client)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        console.log(`💰 Webhook: Order for Device ${deviceId}. Variant: ${variantId}`);

        // ⚠️ CRITICAL CONFIGURATION REQUIRED ⚠️
        // You MUST find these numbers in your Lemon Squeezy Dashboard -> Products -> Variants
        const CHRISTMAS_PASS_VARIANT_ID = "675e173b-4d24-4ef7-94ac-2e16979f6615"; // REPLACE WITH REAL ID (e.g. 518394)
        const COOKIE_PACK_VARIANT_ID = "adf30529-5df7-4758-8d10-6194e30b54c7"; // REPLACE WITH REAL ID

        // LOGIC: Distinguish between products
        // We convert everything to strings to be safe against number/string mismatches
        
        if (String(variantId) === String(CHRISTMAS_PASS_VARIANT_ID)) { 
             console.log("🎄 Unlocking Christmas Pass");
             await supabase.from('users').update({ christmas_pass: true }).eq('device_id', deviceId);
        } 
        
        // If it matches the Cookie Pack (or you can use `else` if you only have 2 products)
        else {
             console.log("🍪 Adding 10 Credits");
             // Fetch current credits first
             const { data: user } = await supabase.from('users').select('credits_remaining').eq('device_id', deviceId).single();
             const current = user?.credits_remaining || 0;
             
             await supabase.from('users').update({ 
                 credits_remaining: current + 10,
                 free_swap_used: true // Stop them from getting the free trial again
             }).eq('device_id', deviceId);
        }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}