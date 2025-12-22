import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { createClient } from '@supabase/supabase-js';

// FORCE DYNAMIC (Prevent caching of API responses)
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return NextResponse.json({ error: 'Server Config Error' }, { status: 500 });

  const replicate = new Replicate({ auth: token });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, 
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const body = await request.json(); 
    // EXPECTING: userId (UUID), sourceImage (Face), targetVideo (Template)
    const { userId, sourceImage, targetVideo } = body; 

    if (!userId || !sourceImage || !targetVideo) {
       return NextResponse.json({ error: 'Missing Data' }, { status: 400 });
    }

    // 1. CHECK PERMISSIONS
    const { data: user, error: dbError } = await supabaseAdmin
        .from('magic_users')
        .select('remaining_credits, christmas_pass, swap_count, id') 
        .eq('id', userId) 
        .maybeSingle();

    if (dbError || !user) {
        return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    if (user.remaining_credits < 1 && !user.christmas_pass) {
       return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    // 2. RUN AI (Wait for result to ensure success before charging)
    const output = await replicate.run(
      "xrunda/hello:104b4a39315349db50880757bc8c1c996c5309e3aa11286b0a3c84dab81fd440", 
      {
        input: {
          source: targetVideo, // CORRECT: The Video drives the animation
          target: sourceImage  // CORRECT: The Face is the subject
        }
      }
    );

    // 3. CHARGE CREDIT (Only if AI succeeded)
    const updates: any = {
        swap_count: (user.swap_count || 0) + 1 
    };

    if (!user.christmas_pass) {
        const { error: chargeError } = await supabaseAdmin.rpc('decrement_credit', { row_id: user.id });
        if (chargeError) {
             // Fallback
             await supabaseAdmin
                .from('magic_users')
                .update({ remaining_credits: user.remaining_credits - 1, ...updates })
                .eq('id', user.id);
        }
    } else {
        await supabaseAdmin.from('magic_users').update(updates).eq('id', user.id);
    }

    return NextResponse.json({ success: true, output });

  } catch (error: any) {
    console.error('Swap Error:', error);
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}