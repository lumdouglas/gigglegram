import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Replicate from 'replicate';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });

  const replicate = new Replicate({ auth: token });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, 
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const body = await request.json(); 
    const { sourceImage, targetVideo, userId } = body; 
    const headerDeviceId = request.headers.get('x-device-id');

    // 1. INPUT CHECK
    if (!sourceImage || !targetVideo) {
       return NextResponse.json({ error: 'Missing Data' }, { status: 400 });
    }

    // 2. HYBRID LOOKUP
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

    // 🔴 3. RUN MAGIC (Synchronous)
    let output;
    try {
        console.log("🚀 STARTING AI WITH:", sourceImage); 
        
        output = await replicate.run(
          "xrunda/hello:104b4a39315349db50880757bc8c1c996c5309e3aa11286b0a3c84dab81fd440", 
          {
            input: {
              source: targetVideo, 
              target: sourceImage  
            }
          }
        );
        console.log("✅ AI SUCCESS");

    } catch (aiError: any) {
        // 🔴 INTELLIGENT ERROR SORTING
        const errString = (aiError.message || aiError.toString()).toLowerCase();
        console.error("❌ AI CRASHED:", errString);

        // CASE A: ACCESS ERROR (System Issue)
        // If Replicate cannot download the file, it's a Bucket Permission issue.
        if (errString.includes("download") || errString.includes("status code") || errString.includes("403") || errString.includes("404")) {
            console.error("🚨 CRITICAL: Replicate cannot download the image. Check Supabase Bucket Public Settings!");
            return NextResponse.json({ error: "System Error: Cannot access photo." }, { status: 500 });
        }

        // CASE B: FACE/PROCESSING ERROR (User Issue)
        // If it's not a download error, it's likely the model failing on the pixels (No Face).
        // We catch this and show the Elf Modal.
        return NextResponse.json({ error: "No face detected in photo." }, { status: 400 });
    }

    // 4. SUCCESS -> CHARGE CREDIT
    const updates: any = {
        swap_count: (user.swap_count || 0) + 1 
    };

    if (!user.christmas_pass) {
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

    return NextResponse.json({ success: true, output });

  } catch (error: any) {
    console.error('Swap Error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}