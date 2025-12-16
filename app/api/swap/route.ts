import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Replicate from 'replicate';

// Initialize Replicate
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// 1. GET: Check Status (Polling)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const predictionId = searchParams.get('id');

  if (!predictionId) {
    return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  }

  try {
    // Check Replicate for status
    const prediction = await replicate.predictions.get(predictionId);
    
    // Map Replicate status to our simplified status
    return NextResponse.json({
      status: prediction.status,
      output: prediction.output,
      error: prediction.error
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. POST: Start Magic (Deduct Credit + Trigger AI)
export async function POST(request: Request) {
  // Initialize Admin Client (Bypasses RLS to manage credits securely)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, 
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const deviceId = request.headers.get('x-device-id');
  if (!deviceId) return NextResponse.json({ error: 'No Device ID' }, { status: 401 });

  try {
    // --- STEP 1: PARSE REQUEST (Don't deduct yet!) ---
    // FIX: We expect JSON now, not FormData
    const body = await request.json(); 
    const { sourceImage, targetVideo } = body;

    if (!sourceImage || !targetVideo) {
       return NextResponse.json({ error: 'Missing Data' }, { status: 400 });
    }

    // --- STEP 2: CHECK & DEDUCT CREDITS ---
    // We fetch the user first to see if they can pay
    const { data: user } = await supabaseAdmin
        .from('magic_users')
        .select('remaining_credits, christmas_pass, id')
        .eq('device_id', deviceId)
        .maybeSingle();

    if (!user || (user.remaining_credits < 1 && !user.christmas_pass)) {
       return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    // DEDUCT NOW (Optimistic)
    // We deduct before calling AI to prevent "Free Usage" exploits.
    // If AI fails immediately below, we will REFUND.
    if (!user.christmas_pass) {
        const { error: deductError } = await supabaseAdmin
            .from('magic_users')
            .update({ remaining_credits: user.remaining_credits - 1 })
            .eq('device_id', deviceId);

        if (deductError) throw new Error("Credit deduction failed");
    }

    // --- STEP 3: CALL REPLICATE ---
    try {
        const prediction = await replicate.predictions.create({
          version: "104b4a39315349db50880757bc8c1c996c5309e3aa11286b0a3c84dab81fd440", // xrunda/hello
          input: {
            source: sourceImage,
            target: targetVideo
          },
        });

        // SUCCESS! Return the ID so frontend can poll
        return NextResponse.json({ success: true, id: prediction.id });

    } catch (aiError: any) {
        // --- EMERGENCY REFUND ---
        // The AI failed to start. Give the credit back.
        console.error("AI Start Failed. Refunding user.", aiError);
        
        if (!user.christmas_pass) {
             await supabaseAdmin
                .from('magic_users')
                .update({ remaining_credits: user.remaining_credits }) // Restore original
                .eq('device_id', deviceId);
        }
        
        throw aiError; // Re-throw to hit the main error handler
    }

  } catch (error: any) {
    console.error('Swap Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}