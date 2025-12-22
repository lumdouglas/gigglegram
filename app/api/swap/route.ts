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
    // NEW: Accept userId (Boss's Fix)
    const { sourceImage, targetVideo, userId } = body; 
    const headerDeviceId = request.headers.get('x-device-id');

    if (!sourceImage || !targetVideo) {
       return NextResponse.json({ error: 'Missing Data' }, { status: 400 });
    }

    // 1. CHECK PERMISSIONS (DO NOT CHARGE YET)
    // Hybrid Lookup: Prefer UUID, fallback to Device ID
    const lookupColumn = userId ? 'id' : 'device_id';
    const lookupValue = userId || headerDeviceId;

    const { data: user } = await supabaseAdmin
        .from('magic_users')
        .select('remaining_credits, christmas_pass, swap_count, id') 
        .eq(lookupColumn, lookupValue)
        .maybeSingle();

    if (!user || (user.remaining_credits < 1 && !user.christmas_pass)) {
       return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    // 2. RUN AI (AND WAIT FOR RESULT) 🛑
    let output;
    try {
        output = await replicate.run(
          "xrunda/hello:104b4a39315349db50880757bc8c1c996c5309e3aa11286b0a3c84dab81fd440", 
          {
            input: {
              source: targetVideo, // Video = Driver
              target: sourceImage  // Face = Subject
            }
          }
        );
    } catch (aiError: any) {
        console.error("AI Generation Failed:", aiError);
        const errString = aiError.toString().toLowerCase();

        // 🔴 SAFETY NET: If AI fails, we return error AND WE DO NOT CHARGE.
        if (errString.includes("face") || errString.includes("detect") || errString.includes("found")) {
            return NextResponse.json({ error: "No face detected in photo." }, { status: 400 });
        }
        throw aiError; 
    }

    // 3. SUCCESS! NOW WE CHARGE 💸
    const updates: any = {
        swap_count: (user.swap_count || 0) + 1 
    };

    if (!user.christmas_pass) {
        // Safe decrement using RPC (or direct update fallback)
        const { error: chargeError } = await supabaseAdmin.rpc('decrement_credit', { row_id: user.id });
        if (chargeError) {
             await supabaseAdmin
                .from('magic_users')
                .update({ remaining_credits: user.remaining_credits - 1, ...updates })
                .eq('id', user.id);
        }
    } else {
        await supabaseAdmin.from('magic_users').update(updates).eq('id', user.id);
    }

    // 4. RETURN RESULT
    return NextResponse.json({ success: true, output });

  } catch (error: any) {
    console.error('Swap Error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}