import OpenAI from 'openai';

export function getLLMClient() {
  const baseURL = process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1';
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey || apiKey === 'placeholder-llm-key') {
    throw new Error('LLM_API_KEY is not configured.');
  }

  return new OpenAI({
    baseURL,
    apiKey,
  });
}

export function getLLMModel() {
  return process.env.LLM_MODEL || 'llama-3.3-70b-versatile';
}
