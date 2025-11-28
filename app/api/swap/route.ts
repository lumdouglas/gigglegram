import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function POST(request: NextRequest) {
  try {
    // 1. Parse Input
    // sourceImage = Nana's Photo (Face)
    // targetVideo = The Template (Body)
    const { sourceImage, targetVideo } = await request.json();

    console.log('🎬 Starting Hollywood Face Swap (xrunda/hello)...');
    console.log('Face (target):', sourceImage);
    console.log('Video (source):', targetVideo);

    // 2. FETCH VERSION ID
    const model = await replicate.models.get("xrunda", "hello");
    const versionId = model.latest_version?.id;

    if (!versionId) {
        return NextResponse.json({ 
            error: "Could not find the model version! Is the AI sleeping?" 
        }, { status: 500 });
    }

    // 3. Kick off Prediction (CORRECTED SCHEMA)
    // Model Docs: 'source' is the video, 'target' is the face image.
    const prediction = await replicate.predictions.create({
      version: versionId,
      input: {
        source: targetVideo,  // The Body (Video)
        target: sourceImage,  // The Face (Image)
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

    // 5. Data Parsing
    console.log('✅ Hollywood Swap Complete!');
    
    // Check for output
    const finalOutput = Array.isArray(currentPrediction.output) 
      ? currentPrediction.output[0] 
      : currentPrediction.output;

    if (!finalOutput) {
        console.error("Empty Output from Replicate:", currentPrediction);
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