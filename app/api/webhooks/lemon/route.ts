import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    // 1. Validate the Request (Security)
    const text = await request.text();
    const hmac = crypto.createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET!);
    const digest = Buffer.from(hmac.update(text).digest('hex'), 'utf8');
    const signature = Buffer.from(request.headers.get('x-signature') || '', 'utf8');

    if (!crypto.timingSafeEqual(digest, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. Parse the Data
    const payload = JSON.parse(text);
    const eventName = payload.meta.event_name;
    const customData = payload.meta.custom_data; // This contains the 'device_id' we sent from page.tsx
    const variantId = payload.data.attributes.variant_id; // Which product did they buy?

    // 3. Only run on successful orders
    if (eventName === 'order_created') {
      const deviceId = customData?.device_id;
      
      if (!deviceId) {
        console.error("❌ Webhook Error: No device_id found in custom_data");
        return NextResponse.json({ error: 'No User ID' }, { status: 400 });
      }

      // 4. Connect to Admin DB
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // 5. Get Current User Stats
      const { data: user } = await supabaseAdmin
        .from('magic_users')
        .select('remaining_credits, purchased_packs')
        .eq('device_id', deviceId)
        .single();

      const currentCredits = user?.remaining_credits || 0;
      const currentPacks = user?.purchased_packs || 0;

      // 6. APPLY LOGIC BASED ON PRODUCT
      // You need to check your LemonSqueezy Dashboard for these exact Variant IDs
      // For now, we will assume:
      // Small Pack ($4.99) usually has a specific ID
      // Big Pass ($29.99) usually has a different ID
      
      // OPTION A: The $29.99 "Super Grandma" Pass
      // (Replace '12345' with your actual Variant ID for the $29.99 product)
      if (variantId == 12345 || payload.data.attributes.total_price === 2999) {
          await supabaseAdmin
            .from('magic_users')
            .update({ 
                christmas_pass: true, 
                free_swap_used: false 
            })
            .eq('device_id', deviceId);
          console.log(`✅ UPGRADED ${deviceId} to VIP`);
      } 
      
      // OPTION B: The $4.99 "10 Magic Videos" Pack
      // (Replace '67890' with actual ID, or rely on price check)
      else if (variantId == 67890 || payload.data.attributes.total_price === 499) {
          await supabaseAdmin
            .from('magic_users')
            .update({ 
                remaining_credits: currentCredits + 10,
                purchased_packs: currentPacks + 1 // <--- THIS IS THE FIX
            })
            .eq('device_id', deviceId);
          console.log(`✅ ADDED 10 Credits to ${deviceId}`);
      }

    }

    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error("Webhook Failed:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}