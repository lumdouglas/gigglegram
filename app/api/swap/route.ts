import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import templates from '@/config/templates.json';

// Initialize Replicate with the NEW token
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export const dynamic = 'force-dynamic'; // Prevent Vercel caching

// GET: Check Status
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

// POST: Start the Magic
export async function POST(req: Request) {
  try {
    const { templateId, imageKey } = await req.json();

    // 1. Get Template Video URL
    const template = templates.find(t => t.id === templateId);
    if (!template) return NextResponse.json({ error: 'Invalid template' }, { status: 400 });

    // 2. Build Source Image URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const imageUrl = `${supabaseUrl}/storage/v1/object/public/uploads/${imageKey}`;

    console.log("🚀 Fetching latest version of xrunda/hello...");

    // 3. DYNAMIC VERSION FETCH (Fixes the 422 Error)
    const model = await replicate.models.get("xrunda", "hello");
    const latestVersionId = model.latest_version?.id;

    if (!latestVersionId) {
        throw new Error("Model xrunda/hello not found or has no public versions.");
    }

    console.log("🚀 Starting Swap with version:", latestVersionId);

    // 4. Call Replicate
    const prediction = await replicate.predictions.create({
      version: latestVersionId, 
      input: {
        target_video: template.videoUrl,
        swap_image: imageUrl
      }
    });

    return NextResponse.json({ predictionId: prediction.id }, { status: 201 });

  } catch (error: any) {
    console.error("❌ Replicate Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}