import { NextResponse } from 'next/server';
import { getLLMClient, getLLMModel } from '@/lib/llm/client';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const openai = getLLMClient();
    const model = getLLMModel();

    // First list available models
    const modelsList = await openai.models.list();
    const availableModelIds = modelsList.data.map((m) => m.id);

    // Pick chat completion model (exclude guard/moderation/whisper)
    const chatModels = availableModelIds.filter(
      (id) => !id.includes('guard') && !id.includes('whisper') && !id.includes('prompt-guard')
    );

    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: 'Say hello in one short sentence.',
        },
      ],
      max_tokens: 300,
    });
    const durationMs = Date.now() - startTime;

    const reply = completion.choices[0]?.message?.content || (completion.choices[0]?.message as any)?.reasoning || 'No text';

    return NextResponse.json({
      status: 'success',
      configured_model: model,
      latency_ms: durationMs,
      message: reply,
      available_models: availableModelIds,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'error',
        error: err.message || 'Unknown error occurred while contacting LLM API',
      },
      { status: 500 }
    );
  }
}
