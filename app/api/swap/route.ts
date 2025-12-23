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
    
    // 1. EXTRACT DATA (Including userId)
    const { sourceImage, targetVideo, userId } = body; 
    const headerDeviceId = request.headers.get('x-device-id');

    if (!sourceImage || !targetVideo) {
       return NextResponse.json({ error: 'Missing Data' }, { status: 400 });
    }

    // 2. HYBRID LOOKUP (Priority: UUID > Device ID)
    const lookupColumn = userId ? 'id' : 'device_id';
    const lookupValue = userId || headerDeviceId;

    // DEBUG: Uncomment to see who the server is looking for
    // console.log(`🔍 LOOKUP: ${lookupColumn} = ${lookupValue}`);

    const { data: user } = await supabaseAdmin
        .from('magic_users')
        .select('remaining_credits, christmas_pass, swap_count, id') 
        .eq(lookupColumn, lookupValue)
        .maybeSingle();

    // CHECK 1: PERMISSIONS (Do not charge yet)
    if (!user || (user.remaining_credits < 1 && !user.christmas_pass)) {
       return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    // 3. RUN AI (Synchronous - Wait for result)
    let output;
    try {
        output = await replicate.run(
          "xrunda/hello:104b4a39315349db50880757bc8c1c996c5309e3aa11286b0a3c84dab81fd440", 
          {
            input: {
              source: targetVideo, 
              target: sourceImage  
            }
          }
        );
    } catch (aiError: any) {
        console.error("AI Generation Failed:", aiError);
        const errString = aiError.toString().toLowerCase();

        // 🔴 SAD PATH: Catch "No Face" -> Return 400
        if (errString.includes("face") || errString.includes("detect") || errString.includes("found")) {
            return NextResponse.json({ error: "No face detected in photo." }, { status: 400 });
        }
        throw aiError; 
    }

    // 4. SUCCESS -> NOW WE CHARGE CREDIT 💸
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