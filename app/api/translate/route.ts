import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text, targetLanguage, sourceLanguage = 'en' } = await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: 'Text and target language are required' },
        { status: 400 }
      );
    }

    if (!openai.apiKey) {
      console.error('OpenAI API key is not configured');
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    // Map language codes to full language names for better translation
    const languageNames: Record<string, string> = {
      en: 'English',
      nl: 'Dutch (Netherlands)',
      fr: 'French',
      de: 'German',
      es: 'Spanish',
      it: 'Italian',
      pt: 'Portuguese',
      pl: 'Polish',
      ru: 'Russian',
      ja: 'Japanese',
      zh: 'Chinese',
    };

    const sourceLangName = languageNames[sourceLanguage] || sourceLanguage;
    const targetLangName = languageNames[targetLanguage] || targetLanguage;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the given text from ${sourceLangName} to ${targetLangName}.
          Maintain the same tone and style. If the text contains UI elements or technical terms, keep them appropriate for a web application.
          IMPORTANT: Translate the text literally - if the text is a language name like "English", "Dutch", "French", etc., translate it as the name of that language in the target language.
          For example: "English" in Dutch should be "Engels", not "Nederlands".
          Only return the translated text, nothing else.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
    });

    const translatedText = completion.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error('Translation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to translate text';
    return NextResponse.json(
      { error: 'Failed to translate text', details: errorMessage },
      { status: 500 }
    );
  }
}
