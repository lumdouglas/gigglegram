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

    // 1. CHECK CREDITS / PERMISSIONS (Database Gatekeeper)
    const { data: user } = await supabaseAdmin
        .from('magic_users')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle();

    let isAllowed = false;

    if (user) {
        if (user.christmas_pass) {
            isAllowed = true;
        } else if (user.credits_remaining > 0) {
            isAllowed = true;
            await supabaseAdmin.from('magic_users').update({ credits_remaining: user.credits_remaining - 1 }).eq('device_id', deviceId);
        } else if (!user.free_swap_used) {
            isAllowed = true;
            await supabaseAdmin.from('magic_users').update({ free_swap_used: true }).eq('device_id', deviceId);
        }
    } else {
        // Fallback for brand new users
        await supabaseAdmin.from('magic_users').insert({ device_id: deviceId, free_swap_used: true, credits_remaining: 0 });
        isAllowed = true;
    }

    if (!isAllowed) {
        return NextResponse.json({ error: "Limit reached" }, { status: 402 });
    }

    // 2. EXECUTE AI (Clean Schema)
    // Schema: xrunda/hello
    // source: The template video (The body)
    // target: The user's face (The face)
    
    const prediction = await replicate.predictions.create({
      version: "104b4a39315349db50880757bc8c1c996c5309e3aa11286b0a3c84dab81fd440", // Locked to specific version
      input: {
        source: targetVideo,  // The Christmas Template
        target: sourceImage   // The User's Face
        // Removed: enhance_face, keep_fps, keep_frames (per instructions)
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
        const output = prediction.output;
        // Handle output format (sometimes array, sometimes string)
        const finalOutput = Array.isArray(output) ? output[0] : output;
        return NextResponse.json({ status: 'succeeded', output: finalOutput });
    }
    
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
        return NextResponse.json({ status: 'failed', error: prediction.error });
    }
    
    return NextResponse.json({ status: prediction.status });
}
