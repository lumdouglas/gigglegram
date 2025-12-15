import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import Replicate from 'replicate';

// Initialize Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    // 1. Setup Supabase Client (Secure Server-Side)
    const supabase = createRouteHandlerClient({ cookies });
    
    // 2. Identify the User
    // We try to get the logged-in user first.
    const { data: { user } } = await supabase.auth.getUser();

    // 3. THE CREDIT CHECK (Gatekeeper) 🛡️
    // If we have a user, we use the Secure RPC function you just added.
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
        }, { status: 402 }); // 402 = Payment Required
      }
      
      console.log('CREDIT DEDUCTED. Remaining:', creditResult.remaining);
    } 
    
    // --- GUEST HANDLING (Optional Fallback) ---
    // If there is NO logged-in user, we check the legacy device_id.
    // NOTE: The RPC 'consume_credit' requires a UUID, so we handle guests manually here.
    else {
      const deviceId = request.headers.get('x-device-id');
      
      if (deviceId) {
        // Securely check guest credits on the server
        const { data: guestUser } = await supabase
          .from('magic_users')
          .select('remaining_credits, christmas_pass')
          .eq('device_id', deviceId)
          .single();

        // Guest Gatekeeper
        if (!guestUser || (guestUser.remaining_credits < 1 && !guestUser.christmas_pass)) {
           return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
        }

        // Deduct Guest Credit (Server-Side)
        if (!guestUser.christmas_pass) {
          await supabase
            .from('magic_users')
            .update({ remaining_credits: (guestUser.remaining_credits || 0) - 1 })
            .eq('device_id', deviceId);
        }
      }
    }

    // ============================================================
    // 🟢 GREEN LIGHT: If we got here, the user has paid/credits.
    // ============================================================

    const formData = await request.formData();
    const video = formData.get('video') as File;
    const face = formData.get('face') as File;

    if (!video || !face) {
      return NextResponse.json({ error: 'Missing files' }, { status: 400 });
    }

    // 5. Convert Files to Base64 for Replicate
    // (Replicate prefers URLs, but base64 works for small files. 
    // Ideally, we upload to Supabase Storage first, but this keeps it simple for now).
    const videoBuffer = await video.arrayBuffer();
    const faceBuffer = await face.arrayBuffer();

    const videoBase64 = `data:${video.type};base64,${Buffer.from(videoBuffer).toString('base64')}`;
    const faceBase64 = `data:${face.type};base64,${Buffer.from(faceBuffer).toString('base64')}`;

    // 6. Call Replicate (This costs you money, so we protected it above)
    // Using the Long ID as discussed
    const prediction = await replicate.predictions.create({
      version: "104b4a39315349db50880757bc8c1c996c5309e3aa11286b0a3c84dab81fd440",
      input: {
        source: videoBase64,  // The Video
        target: faceBase64    // The Face
      },
    });

    // 7. Poll for Completion
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