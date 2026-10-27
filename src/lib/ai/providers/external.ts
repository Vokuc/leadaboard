import {
  AiActionProposal,
  AiAssistantContext,
  AiGenerateOptions,
  AiGenerateResult,
  AiProvider,
  AiTaskType,
} from '../types';
import { GroundedLocalProvider } from './grounded-local';

/**
 * External AI Provider wrapper supporting OpenAI-compatible, Gemini, or Claude REST endpoints.
 * When no external key is configured or upon external failure/timeout, seamlessly falls back
 * to the deterministic GroundedLocalProvider to ensure 100% platform stability and reliability.
 */
export class ExternalAiProvider implements AiProvider {
  name: string;
  private localFallback = new GroundedLocalProvider();
  private apiKey?: string;
  private endpoint?: string;
  private modelName: string;

  constructor() {
    const configuredProvider = (process.env.AI_PROVIDER || 'auto').toLowerCase();

    if ((configuredProvider === 'openai' || configuredProvider === 'auto') && process.env.OPENAI_API_KEY) {
      this.name = 'openai';
      this.apiKey = process.env.OPENAI_API_KEY;
      this.endpoint = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
      this.modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    } else if ((configuredProvider === 'gemini' || configuredProvider === 'auto') && process.env.GEMINI_API_KEY) {
      this.name = 'gemini';
      this.apiKey = process.env.GEMINI_API_KEY;
      this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}:generateContent?key=${this.apiKey}`;
      this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    } else if ((configuredProvider === 'anthropic' || configuredProvider === 'auto') && process.env.ANTHROPIC_API_KEY) {
      this.name = 'anthropic';
      this.apiKey = process.env.ANTHROPIC_API_KEY;
      this.endpoint = 'https://api.anthropic.com/v1/messages';
      this.modelName = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
    } else {
      this.name = 'grounded_local';
      this.modelName = 'deterministic-grounded-v1';
    }
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  async generateResponse(options: AiGenerateOptions): Promise<AiGenerateResult> {
    // If not configured, immediately use deterministic local grounded engine
    if (!this.apiKey || this.name === 'grounded_local') {
      return this.localFallback.generateResponse(options);
    }

    try {
      const systemPrompt = `You are the LeaderboardOS Competition Manager.
You MUST operate strictly on top of the real competition engine data provided in the context.
Do NOT invent standings, results, participant details, or competition rules.
If information is not present, clearly state that it is unavailable.
Context:
${JSON.stringify(options.context)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      if (this.name === 'gemini' && this.endpoint) {
        const contents = [
          ...(options.history || []).map((h) => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }],
          })),
          {
            role: 'user',
            parts: [{ text: options.prompt }],
          },
        ];

        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents,
            generationConfig: {
              temperature: 0.2,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          const reply = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            return {
              content: reply,
              dataSources: ['authoritative_context_snapshot'],
              provider: 'gemini',
              model: this.modelName,
              tokensUsed: {
                prompt: json.usageMetadata?.promptTokenCount || 150,
                completion: json.usageMetadata?.candidatesTokenCount || 100,
              },
            };
          }
        }
      } else if (this.name === 'anthropic' && this.endpoint && this.apiKey) {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: this.modelName,
            system: systemPrompt,
            messages: [
              ...(options.history || []).map((h) => ({ role: h.role, content: h.content })),
              { role: 'user', content: options.prompt },
            ],
            max_tokens: 1024,
            temperature: 0.2,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          const textBlock = json.content?.find((c: { type: string; text?: string }) => c.type === 'text');
          const reply = textBlock?.text;
          if (reply) {
            return {
              content: reply,
              dataSources: ['authoritative_context_snapshot'],
              provider: 'anthropic',
              model: this.modelName,
              tokensUsed: {
                prompt: json.usage?.input_tokens || 150,
                completion: json.usage?.output_tokens || 100,
              },
            };
          }
        }
      } else if (this.name === 'openai' && this.endpoint) {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.modelName,
            messages: [
              { role: 'system', content: systemPrompt },
              ...(options.history || []).map((h) => ({ role: h.role, content: h.content })),
              { role: 'user', content: options.prompt },
            ],
            temperature: 0.2, // Lower temperature to avoid hallucinations
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          const reply = json.choices?.[0]?.message?.content;
          if (reply) {
            return {
              content: reply,
              dataSources: ['authoritative_context_snapshot'],
              provider: this.name,
              model: this.modelName,
              tokensUsed: {
                prompt: json.usage?.prompt_tokens || 150,
                completion: json.usage?.completion_tokens || 100,
              },
            };
          }
        }
      }
    } catch (err) {
      console.warn('External AI call failed or timed out, falling back to GroundedLocalProvider:', err);
    }

    // Graceful fallback to guaranteed accurate local provider
    return this.localFallback.generateResponse(options);
  }

  async generateProposal(
    context: AiAssistantContext,
    taskType: AiTaskType,
    instructions?: string,
    actorUserId?: string
  ): Promise<AiActionProposal> {
    // Proposals must always be strictly validated structures generated deterministically
    return this.localFallback.generateProposal(context, taskType, instructions, actorUserId);
  }
}
