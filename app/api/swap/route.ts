import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function POST(request: NextRequest) {
  try {
    // 1. Parse Input
    const { sourceImage, targetVideo } = await request.json();

    console.log('🎬 Starting Hollywood Face Swap (xrunda/hello)...');
    console.log('Source:', sourceImage);
    console.log('Target Video:', targetVideo);

    // 2. FETCH VERSION ID (The Fix)
    // We must look up the specific version hash for 'xrunda/hello' to avoid the 404 error.
    const model = await replicate.models.get("xrunda", "hello");
    const versionId = model.latest_version?.id;

    if (!versionId) {
        return NextResponse.json({ 
            error: "Could not find the model version! Is the AI sleeping?" 
        }, { status: 500 });
    }

    console.log('🔑 Found Version ID:', versionId);

    // 3. Kick off Prediction using the Version ID
    const prediction = await replicate.predictions.create({
      version: versionId, // Using the specific hash we just found
      input: {
        source_image: sourceImage,
        target_video: targetVideo,
      },
    });

    console.log('⏳ Prediction started:', prediction.id);

    // 4. Poll for Completion (Handling the ~40s wait)
    const startTime = Date.now();
    let currentPrediction = prediction;

    while (currentPrediction.status !== 'succeeded' && currentPrediction.status !== 'failed') {
      // Timeout Safety: 55 seconds
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

    // 5. Data Parsing (Handling array output)
    console.log('✅ Hollywood Swap Complete!');
    
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