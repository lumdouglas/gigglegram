import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Replicate from 'replicate';

// 1. GET: Check Status
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const predictionId = searchParams.get('id');

  if (!predictionId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.error("❌ FATAL: REPLICATE_API_TOKEN is missing in .env.local");
    return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });
  }

  const replicate = new Replicate({ auth: token });

  try {
    const prediction = await replicate.predictions.get(predictionId);
    return NextResponse.json({
      status: prediction.status,
      output: prediction.output,
      error: prediction.error
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. POST: Start Magic
export async function POST(request: Request) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });

  const replicate = new Replicate({ auth: token });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, 
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const deviceId = request.headers.get('x-device-id');
  
  try {
    const body = await request.json(); 
    const { sourceImage, targetVideo } = body;

    if (!sourceImage || !targetVideo) {
       return NextResponse.json({ error: 'Missing Data' }, { status: 400 });
    }

    // --- CHECK CREDITS & HISTORY ---
    const { data: user } = await supabaseAdmin
        .from('magic_users')
        // CRITICAL FIX: We must SELECT 'swap_count' to increment it
        .select('remaining_credits, christmas_pass, swap_count') 
        .eq('device_id', deviceId)
        .maybeSingle();

    if (!user || (user.remaining_credits < 1 && !user.christmas_pass)) {
       return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    // --- PREPARE UPDATES (The "Transaction") ---
    const updates: any = {
        // FIX: Always increment swap_count (Analytics + Paywall Trigger)
        swap_count: (user.swap_count || 0) + 1 
    };

    // Only deduct credit if they are NOT a VIP
    if (!user.christmas_pass) {
        updates.remaining_credits = user.remaining_credits - 1;
    }

    // --- EXECUTE DB UPDATE ---
    const { error: updateError } = await supabaseAdmin
        .from('magic_users')
        .update(updates)
        .eq('device_id', deviceId);

    if (updateError) {
        console.error("DB Update Failed:", updateError);
        return NextResponse.json({ error: 'Transaction Failed' }, { status: 500 });
    }

    // --- CALL REPLICATE ---
    const prediction = await replicate.predictions.create({
      version: "104b4a39315349db50880757bc8c1c996c5309e3aa11286b0a3c84dab81fd440",
      input: {
        source: targetVideo, 
        target: sourceImage  
      },
    });

    return NextResponse.json({ success: true, id: prediction.id });

  } catch (error: any) {
    console.error('Swap Error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}