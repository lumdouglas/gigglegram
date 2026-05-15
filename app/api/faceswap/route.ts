import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { readFileSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const replicate = new Replicate({ auth: token });

  try {
    const formData = await request.formData();
    const userPhoto = formData.get('userPhoto') as File | null;
    const templateIndex = formData.get('templateIndex') as string | null;

    if (!userPhoto || !templateIndex) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Convert user photo to Blob (Replicate SDK v1 requires Blob/File, not data URIs)
    const userPhotoBuffer = Buffer.from(await userPhoto.arrayBuffer());
    const mimeType = userPhoto.type || 'image/jpeg';
    const targetBlob = new Blob([userPhotoBuffer], { type: mimeType });

    // Load template from public/templates/ as Blob
    const paddedIndex = templateIndex.padStart(2, '0');
    const templatePath = path.join(process.cwd(), 'public', 'templates', `template-${paddedIndex}.jpg`);
    const templateBuffer = readFileSync(templatePath);
    const swapBlob = new Blob([templateBuffer], { type: 'image/jpeg' });

    // cdingram/face-swap: swaps the face from source_image onto target_image.
    const output = await replicate.run(
      'cdingram/face-swap:d1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111',
      {
        input: {
          input_image: targetBlob,
          swap_image: swapBlob,
        },
      }
    );

    // Output is a URL string (or array of URLs for some model versions)
    const outputUrl = Array.isArray(output) ? output[0] : output;

    if (!outputUrl) {
      return NextResponse.json({ error: 'No output from model' }, { status: 500 });
    }

    return NextResponse.json({ output: String(outputUrl) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Faceswap error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
