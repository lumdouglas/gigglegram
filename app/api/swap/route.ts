import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { createClient } from '@supabase/supabase-js';

// FORCE DYNAMIC (Prevent caching of API responses)
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

  const deviceId = request.headers.get('x-device-id');
  
  try {
    const body = await request.json(); 
    const { sourceImage, targetVideo } = body;

    if (!sourceImage || !targetVideo) {
       return NextResponse.json({ error: 'Missing Data' }, { status: 400 });
    }

    // 1. CHECK PERMISSIONS (DO NOT Charge Yet)
    const { data: user } = await supabaseAdmin
        .from('magic_users')
        .select('remaining_credits, christmas_pass, swap_count, id') 
        .eq('device_id', deviceId)
        .maybeSingle();

    if (!user || (user.remaining_credits < 1 && !user.christmas_pass)) {
       return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    // 2. RUN AI (AND WAIT FOR RESULT)
    // Using xrunda/hello for strict face swap
    let output;
    try {
        output = await replicate.run(
          "xrunda/hello:104b4a39315349db50880757bc8c1c996c5309e3aa11286b0a3c84dab81fd440", 
          {
            input: {
              source: targetVideo, // Template Video
              target: sourceImage  // User Face
            }
          }
        );
    } catch (aiError: any) {
        console.error("AI Generation Failed:", aiError);
        const errString = aiError.toString().toLowerCase();

        // 🔴 CATCH "NO FACE" ERROR
        // Triggers the "Elf Modal" on the frontend
        if (errString.includes("face") || errString.includes("detect") || errString.includes("found")) {
            return NextResponse.json({ error: "No face detected in photo." }, { status: 400 });
        }
        throw aiError; // Throw other errors to the general catch
    }

    // 3. SUCCESS! NOW WE CHARGE THE CREDIT
    // If we reached here, the video is ready.
    
    const updates: any = {
        swap_count: (user.swap_count || 0) + 1 
    };

    // Only deduct if NOT a VIP
    if (!user.christmas_pass) {
        // Use RPC if available, or standard update
        const { error: chargeError } = await supabaseAdmin.rpc('decrement_credit', { row_id: user.id });
        
        // Fallback for safety if RPC fails or doesn't exist:
        if (chargeError) {
             console.warn("RPC failed, using direct update");
             await supabaseAdmin
                .from('magic_users')
                .update({ remaining_credits: user.remaining_credits - 1, ...updates })
                .eq('id', user.id);
        }
    } else {
        // VIP: Just update history
        await supabaseAdmin.from('magic_users').update(updates).eq('id', user.id);
    }

    // 4. RETURN RESULT
    return NextResponse.json({ success: true, output });

  } catch (error: any) {
    console.error('Swap Error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}