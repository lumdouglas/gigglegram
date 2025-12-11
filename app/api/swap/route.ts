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
    
    // 1. AGGRESSIVE IP CAPTURE
    const deviceId = request.headers.get('x-device-id') || 'unknown';
    
    // Get IP from various headers to ensure we catch proxies/Vercel
    let ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown';
    
    // Normalize Localhost IP for testing
    if (ip === '::1') ip = '127.0.0.1';

    console.log(`🕵️ GRANDMA FILTER: Checking Device: ${deviceId} | IP: ${ip}`);

    let isAllowed = false;

    // A. Check Registered User (Credits/Pass)
    const { data: user } = await supabaseAdmin
        .from('users')
        .select('christmas_pass, credits_remaining')
        .eq('device_id', deviceId)
        .single();

    if (user) {
        if (user.christmas_pass) {
            isAllowed = true;
            console.log('✅ Access Granted: Christmas Pass');
        } else if (user.credits_remaining > 0) {
            isAllowed = true;
            await supabaseAdmin.from('users')
                .update({ credits_remaining: user.credits_remaining - 1 })
                .eq('device_id', deviceId);
            console.log('✅ Access Granted: Credit Used');
        }
    }

    // B. Check Guest/Free Tier (The Anti-Exploit)
    if (!isAllowed) {
        // Query looking for EITHER device_id match OR ip_address match
        // Note: This relies on the 'guest_usage' table existing
        const { data: usage } = await supabaseAdmin
            .from('guest_usage')
            .select('*')
            .or(`device_id.eq.${deviceId},ip_address.eq.${ip}`) 
            .maybeSingle();

        if (usage) {
            console.warn(`⛔ BLOCKED: Usage found for Device ${deviceId} or IP ${ip}`);
            // If they are blocked, returning 402 triggers the Paywall Modal on Frontend
            return NextResponse.json({ error: "Free trial used! Upgrade to continue." }, { status: 402 });
        }

        // If we get here, they are truly new. Log them.
        console.log(`📝 Logging new guest: ${deviceId} @ ${ip}`);
        await supabaseAdmin.from('guest_usage').insert({ 
            device_id: deviceId, 
            ip_address: ip, 
            swaps_count: 1 
        });
        
        isAllowed = true;
    }

    // 3. EXECUTE AI
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