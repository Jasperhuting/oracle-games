import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerFirebase } from '@/lib/firebase/server';
import { createHash } from 'crypto';

const MAX_GENERATIONS_PER_EMAIL = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if API key is available
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set in environment variables');
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    // Rate limiting check
    const db = getServerFirebase();
    const emailHash = createHash('sha256').update(email.toLowerCase()).digest('hex');
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const ipHash = createHash('sha256').update(ipAddress).digest('hex');

    // Check email-based limit
    const emailLimitDoc = await db.collection('playerNameGenerations').doc(emailHash).get();
    const emailData = emailLimitDoc.data();
    
    if (emailData) {
      const now = Date.now();
      const timeSinceFirst = now - emailData.firstGeneratedAt;
      
      // Reset counter if window has passed
      if (timeSinceFirst > RATE_LIMIT_WINDOW_MS) {
        await db.collection('playerNameGenerations').doc(emailHash).set({
          count: 1,
          firstGeneratedAt: now,
          lastGeneratedAt: now,
        });
      } else if (emailData.count >= MAX_GENERATIONS_PER_EMAIL) {
        const timeRemaining = Math.ceil((RATE_LIMIT_WINDOW_MS - timeSinceFirst) / 60000);
        return NextResponse.json(
          { error: `Je hebt het maximum aantal generaties bereikt. Probeer het over ${timeRemaining} minuten opnieuw.` },
          { status: 429 }
        );
      } else {
        await db.collection('playerNameGenerations').doc(emailHash).update({
          count: emailData.count + 1,
          lastGeneratedAt: now,
        });
      }
    } else {
      await db.collection('playerNameGenerations').doc(emailHash).set({
        count: 1,
        firstGeneratedAt: Date.now(),
        lastGeneratedAt: Date.now(),
      });
    }

    // Check IP-based limit (additional protection)
    const ipLimitDoc = await db.collection('ipRateLimits').doc(ipHash).get();
    const ipData = ipLimitDoc.data();
    
    if (ipData) {
      const now = Date.now();
      const timeSinceFirst = now - ipData.firstRequestAt;
      
      if (timeSinceFirst < RATE_LIMIT_WINDOW_MS && ipData.count >= 10) {
        return NextResponse.json(
          { error: 'Te veel verzoeken. Probeer het later opnieuw.' },
          { status: 429 }
        );
      } else if (timeSinceFirst > RATE_LIMIT_WINDOW_MS) {
        await db.collection('ipRateLimits').doc(ipHash).set({
          count: 1,
          firstRequestAt: now,
        });
      } else {
        await db.collection('ipRateLimits').doc(ipHash).update({
          count: ipData.count + 1,
        });
      }
    } else {
      await db.collection('ipRateLimits').doc(ipHash).set({
        count: 1,
        firstRequestAt: Date.now(),
      });
    }

    const client = new OpenAI({ 
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY 
    });

    const stream = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: `Please make up a nice and funny player name with cycling humor and predicting humor in dutch and use this email address for inspiration: ${email}. Be creative and return only the player name, nothing else. be carefull when you use something from the email you don't misspelled it. The name should not be too long.`
        }
      ],
      max_tokens: 50,
      stream: true,
    });

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Error generating player name:', error);
    return NextResponse.json(
      { error: 'Failed to generate player name', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
