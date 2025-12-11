import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

// Admin Client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { sourceImage, targetVideo } = await request.json();
    
    // 1. IDENTIFY THE USER
    const deviceId = request.headers.get('x-device-id') || 'unknown';
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    console.log(`🎬 Swap Request: ${deviceId} (IP: ${ip})`);

    // 2. SERVER-SIDE VALIDATION (The Bankruptcy Defense)
    // We do NOT trust the x-user-credits header. We check the DB.
    let isAllowed = false;

    // A. Check Registered User Status
    const { data: user } = await supabaseAdmin
        .from('users')
        .select('christmas_pass, credits_remaining')
        .eq('device_id', deviceId)
        .single();

    if (user) {
        if (user.christmas_pass) {
            isAllowed = true;
            console.log('✅ Access Granted: Christmas Pass Holder');
        } else if (user.credits_remaining > 0) {
            isAllowed = true;
            // Decrement credit immediately
            await supabaseAdmin.from('users')
                .update({ credits_remaining: user.credits_remaining - 1 })
                .eq('device_id', deviceId);
            console.log('✅ Access Granted: Credit Used');
        }
    }

    // B. Check Guest/Free Tier (If not paid)
    if (!isAllowed) {
        // Check Guest Ledger
        const { data: usage } = await supabaseAdmin
            .from('guest_usage')
            .select('*')
            .or(`device_id.eq.${deviceId},ip_address.eq.${ip}`)
            .maybeSingle();

        if (usage && usage.swaps_count >= 1) {
            console.warn(`⛔ Blocked: Free limit reached for ${deviceId}`);
            return NextResponse.json({ error: "Free trial used! Upgrade to continue." }, { status: 402 });
        }

        // Log usage
        if (usage) {
             await supabaseAdmin.from('guest_usage').update({ swaps_count: usage.swaps_count + 1 }).eq('id', usage.id);
        } else {
             await supabaseAdmin.from('guest_usage').insert({ device_id: deviceId, ip_address: ip, swaps_count: 1 });
        }
        isAllowed = true;
    }

    // 3. EXECUTE AI (Only if Allowed)
    // @ts-ignore
    const model = await replicate.models.get("xrunda", "hello");
    // @ts-ignore
    const versionId = model.latest_version?.id;

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

// GET Polling remains the same...
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