import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

// 1. POST: STARTS the magic (Returns ID immediately)
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
    // We use standard keys 'source_image' and 'driving_video' which are safest for this model type
    const prediction = await replicate.predictions.create({
      version: versionId,
      input: {
        source_image: sourceImage,  // The Face
        driving_video: targetVideo, // The Template
      },
    });

    console.log('🚀 Job Started. ID:', prediction.id);

    // Return the ID immediately so Vercel doesn't timeout
    return NextResponse.json({ 
      success: true, 
      id: prediction.id 
    });

  } catch (error: any) {
    console.error('❌ Start Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. GET: CHECKS the magic (Called repeatedly)
export async function GET(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    try {
        const prediction = await replicate.predictions.get(id);
        
        // If finished, parse output
        if (prediction.status === 'succeeded') {
            const finalOutput = Array.isArray(prediction.output) 
                ? prediction.output[0] 
                : prediction.output;
            
            return NextResponse.json({ 
                status: 'succeeded', 
                output: finalOutput 
            });
        }
        
        // If failed
        if (prediction.status === 'failed' || prediction.status === 'canceled') {
            return NextResponse.json({ 
                status: 'failed', 
                error: prediction.error 
            });
        }

        // If still processing (starting, processing)
        return NextResponse.json({ status: prediction.status });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}