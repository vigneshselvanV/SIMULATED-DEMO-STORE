/**
 * openrouterClient.js
 * Lightweight, native-fetch client for OpenRouter chat completions.
 * Supports tool calling, timeout cancellation, exponential backoff, and mock fetch injection for testing.
 */

export class OpenRouterError extends Error {
  constructor(message, { status = null, code = null, isRetryable = false, data = null } = {}) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
    this.code = code;
    this.isRetryable = isRetryable;
    this.data = data;
  }
}

export class OpenRouterClient {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
    this.defaultTimeoutMs = options.timeoutMs || parseInt(process.env.AGENT_TIMEOUT_MS, 10) || 30000;
    this.fetchFn = options.fetchFn || fetch;
  }

  /**
   * Execute chat completion call with retries and abort controller timeout.
   */
  async chatCompletion({
    apiKey,
    model,
    messages,
    tools = null,
    toolChoice = 'auto',
    temperature = 0.2,
    maxTokens = 1024,
    timeoutMs = null,
    maxRetries = 2
  }) {
    if (!apiKey) {
      throw new OpenRouterError('Missing API key for OpenRouter completion', { status: 401 });
    }
    if (!model) {
      throw new OpenRouterError('Missing model identifier for OpenRouter completion', { status: 400 });
    }

    const effectiveTimeoutMs = timeoutMs || this.defaultTimeoutMs;
    const url = `${this.baseUrl}/chat/completions`;

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    };

    if (tools && Array.isArray(tools) && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = toolChoice;
    }

    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), effectiveTimeoutMs);

      try {
        const response = await this.fetchFn(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:5173',
            'X-Title': 'ShopSphere E-Commerce'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutHandle);

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          const status = response.status;
          const errorMsg = data?.error?.message || `OpenRouter returned HTTP ${status}`;
          const isRateLimit = status === 429;
          const isServerErr = status >= 500;
          const isAuthErr = status === 401 || status === 402 || status === 403;

          const openRouterError = new OpenRouterError(errorMsg, {
            status,
            code: data?.error?.code || (isRateLimit ? 'RATE_LIMIT' : (isAuthErr ? 'AUTH_ERROR' : 'HTTP_ERROR')),
            isRetryable: isRateLimit || isServerErr,
            data
          });

          // Non-retryable errors (e.g. 401, 403, 400 invalid request) fail immediately
          if (!openRouterError.isRetryable || attempt >= maxRetries) {
            throw openRouterError;
          }

          lastError = openRouterError;
        } else {
          // Success response
          const choice = data?.choices?.[0];
          const message = choice?.message;

          if (!message && !choice) {
            throw new OpenRouterError('Empty completion choices received from model', { status: 502, isRetryable: true });
          }

          // Parse tool calls if present
          let parsedToolCalls = null;
          if (message?.tool_calls && Array.isArray(message.tool_calls)) {
            parsedToolCalls = message.tool_calls.map((tc) => {
              let args = {};
              try {
                args = typeof tc.function.arguments === 'string'
                  ? JSON.parse(tc.function.arguments)
                  : (tc.function.arguments || {});
              } catch (e) {
                args = { raw: tc.function.arguments };
              }
              return {
                id: tc.id,
                name: tc.function.name,
                arguments: args
              };
            });
          }

          return {
            content: message?.content || null,
            toolCalls: parsedToolCalls,
            rawMessage: message,
            usage: data?.usage || null,
            model: data?.model || model
          };
        }
      } catch (err) {
        clearTimeout(timeoutHandle);

        if (err.name === 'AbortError') {
          lastError = new OpenRouterError(`OpenRouter request timed out after ${effectiveTimeoutMs}ms`, {
            status: 408,
            code: 'TIMEOUT',
            isRetryable: true
          });
        } else if (err instanceof OpenRouterError) {
          lastError = err;
          if (!err.isRetryable) {
            throw err;
          }
        } else {
          lastError = new OpenRouterError(err.message || 'Network request failed', {
            status: 503,
            code: 'NETWORK_ERROR',
            isRetryable: true
          });
        }

        if (attempt >= maxRetries) {
          throw lastError;
        }
      }

      // Exponential backoff wait before retry: 300ms, 600ms...
      const backoffMs = Math.min(2000, 300 * Math.pow(2, attempt));
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      attempt++;
    }

    throw lastError || new OpenRouterError('Unknown failure during chat completion', { status: 500 });
  }
}

export const openrouterClient = new OpenRouterClient();
export default openrouterClient;
