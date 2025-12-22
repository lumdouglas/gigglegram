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
    // Expecting keys matching your frontend
    const { sourceImage, targetVideo } = body; 
    
    // NOTE: We use deviceId here because your frontend sends it in headers
    const deviceId = request.headers.get('x-device-id'); 

    if (!sourceImage || !targetVideo) {
       return NextResponse.json({ error: 'Missing Data' }, { status: 400 });
    }

    // 1. CHECK PERMISSIONS (Do NOT Charge Yet)
    const { data: user } = await supabaseAdmin
        .from('magic_users')
        .select('remaining_credits, christmas_pass, swap_count, id') 
        .eq('device_id', deviceId)
        .maybeSingle();

    if (!user || (user.remaining_credits < 1 && !user.christmas_pass)) {
       return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    // 2. RUN AI (Wait for result)
    let output;
    try {
        // Model: xrunda/hello
        output = await replicate.run(
          "xrunda/hello:104b4a39315349db50880757bc8c1c996c5309e3aa11286b0a3c84dab81fd440", 
          {
            input: {
              source: targetVideo, // Video = Source
              target: sourceImage  // Face = Target
            }
          }
        );
    } catch (aiError: any) {
        console.error("AI Failed:", aiError);
        const errString = aiError.toString().toLowerCase();
        
        // 🔴 DETECT NO FACE -> RETURN 400 -> FRONTEND SHOWS ELF MODAL
        if (errString.includes("face") || errString.includes("detect") || errString.includes("found")) {
             return NextResponse.json({ error: "No face detected" }, { status: 400 });
        }
        throw aiError;
    }

    // 3. SUCCESS -> NOW WE CHARGE
    const updates: any = {
        swap_count: (user.swap_count || 0) + 1 
    };

    if (!user.christmas_pass) {
        // Safe decrement
        await supabaseAdmin.rpc('decrement_credit', { row_id: user.id });
    } else {
        await supabaseAdmin.from('magic_users').update(updates).eq('id', user.id);
    }

    return NextResponse.json({ success: true, output });

  } catch (error: any) {
    console.error('Swap Error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}