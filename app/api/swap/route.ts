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

    if (!sourceImage || !targetVideo) {
       return NextResponse.json({ error: 'Missing Data' }, { status: 400 });
    }

    // 1. HYBRID LOOKUP
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

    // 🔴 2. THE ELF GUARD (Pre-Check)
    // We use BLIP to ask if there is a person/face. This prevents "Tree Photos" from stealing credits.
    try {
        const caption: any = await replicate.run(
            "salesforce/blip:2e1dddc8621f72155f24cf2e0adbde548458d3cab9f00c0139eea840d0ac4746",
            {
                input: {
                    image: sourceImage,
                    task: "visual_question_answering",
                    question: "Is there a human face, person, or baby in this photo? Answer yes or no."
                }
            }
        );

        const answer = (caption || "").toString().toLowerCase();
        console.log("🧝 ELF GUARD SAYS:", answer);

        // If the Guard says "no", we STOP here.
        if (answer.includes("no")) {
             return NextResponse.json({ error: "No face detected in photo." }, { status: 400 });
        }
    } catch (guardError) {
        console.warn("Elf Guard failed, skipping check...", guardError);
        // If Guard fails, we proceed (fail open) to avoid blocking valid users
    }

    // 3. RUN MAGIC (Synchronous)
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
        if (errString.includes("face") || errString.includes("detect")) {
            return NextResponse.json({ error: "No face detected in photo." }, { status: 400 });
        }
        throw aiError; 
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