import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

// CRITICAL: Force dynamic to prevent Vercel caching
export const dynamic = 'force-dynamic';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

// 1. POST: STARTS the magic
export async function POST(request: NextRequest) {
  try {
    const { sourceImage, targetVideo } = await request.json();

    console.log('🎬 Starting Hollywood Face Swap (Async)...');
    
    // FETCH VERSION ID (Dynamic - No Hardcoding)
    console.log("🔍 Fetching latest version of xrunda/hello...");
    // @ts-ignore
    const model = await replicate.models.get("xrunda", "hello");
    // @ts-ignore
    const versionId = model.latest_version?.id;

    if (!versionId) {
        return NextResponse.json({ error: "Model version not found" }, { status: 500 });
    }
    console.log("✅ Version Found:", versionId);

    // START PREDICTION
    // Schema: source=video, target=face
    const prediction = await replicate.predictions.create({
      version: versionId,
      input: {
        source: targetVideo,   // Template Video
        target: sourceImage,   // User Face
        enhance_face: false,   // Realism Config (No Beauty Filter)
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

// 2. GET: CHECKS the magic
export async function GET(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    try {
        const prediction = await replicate.predictions.get(id);
        
        // Log status for Vercel monitoring
        console.log(`📡 Polling ${id}: ${prediction.status}`);

        if (prediction.status === 'succeeded') {
            // @ts-ignore
            const output = prediction.output;
            const finalOutput = Array.isArray(output) ? output[0] : output;
            
            return NextResponse.json({ 
                status: 'succeeded', 
                output: finalOutput 
            });
        }
        
        if (prediction.status === 'failed' || prediction.status === 'canceled') {
            return NextResponse.json({ 
                status: 'failed', 
                error: prediction.error 
            });
        }

        return NextResponse.json({ status: prediction.status });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}