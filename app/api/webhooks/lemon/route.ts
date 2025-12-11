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
    
    // 🔍 DEBUG LOGGING (Check Vercel Logs if this fails!)
    console.log(`💰 Webhook Event: ${eventName}`);
    console.log(`👤 Device ID: ${deviceId}`);
    
    // We use the TOTAL PRICE to identify the product (safer than IDs)
    // 499 = $4.99 (Credits), 2999 = $29.99 (Pass)
    const total = data.attributes.total; 
    console.log(`💵 Total Price: ${total}`);

    if (eventName === 'order_created' && deviceId) {
        
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // OPTION A: CHRISTMAS PASS ($29.99)
        if (total === 2999) { 
             console.log("🎄 Logic: Unlocking Christmas Pass");
             const { error } = await supabase
                .from('users')
                .update({ christmas_pass: true })
                .eq('device_id', deviceId);
             
             if (error) console.error("DB Error:", error);
        } 
        
        // OPTION B: 10 CREDITS ($4.99)
        else if (total === 499) {
             console.log("🍪 Logic: Adding 10 Credits");
             
             // 1. Get current credits
             const { data: user, error: fetchError } = await supabase
                .from('users')
                .select('credits_remaining')
                .eq('device_id', deviceId)
                .single();
             
             if (fetchError) console.error("Fetch Error:", fetchError);

             const current = user?.credits_remaining || 0;
             const newTotal = current + 10;

             // 2. Add 10 more
             const { error: updateError } = await supabase.from('users').update({ 
                 credits_remaining: newTotal,
                 free_swap_used: true 
             }).eq('device_id', deviceId);

             if (updateError) console.error("Update Error:", updateError);
             else console.log(`✅ Credits updated to ${newTotal}`);
        }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('❌ Webhook Critical Failure:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}