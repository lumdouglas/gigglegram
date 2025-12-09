import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import templates from '@/config/templates.json';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// GET: Check Status of a Prediction (Polling Endpoint)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  const prediction = await replicate.predictions.get(id);
  return NextResponse.json({ 
    status: prediction.status, 
    output: prediction.output 
  });
}

// POST: Start a New Prediction (Trigger Endpoint)
export async function POST(req: Request) {
  try {
    const { templateId, imageKey } = await req.json();

    // 1. Find the Target Video URL from our Config
    const template = templates.find(t => t.id === templateId);
    if (!template) return NextResponse.json({ error: 'Invalid template' }, { status: 400 });

    // 2. Construct the Source Image URL
    // This assumes your Supabase bucket is named 'uploads' and is set to Public
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const imageUrl = `${supabaseUrl}/storage/v1/object/public/uploads/${imageKey}`;

    // 3. Call Replicate (Model: xrunda/hello)
    const prediction = await replicate.predictions.create({
      // We use this specific version hash for consistency
      version: "5f23854124016a5d4002633010378051287c800880096924b11f375084992524", 
      input: {
        swap_image: imageUrl,
        target_video: template.videoUrl 
      }
    });

    return NextResponse.json({ predictionId: prediction.id }, { status: 201 });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}