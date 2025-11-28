import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    const hmac = crypto.createHmac('sha256', secret!);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signature = Buffer.from(request.headers.get('x-signature') || '', 'utf8');

    if (!crypto.timingSafeEqual(digest, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const payload = JSON.parse(rawBody);
    const { meta, data } = payload;

    if (meta.event_name === 'order_created') {
      const deviceId = meta.custom_data?.device_id;
      const userEmail = data.attributes.user_email; // Capture Email from Payment

      if (deviceId) {
        console.log(`💰 Payment: ${userEmail} (Device: ${deviceId})`);
        
        // Update credits AND link the email to this device_id
        await supabaseAdmin.from('users')
            .update({ 
                credits_remaining: 10, // Reset to 10 credits
                email: userEmail       // Link the email to the account
            })
            .eq('device_id', deviceId);
            
        // Fallback: If for some reason the update above didn't stick, ensure we add credits via RPC
        const { error } = await supabaseAdmin.rpc('increment_credits', { 
            row_device_id: deviceId, 
            amount: 10 
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}