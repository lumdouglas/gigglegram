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

    console.log('🎬 Starting Hollywood Face Swap (Realism Mode)...');
    
    // FETCH VERSION ID
    // @ts-ignore
    const model = await replicate.models.get("xrunda", "hello");
    // @ts-ignore
    const versionId = model.latest_version?.id;

    if (!versionId) {
        return NextResponse.json({ error: "Model version not found" }, { status: 500 });
    }

    // START PREDICTION (REALISM CONFIG)
    const prediction = await replicate.predictions.create({
      version: versionId,
      input: {
        // MAPPING: 'source' = Template Video, 'target' = Face Image
        source: targetVideo,   
        target: sourceImage,   
        
        // 🛑 TURN OFF THE BEAUTY FILTER
        // We disable all known enhancement flags to save the braces/glasses/freckles.
        enhance_face: false,   
        use_gfpgan: false,
        face_restore: false,
        
        // 🛑 KEEP FRAME RATE
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