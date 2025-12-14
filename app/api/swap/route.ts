import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { sourceImage, targetVideo } = await request.json();
    const deviceId = request.headers.get('x-device-id');

    console.log(`🕵️ API: Checking Device: ${deviceId}`);

    // 1. Check the NEW 'magic_users' table
    const { data: user } = await supabaseAdmin
        .from('magic_users')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle();

    let isAllowed = false;

    if (user) {
        // A. Christmas Pass
        if (user.christmas_pass) {
            isAllowed = true;
            console.log('✅ Access: Christmas Pass');
        } 
        // B. Has Credits
        else if (user.credits_remaining > 0) {
            isAllowed = true;
            // Deduct 1 credit
            await supabaseAdmin.from('magic_users')
                .update({ credits_remaining: user.credits_remaining - 1 })
                .eq('device_id', deviceId);
            console.log('✅ Access: Credit Used');
        } 
        // C. Free Trial
        else if (!user.free_swap_used) {
            isAllowed = true;
            // Mark free used
            await supabaseAdmin.from('magic_users')
                .update({ free_swap_used: true })
                .eq('device_id', deviceId);
            console.log('✅ Access: Free Gift Used');
        }
    } else {
        // Fallback if frontend created profile but backend can't find it yet (rare)
        // We create it on the fly to allow the free usage
        console.log('📝 Creating magic_user on backend...');
        await supabaseAdmin.from('magic_users').insert({ 
            device_id: deviceId, 
            free_swap_used: true,
            credits_remaining: 0 
        });
        isAllowed = true;
    }

    if (!isAllowed) {
        return NextResponse.json({ error: "Limit reached" }, { status: 402 });
    }

    // 2. EXECUTE AI
    // @ts-ignore
    const model = await replicate.models.get("xrunda", "hello");
    // @ts-ignore
    const versionId = model.latest_version?.id;

    // @ts-ignore
    const prediction = await replicate.predictions.create({
      version: versionId,
      input: {
        source: targetVideo,
        target: sourceImage,
        enhance_face: false, 
        keep_fps: true, 
        keep_frames: true 
      },
    });

    return NextResponse.json({ success: true, id: prediction.id });

  } catch (error: any) {
    console.error('❌ Swap Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    const prediction = await replicate.predictions.get(id);
    
    if (prediction.status === 'succeeded') {
        // @ts-ignore
        const output = prediction.output;
        const finalOutput = Array.isArray(output) ? output[0] : output;
        return NextResponse.json({ status: 'succeeded', output: finalOutput });
    }
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
        return NextResponse.json({ status: 'failed', error: prediction.error });
    }
    return NextResponse.json({ status: prediction.status });
}