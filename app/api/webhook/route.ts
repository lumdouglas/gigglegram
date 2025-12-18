import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;
    const hmac = crypto.createHmac('sha256', secret);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signature = Buffer.from(request.headers.get('x-signature') || '', 'utf8');

    if (!crypto.timingSafeEqual(digest, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const { meta, data } = payload;
    const eventName = meta.event_name;
    const customData = meta.custom_data;
    
    // FIX: Check 'total' (Standard) OR 'total_price' (Legacy)
    const price = data.attributes.total ?? data.attributes.total_price;
    const deviceId = customData?.device_id;

    console.log(`🔔 Event: ${eventName} | Price: ${price} | User: ${deviceId}`);

    if (eventName !== 'order_created' || !deviceId) {
      return NextResponse.json({ message: 'Ignored' });
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get Current State
    const { data: user } = await supabaseAdmin
        .from('magic_users')
        .select('remaining_credits, purchased_packs')
        .eq('device_id', deviceId)
        .single();

    const currentCredits = user?.remaining_credits || 0;
    const currentPacks = user?.purchased_packs || 0;

    // UPDATE LOGIC
    // 499 cents = $4.99
    if (price == 499) {
        console.log(`🚀 SUCCESS: Adding 10 Credits + 1 Pack to ${deviceId}`);
        
        await supabaseAdmin
            .from('magic_users')
            .update({ 
                remaining_credits: currentCredits + 10,
                purchased_packs: currentPacks + 1 
            })
            .eq('device_id', deviceId);
            
    } else if (price == 2999) {
        console.log(`🚀 SUCCESS: Unlocking VIP Pass for ${deviceId}`);
        
        await supabaseAdmin
            .from('magic_users')
            .update({ christmas_pass: true, free_swap_used: false })
            .eq('device_id', deviceId);
    } else {
        console.warn(`⚠️ Price ${price} did not match any products.`);
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Webhook Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}