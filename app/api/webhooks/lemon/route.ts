import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    console.log("🔔 Webhook Received!");

    // 1. READ RAW BODY (Needed for signature)
    const rawBody = await request.text();
    
    // 2. CHECK SECRET
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    if (!secret) {
        console.error("❌ CRITICAL: LEMONSQUEEZY_WEBHOOK_SECRET is missing in Vercel Env Vars!");
        return NextResponse.json({ error: 'Server Config Missing' }, { status: 500 });
    }

    // 3. VERIFY SIGNATURE (Security)
    const hmac = crypto.createHmac('sha256', secret);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signature = Buffer.from(request.headers.get('x-signature') || '', 'utf8');

    if (!crypto.timingSafeEqual(digest, signature)) {
      console.error("❌ Signature Mismatch! check your Webhook Secret.");
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 4. PARSE DATA
    const payload = JSON.parse(rawBody);
    const { meta, data } = payload;
    const eventName = meta.event_name;
    const customData = meta.custom_data;
    const variantId = data.attributes.variant_id;
    const totalPrice = data.attributes.total_price;
    
    console.log(`📦 Event: ${eventName}`);
    console.log(`🆔 Variant ID: ${variantId}`);
    console.log(`💰 Total Price: ${totalPrice}`);
    console.log(`👤 Custom Data (Device ID):`, customData);

    if (eventName !== 'order_created') {
        return NextResponse.json({ message: 'Ignored non-order event' });
    }

    // 5. CHECK DEVICE ID
    const deviceId = customData?.device_id;
    if (!deviceId) {
        console.error("❌ MISSING DEVICE ID. Did you include checkout[custom][device_id] in the URL?");
        return NextResponse.json({ error: 'No User ID' }, { status: 400 });
    }

    // 6. CONNECT TO DB
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 7. GET CURRENT USER
    const { data: user, error: fetchError } = await supabaseAdmin
        .from('magic_users')
        .select('remaining_credits, purchased_packs')
        .eq('device_id', deviceId)
        .single();
    
    if (fetchError) {
        console.error("❌ DB Fetch Error:", fetchError);
        return NextResponse.json({ error: 'DB Error' }, { status: 500 });
    }

    const currentCredits = user?.remaining_credits || 0;
    const currentPacks = user?.purchased_packs || 0;

    console.log(`📊 Current State for ${deviceId}: Credits=${currentCredits}, Packs=${currentPacks}`);

    // 8. UPDATE LOGIC (Using Price as Backup)
    // $29.99 Pass
    if (totalPrice == 2999) { 
        console.log("🚀 PROCESSING: VIP PASS");
        await supabaseAdmin
            .from('magic_users')
            .update({ christmas_pass: true, free_swap_used: false })
            .eq('device_id', deviceId);
    } 
    // $4.99 Pack
    else if (totalPrice == 499) { 
        console.log("🚀 PROCESSING: 10 CREDIT PACK");
        const { error: updateError } = await supabaseAdmin
            .from('magic_users')
            .update({ 
                remaining_credits: currentCredits + 10,
                purchased_packs: currentPacks + 1 
            })
            .eq('device_id', deviceId);
            
        if (updateError) console.error("❌ Update Failed:", updateError);
        else console.log("✅ Update Success!");
    } else {
        console.warn(`⚠️ Unknown Price Point: ${totalPrice}. No action taken.`);
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("💥 Webhook Crash:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}