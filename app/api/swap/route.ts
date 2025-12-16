import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Replicate from 'replicate';

// 1. GET: Check Status
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const predictionId = searchParams.get('id');

  if (!predictionId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  // Initialize Replicate INSIDE the function to prevent startup crashes
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
  console.log("🟢 API HIT: /api/swap started"); // This proves the file exists!

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.error("❌ FATAL: REPLICATE_API_TOKEN is missing in .env.local");
    return NextResponse.json({ error: 'Server Config Error: Missing AI Key' }, { status: 500 });
  }

  const replicate = new Replicate({ auth: token });

  // Initialize Admin Client
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, 
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const deviceId = request.headers.get('x-device-id');
  
  try {
    const body = await request.json(); 
    const { sourceImage, targetVideo } = body;

    console.log("📸 Received Request:", { deviceId, hasImage: !!sourceImage, hasVideo: !!targetVideo });

    if (!sourceImage || !targetVideo) {
       return NextResponse.json({ error: 'Missing Data' }, { status: 400 });
    }

    // --- CHECK CREDITS ---
    const { data: user } = await supabaseAdmin
        .from('magic_users')
        .select('remaining_credits, christmas_pass')
        .eq('device_id', deviceId)
        .maybeSingle();

    if (!user || (user.remaining_credits < 1 && !user.christmas_pass)) {
       console.log("⛔ PAYWALL BLOCKED:", deviceId);
       return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    // --- DEDUCT CREDIT ---
    if (!user.christmas_pass) {
        await supabaseAdmin
            .from('magic_users')
            .update({ remaining_credits: user.remaining_credits - 1 })
            .eq('device_id', deviceId);
    }

    // --- CALL REPLICATE ---
    const prediction = await replicate.predictions.create({
      version: "104b4a39315349db50880757bc8c1c996c5309e3aa11286b0a3c84dab81fd440",
      input: { source: sourceImage, target: targetVideo },
    });

    console.log("🚀 AI STARTED:", prediction.id);
    return NextResponse.json({ success: true, id: prediction.id });

  } catch (error: any) {
    console.error('🔥 CRITICAL ERROR:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}