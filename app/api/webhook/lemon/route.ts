import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Initialize Admin Client (Bypasses Security Rules to update User)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // MUST be the Service Role Key!
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    // 1. Grab the raw body (Required for crypto verification)
    const text = await request.text();
    
    // 2. Verify the Signature (Security First)
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!; 
    const hmac = crypto.createHmac('sha256', secret);
    const digest = Buffer.from(hmac.update(text).digest('hex'), 'utf8');
    const signature = Buffer.from(request.headers.get('x-signature') || '', 'utf8');

    if (!crypto.timingSafeEqual(digest, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 3. Parse the Payload
    const payload = JSON.parse(text);
    const eventName = payload.meta.event_name;
    
    // 🚨 CRITICAL: Extract the Device ID we sent during checkout
    const deviceId = payload.meta.custom_data?.device_id;
    const userEmail = payload.data.attributes.user_email;

    console.log(`🔔 Webhook received: ${eventName}`);

    // 4. Handle "Order Created" (Successful Payment)
    if (eventName === 'order_created' && deviceId) {
      console.log(`🎄 Christmas Pass Unlocked for Device: ${deviceId} (${userEmail})`);

      // Update the user based on DEVICE_ID
      const { error } = await supabase
        .from('users') 
        .update({ 
            christmas_pass: true,     // Unlock the gate (Unlimited Access)
            credits_remaining: 999,   // Visual indicator for "Unlimited"
            email: userEmail          // Capture email for Magic Link restoration
        })
        .eq('device_id', deviceId);

      if (error) {
        console.error('Supabase Update Failed:', error);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
      }
    }

    // 5. Tell Lemon Squeezy "We got it"
    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}