import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { createClient } from '@supabase/supabase-js';

// CRITICAL: Force dynamic to prevent Vercel caching
export const dynamic = 'force-dynamic';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

// Initialize Supabase Admin for Guest Checks
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1. POST: STARTS the magic
export async function POST(request: NextRequest) {
  try {
    const { sourceImage, targetVideo } = await request.json();
    
    // SECURITY HEADERS
    const deviceId = request.headers.get('x-device-id') || 'unknown';
    const userCredits = parseInt(request.headers.get('x-user-credits') || '0');
    // Get IP (Handle Vercel/Proxy headers)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    console.log(`🎬 Request: Device=${deviceId}, IP=${ip}, Credits Claimed=${userCredits}`);

    // 🛡️ THE GRANDMA FILTER (SOFT LOCK)
    // Only check guest usage if they claim to have 0 credits.
    if (userCredits <= 0) {
        const { data: usage } = await supabaseAdmin
            .from('guest_usage')
            .select('*')
            .or(`device_id.eq.${deviceId},ip_address.eq.${ip}`)
            .maybeSingle();

        if (usage && usage.swaps_count >= 1) {
            console.warn(`⛔ Soft Lock Blocked: ${ip} / ${deviceId}`);
            return NextResponse.json({ error: "Free trial used! Log in or upgrade." }, { status: 402 });
        }

        // If clean, log this usage (Increment later or insert now)
        // We insert/update now to "reserve" the spot
        if (usage) {
             await supabaseAdmin.from('guest_usage')
                .update({ swaps_count: usage.swaps_count + 1, last_swap: new Date() })
                .eq('id', usage.id);
        } else {
             await supabaseAdmin.from('guest_usage').insert({
                 device_id: deviceId,
                 ip_address: ip,
                 swaps_count: 1
             });
        }
    }

    // ... (Proceed to Replicate) ...
    
    // FETCH VERSION ID
    // @ts-ignore
    const model = await replicate.models.get("xrunda", "hello");
    // @ts-ignore
    const versionId = model.latest_version?.id;

    if (!versionId) {
        return NextResponse.json({ error: "Model version not found" }, { status: 500 });
    }

    // START PREDICTION
    const prediction = await replicate.predictions.create({
      version: versionId,
      input: {
        source: targetVideo,   // Template
        target: sourceImage,   // Face
        enhance_face: false,   // Realism Config
        use_gfpgan: false,
        face_restore: false,
        keep_fps: true, 
        keep_frames: true 
      },
    });

    console.log('🚀 Job Started. ID:', prediction.id);

    return NextResponse.json({ 
      success: true, 
      id: prediction.id 
    });

  } catch (error: any) {
    console.error('❌ Start Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. GET: CHECKS the magic (No changes needed)
export async function GET(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    try {
        const prediction = await replicate.predictions.get(id);
        
        console.log(`📡 Polling ${id}: ${prediction.status}`);

        if (prediction.status === 'succeeded') {
            // @ts-ignore
            const output = prediction.output;
            const finalOutput = Array.isArray(output) ? output[0] : output;
            
            console.log('✅ Success! Output:', finalOutput);

            return NextResponse.json({ 
                status: 'succeeded', 
                output: finalOutput 
            });
        }
        
        if (prediction.status === 'failed' || prediction.status === 'canceled') {
            console.error('❌ Prediction Failed:', prediction.error);
            return NextResponse.json({ 
                status: 'failed', 
                error: prediction.error 
            });
        }

        return NextResponse.json({ status: prediction.status });

    } catch (error: any) {
        console.error('❌ Polling Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}