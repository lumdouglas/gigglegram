import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

// CRITICAL FIX: Prevent Vercel from caching the polling responses.
// Without this, the frontend keeps getting "processing" even when the job is done.
export const dynamic = 'force-dynamic';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

// 1. POST: STARTS the magic
export async function POST(request: NextRequest) {
  try {
    const { sourceImage, targetVideo } = await request.json();

    console.log('🎬 Starting Hollywood Face Swap (Async)...');
    
    // FETCH VERSION ID
    const model = await replicate.models.get("xrunda", "hello");
    const versionId = model.latest_version?.id;

    if (!versionId) {
        return NextResponse.json({ error: "Model version not found" }, { status: 500 });
    }

    // START PREDICTION
    // xrunda/hello keys: 'source_image' (Face), 'driving_video' (Template)
    const prediction = await replicate.predictions.create({
      version: versionId,
      input: {
        source_image: sourceImage,  
        driving_video: targetVideo, 
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

// 2. GET: CHECKS the magic (Polling)
export async function GET(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    try {
        const prediction = await replicate.predictions.get(id);
        
        console.log(`📡 Polling ${id}: ${prediction.status}`); // Visible in Vercel Logs

        // If finished, parse output
        if (prediction.status === 'succeeded') {
            const finalOutput = Array.isArray(prediction.output) 
                ? prediction.output[0] 
                : prediction.output;
            
            console.log('✅ Success! Output:', finalOutput);

            return NextResponse.json({ 
                status: 'succeeded', 
                output: finalOutput 
            });
        }
        
        // If failed
        if (prediction.status === 'failed' || prediction.status === 'canceled') {
            console.error('❌ Prediction Failed:', prediction.error);
            return NextResponse.json({ 
                status: 'failed', 
                error: prediction.error 
            });
        }

        // If still processing
        return NextResponse.json({ status: prediction.status });

    } catch (error: any) {
        console.error('❌ Polling Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}