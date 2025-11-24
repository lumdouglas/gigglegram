import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function POST(request: NextRequest) {
  try {
    const { sourceImage } = await request.json();

    // Hardcoded test GIF (replace with your template later)
    const targetGif = "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif";

    console.log('🎬 Starting GIF face swap...');
    console.log('Source:', sourceImage);
    console.log('Target GIF:', targetGif);

    let prediction = await replicate.predictions.create({
      model: "zetyquickly-org/faceswap-a-gif",
      input: {
        source_image: sourceImage,
        target_gif: targetGif,
      },
    });

    console.log('⏳ Prediction started:', prediction.id);

    // Poll until complete (max 30 seconds for GIF processing)
    const startTime = Date.now();
    while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
      if (Date.now() - startTime > 30000) {
        return NextResponse.json({ 
          error: 'Still baking cookies! 🍪 Try again in a moment.' 
        }, { status: 408 });
      }
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      prediction = await replicate.predictions.get(prediction.id);
      console.log('Status:', prediction.status);
    }

    if (prediction.status === 'failed') {
      console.error('❌ Prediction failed:', prediction.error);
      return NextResponse.json({ 
        error: 'Face swap failed: ' + (prediction.error || 'Unknown error')
      }, { status: 500 });
    }

    console.log('✅ GIF face swap complete!');
    console.log('Output:', prediction.output);

    return NextResponse.json({ 
      success: true, 
      output: prediction.output 
    });
  } catch (error: any) {
    console.error('❌ API Error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}