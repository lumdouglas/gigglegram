import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js'; // Needed for Admin access
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import Replicate from 'replicate';

// Initialize Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();

    // 1. Standard Client (For Logged In Users)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
             try {
               cookiesToSet.forEach(({ name, value, options }) =>
                 cookieStore.set(name, value, options)
               );
             } catch {}
          },
        },
      }
    );

    // 2. Admin Client (For Guests / Bypassing RLS) 🛡️
    // We use this specifically to check Guest credits because RLS hides them from the standard client.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // <--- MAKE SURE THIS IS IN .ENV.LOCAL
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // 3. Identify the User
    const { data: { user } } = await supabase.auth.getUser();

    // ============================================================
    // 🛡️ GATEKEEPER LOGIC
    // ============================================================

    // SCENARIO A: Logged In User
    if (user) {
      const { data: creditResult, error: creditError } = await supabase.rpc('consume_credit', { 
        user_id: user.id 
      });

      if (creditError || !creditResult.success) {
        console.log('PAYWALL (User): 0 credits');
        return NextResponse.json({ error: 'Insufficient credits', remaining: 0 }, { status: 402 }); 
      }
      console.log('User Credit Deducted');
    } 
    
    // SCENARIO B: Guest (Device ID)
    else {
      const deviceId = request.headers.get('x-device-id');
      
      if (!deviceId) {
         return NextResponse.json({ error: 'No Device ID' }, { status: 401 });
      }

      // Use ADMIN client to find the guest row (Bypasses RLS)
      const { data: guestUser } = await supabaseAdmin
        .from('magic_users')
        .select('remaining_credits, christmas_pass')
        .eq('device_id', deviceId)
        .maybeSingle();

      // Check if they have credits
      if (!guestUser || (guestUser.remaining_credits < 1 && !guestUser.christmas_pass)) {
         console.log('PAYWALL (Guest): 0 credits');
         return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
      }

      // Deduct Credit (Manually, since RPC might fail on non-UUID guests)
      if (!guestUser.christmas_pass) {
        const { error: updateError } = await supabaseAdmin
          .from('magic_users')
          .update({ remaining_credits: (guestUser.remaining_credits || 0) - 1 })
          .eq('device_id', deviceId);
          
        if (updateError) {
            console.error("Failed to deduct guest credit", updateError);
            return NextResponse.json({ error: 'Transaction failed' }, { status: 500 });
        }
      }
      console.log('Guest Credit Deducted');
    }

    // ============================================================
    // 🟢 GREEN LIGHT: AI GENERATION
    // ============================================================

    const formData = await request.formData();
    const video = formData.get('video') as File;
    const face = formData.get('face') as File;

    if (!video || !face) return NextResponse.json({ error: 'Missing files' }, { status: 400 });

    const videoBuffer = await video.arrayBuffer();
    const faceBuffer = await face.arrayBuffer();
    const videoBase64 = `data:${video.type};base64,${Buffer.from(videoBuffer).toString('base64')}`;
    const faceBase64 = `data:${face.type};base64,${Buffer.from(faceBuffer).toString('base64')}`;

    const prediction = await replicate.predictions.create({
      version: "104b4a39315349db50880757bc8c1c996c5309e3aa11286b0a3c84dab81fd440",
      input: {
        source: videoBase64,
        target: faceBase64
      },
    });

    let finalPrediction = prediction;
    while (
      finalPrediction.status !== 'succeeded' &&
      finalPrediction.status !== 'failed' &&
      finalPrediction.status !== 'canceled'
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      finalPrediction = await replicate.predictions.get(prediction.id);
    }

    if (finalPrediction.status === 'failed') {
      return NextResponse.json({ error: 'AI Generation Failed' }, { status: 500 });
    }

    return NextResponse.json({ url: finalPrediction.output });

  } catch (error: any) {
    console.error('Route Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}