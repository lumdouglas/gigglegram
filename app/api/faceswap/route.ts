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

    // Convert user photo to base64 data URI (never written to disk)
    const userPhotoBuffer = Buffer.from(await userPhoto.arrayBuffer());
    const mimeType = userPhoto.type || 'image/jpeg';
    const targetImageUri = `data:${mimeType};base64,${userPhotoBuffer.toString('base64')}`;

    // Load template from public/templates/
    const paddedIndex = templateIndex.padStart(2, '0');
    const templatePath = path.join(process.cwd(), 'public', 'templates', `template-${paddedIndex}.jpg`);
    const templateBuffer = readFileSync(templatePath);
    const swapImageUri = `data:image/jpeg;base64,${templateBuffer.toString('base64')}`;

    // lucataco/faceswap: target_image is the base (face gets replaced),
    // swap_image is the face source to paste in.
    // Pin a specific version by appending :VERSION_HASH to the model string.
    const output = await replicate.run('lucataco/faceswap', {
      input: {
        target_image: targetImageUri,
        swap_image: swapImageUri,
      },
    });

    // Output is a URL string (or array of URLs for some model versions)
    const outputUrl = Array.isArray(output) ? output[0] : output;

    if (!outputUrl) {
      return NextResponse.json({ error: 'No output from model' }, { status: 500 });
    }

    return NextResponse.json({ output: String(outputUrl) });
  } catch (error: unknown) {
    console.error('Faceswap error:', error);
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
