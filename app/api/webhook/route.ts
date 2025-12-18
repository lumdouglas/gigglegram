import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  console.log("🟢 WEBHOOK VERSION: 2.0 (PACKS FIX)");  
  
  try {
    // 1. SETUP & SECURITY
    const text = await request.text();
    const hmac = crypto.createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET!);
    const digest = Buffer.from(hmac.update(text).digest('hex'), 'utf8');
    const signature = Buffer.from(request.headers.get('x-signature') || '', 'utf8');

    if (!crypto.timingSafeEqual(digest, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. PARSE LEMONSQUEEZY DATA
    const payload = JSON.parse(text);
    const { meta, data } = payload;
    const eventName = meta.event_name;
    const customData = meta.custom_data;
    const totalPrice = data.attributes.total_price;
    const deviceId = customData?.device_id;

    if (eventName !== 'order_created' || !deviceId) {
      return NextResponse.json({ message: 'Ignored' });
    }

    // 3. DATABASE CONNECTION
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 4. GET CURRENT STATS
    const { data: user } = await supabaseAdmin
        .from('magic_users')
        .select('remaining_credits, purchased_packs')
        .eq('device_id', deviceId)
        .single();

    const currentCredits = user?.remaining_credits || 0;
    const currentPacks = user?.purchased_packs || 0;

    // 5. UPDATE LOGIC
    // PRICE CHECK: 499 cents = $4.99
    if (totalPrice == 499) {
        console.log(`🚀 UPGRADING ${deviceId}: +10 Credits, +1 Pack`);
        
        await supabaseAdmin
            .from('magic_users')
            .update({ 
                remaining_credits: currentCredits + 10,  // Adds 10 to whatever they had
                purchased_packs: currentPacks + 1        // INCREMENTS PACK COUNT
            })
            .eq('device_id', deviceId);
            
    } else if (totalPrice == 2999) {
        console.log(`🚀 UPGRADING ${deviceId}: VIP PASS`);
        
        await supabaseAdmin
            .from('magic_users')
            .update({ christmas_pass: true, free_swap_used: false })
            .eq('device_id', deviceId);
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Webhook Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}