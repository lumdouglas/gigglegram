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

    // 🔴 3. RUN MAGIC (Sync Mode - No Elf Guard)
    let output;
    try {
        console.log("🚀 STARTING AI...");
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
        // 🔴 DETAILED ERROR LOGGING
        console.error("❌ AI CRASHED:", aiError);
        
        // Check specifically for Replicate "Download Failed" (Bucket Permission / URL issues)
        const errString = aiError.toString().toLowerCase();
        if (errString.includes("download") || errString.includes("file")) {
            console.error("⚠️ CHECK YOUR SUPABASE BUCKET PERMISSIONS!");
        }

        // CATCH-ALL: Prevent 500. Return 400 so UI shows Elf Modal.
        // We DO NOT charge the user here.
        return NextResponse.json({ error: "AI Processing Failed" }, { status: 400 });
    }

    // 4. SUCCESS -> CHARGE CREDIT
    // This code is ONLY reached if the AI did not crash.
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