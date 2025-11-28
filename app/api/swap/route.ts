import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function POST(request: NextRequest) {
  try {
    // 1. Parse Input
    // 'sourceImage' comes from the frontend (the user's uploaded photo)
    // 'targetVideo' comes from the frontend (the selected template URL)
    const { sourceImage, targetVideo } = await request.json();

    console.log('🎬 Starting Hollywood Face Swap (xrunda/hello)...');
    console.log('Source:', sourceImage);
    console.log('Target Video:', targetVideo);

    // 2. Kick off Prediction (xrunda/hello)
    const prediction = await replicate.predictions.create({
      model: "xrunda/hello", 
      input: {
        source_image: sourceImage,
        target_video: targetVideo,
      },
    });

    console.log('⏳ Prediction started:', prediction.id);

    // 3. Poll for Completion (Handling the ~40s wait)
    const startTime = Date.now();
    let currentPrediction = prediction;

    while (currentPrediction.status !== 'succeeded' && currentPrediction.status !== 'failed') {
      // Timeout Safety: 55 seconds (to avoid Vercel timeout)
      if (Date.now() - startTime > 55000) {
        return NextResponse.json({ 
          error: 'The elves are slow today! Please try again. 🍪' 
        }, { status: 408 });
      }
      
      // Wait 2 seconds between checks
      await new Promise(resolve => setTimeout(resolve, 2000));
      currentPrediction = await replicate.predictions.get(prediction.id);
      console.log('Status:', currentPrediction.status);
    }

    if (currentPrediction.status === 'failed') {
      console.error('❌ Prediction failed:', currentPrediction.error);
      return NextResponse.json({ 
        error: 'Face swap failed: ' + (currentPrediction.error || 'Unknown error')
      }, { status: 500 });
    }

    // 4. CRITICAL FIX: Data Parsing (Handling array output)
    console.log('✅ Hollywood Swap Complete!');
    
    // Many Replicate models return an array of URLs. We must ensure we grab the first (and usually only) URL.
    const finalOutput = Array.isArray(currentPrediction.output) 
      ? currentPrediction.output[0] 
      : currentPrediction.output;

    if (!finalOutput) {
        return NextResponse.json({ 
            error: "The magic finished, but the video disappeared! Try again."
        }, { status: 500 });
    }

    console.log('Output URL:', finalOutput);

    return NextResponse.json({ 
      success: true, 
      output: finalOutput 
    });

  } catch (error: any) {
    console.error('❌ API Error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}