import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

// Template videos
const TEMPLATES = {
  baby_ceo: "https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/baby_ceo.mp4",
  disco_baby: "https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/disco_baby.mp4",
  snowball_sniper: "https://rmbpncyftoyhueanjjaq.supabase.co/storage/v1/object/public/template-videos/snowball_sniper.mp4",
};

export async function POST(request: NextRequest) {
  try {
    const { sourceImage, template = 'baby_ceo' } = await request.json();

    const targetVideo = TEMPLATES[template as keyof typeof TEMPLATES] || TEMPLATES.baby_ceo;

    console.log('🎬 Starting VIDEO face swap...');
    console.log('Source:', sourceImage);
    console.log('Target Video:', targetVideo);

    let prediction = await replicate.predictions.create({
      version: "278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34",
      input: {
        target_image: sourceImage,
        swap_image: targetVideo,
      },
    });

    console.log('⏳ Prediction started:', prediction.id);

    // Poll until complete (max 60 seconds for video processing)
    const startTime = Date.now();
    while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
      if (Date.now() - startTime > 60000) {
        return NextResponse.json({ 
          error: '⏰ Taking longer than expected. Try again!' 
        }, { status: 408 });
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      prediction = await replicate.predictions.get(prediction.id);
      console.log('Status:', prediction.status);
    }

    if (prediction.status === 'failed') {
      console.error('❌ Prediction failed:', prediction.error);
      return NextResponse.json({ 
        error: 'Face swap failed: ' + (prediction.error || 'Unknown error')
      }, { status: 500 });
    }

    console.log('✅ Video face swap complete!');
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