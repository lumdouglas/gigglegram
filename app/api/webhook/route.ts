import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase Admin (Bypasses RLS to update credits securely)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // You need to add this to Vercel Env Vars
);

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    const hmac = crypto.createHmac('sha256', secret!);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signature = Buffer.from(request.headers.get('x-signature') || '', 'utf8');

    // 1. Verify Signature (Security)
    if (!crypto.timingSafeEqual(digest, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const payload = JSON.parse(rawBody);
    const { meta, data } = payload;

    // 2. Filter for "order_created"
    if (meta.event_name === 'order_created') {
      // We pass the 'device_id' as 'custom_data' in the checkout link
      const deviceId = meta.custom_data?.device_id; 

      if (deviceId) {
        console.log(`💰 Payment Received for device: ${deviceId}. Adding 10 credits.`);
        
        // 3. Update Supabase
        // Logic: Increment credits by 10
        const { error } = await supabaseAdmin.rpc('increment_credits', { 
            row_device_id: deviceId, 
            amount: 10 
        });
        
        // Fallback if RPC doesn't exist (Simple update)
        if (error) {
             const { data: user } = await supabaseAdmin
                .from('users').select('credits_remaining').eq('device_id', deviceId).single();
             
             await supabaseAdmin.from('users')
                .update({ credits_remaining: (user?.credits_remaining || 0) + 10 })
                .eq('device_id', deviceId);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}