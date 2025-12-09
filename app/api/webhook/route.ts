import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Initialize Admin Client (Bypasses Security Rules to update User)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // MUST be the Service Role Key, not Anon!
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
    // The secret here MUST match 'secret_717' from your screenshot
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
    // This 'user_id' comes from the checkout link we created earlier
    const userId = payload.meta.custom_data?.user_id; 

    console.log(`🔔 Webhook received: ${eventName}`);

    // 4. Handle the Payment
    if (eventName === 'order_created' && userId) {
      console.log(`🎄 Christmas Pass Unlocked for User: ${userId}`);

      const { error } = await supabase
        .from('users') // Ensure this matches your Supabase table name
        .update({ 
            christmas_pass: true,
            credits_remaining: 9999 // Unlock everything
        })
        .eq('user_id', userId);

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