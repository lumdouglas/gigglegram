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
                credits_remaining: 10, // Reset to 10 or increment
                email: userEmail       // Link the email!
            })
            .eq('device_id', deviceId);
            
        // Note: For a robust system, we should increment, but for MVP launch reset is safer against duplicates
        // Ideally: credits_remaining = credits_remaining + 10
        const { error } = await supabaseAdmin.rpc('increment_credits', { 
            row_device_id: deviceId, 
            amount: 10 
        });
        
        // Also ensure email is set if RPC only did credits
        await supabaseAdmin.from('users')
            .update({ email: userEmail })
            .eq('device_id', deviceId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}