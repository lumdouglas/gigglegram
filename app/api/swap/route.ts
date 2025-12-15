import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import Replicate from 'replicate';

// Initialize Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    // 1. Setup Supabase Client (Modern SSR) 🛠️
    // ⚠️ NEXT.JS 15 FIX: We must 'await' the cookies() call now.
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    
    // 2. Identify the User
    const { data: { user } } = await supabase.auth.getUser();

    // 3. THE CREDIT CHECK (Gatekeeper) 🛡️
    if (user) {
      const { data: creditResult, error: creditError } = await supabase.rpc('consume_credit', { 
        user_id: user.id 
      });

      if (creditError) {
        console.error('Credit transaction failed:', creditError);
        return NextResponse.json({ error: 'Transaction failed' }, { status: 500 });
      }

      // 4. STOP if insufficient credits 🛑
      if (!creditResult.success) {
        console.log('PAYWALL TRIGGERED: User has 0 credits');
        return NextResponse.json({ 
          error: 'Insufficient credits', 
          remaining: 0 
        }, { status: 402 }); 
      }
      
      console.log('CREDIT DEDUCTED. Remaining:', creditResult.remaining);
    } 
    
    // --- GUEST HANDLING ---
    else {
      const deviceId = request.headers.get('x-device-id');
      
      if (deviceId) {
        const { data: guestUser } = await supabase
          .from('magic_users')
          .select('remaining_credits, christmas_pass')
          .eq('device_id', deviceId)
          .single();

        if (!guestUser || (guestUser.remaining_credits < 1 && !guestUser.christmas_pass)) {
           return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
        }

        if (!guestUser.christmas_pass) {
          await supabase
            .from('magic_users')
            .update({ remaining_credits: (guestUser.remaining_credits || 0) - 1 })
            .eq('device_id', deviceId);
        }
      }
    }

    // ============================================================
    // 🟢 GREEN LIGHT
    // ============================================================

    const formData = await request.formData();
    const video = formData.get('video') as File;
    const face = formData.get('face') as File;

    if (!video || !face) {
      return NextResponse.json({ error: 'Missing files' }, { status: 400 });
    }

    const videoBuffer = await video.arrayBuffer();
    const faceBuffer = await face.arrayBuffer();
    const videoBase64 = `data:${video.type};base64,${Buffer.from(videoBuffer).toString('base64')}`;
    const faceBase64 = `data:${face.type};base64,${Buffer.from(faceBuffer).toString('base64')}`;

    // 6. Call Replicate (Using the Long ID)
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