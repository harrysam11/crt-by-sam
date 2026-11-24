/**
 * mcpClient.ts
 * Universal Model Context Protocol (MCP) Client & BYOK AI Provider Engine.
 * Supports:
 *   - MCP Streamable HTTP / SSE Server (like dmcharts)
 *   - Anthropic Claude (Claude 3.5 Sonnet / Haiku) with Native Tool Calling
 *   - OpenAI / OpenRouter / Groq / DeepSeek with Tool Calling
 *   - Google Gemini 1.5 (Flash / Pro) with Function Declarations
 *   - Local Ollama (Desktop / Self-Hosted)
 * ZERO EMOJI POLICY strictly enforced.
 */

import { TERMINALX_MCP_TOOLS, executeMcpTool, McpToolDefinition } from './mcpTools';

export type McpProviderType =
  | 'MCP_SERVER'
  | 'ANTHROPIC'
  | 'OPENAI_OPENROUTER'
  | 'GOOGLE_GEMINI'
  | 'LOCAL_OLLAMA';

export interface McpConfig {
  provider: McpProviderType;
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface McpExecutionResult {
  reply: string;
  toolCallsExecuted: { tool: string; args: any; output: string }[];
}

/**
 * Convert TerminalX MCP Tools to OpenAI / OpenRouter / Groq Function Calling Schema
 */
function toOpenAiTools(tools: McpToolDefinition[]) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/**
 * Convert TerminalX MCP Tools to Anthropic Claude Tool Schema
 */
function toAnthropicTools(tools: McpToolDefinition[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

/**
 * Convert TerminalX MCP Tools to Google Gemini Function Declarations
 */
function toGeminiTools(tools: McpToolDefinition[]) {
  return [
    {
      function_declarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  ];
}

export async function queryMcpAgent(
  userPrompt: string,
  config: McpConfig,
  contextSnapshot: string
): Promise<McpExecutionResult> {
  const toolCallsExecuted: { tool: string; args: any; output: string }[] = [];

  const systemPrompt = `You are TerminalX Quantitative Analyst and Algorithmic Trading Specialist.
You have direct access to real-time market data, orderflow, TradeXGuardian risk checks, position size calculations, and economic calendars via MCP tools.
Always call tools when real-time prices, calculations, or risk rules are required.
Give institutional, concise, data-driven responses. Do not use emojis.`;

  // 1. Anthropic Claude (Claude 3.5 Sonnet / Haiku)
  if (config.provider === 'ANTHROPIC') {
    const endpoint = config.endpoint || 'https://api.anthropic.com/v1/messages';
    const messages: any[] = [
      {
        role: 'user',
        content: `CONTEXT:\n${contextSnapshot}\n\nUSER PROMPT:\n${userPrompt}`,
      },
    ];

    const anthropicTools = toAnthropicTools(TERMINALX_MCP_TOOLS);

    const firstRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        system: systemPrompt,
        messages,
        tools: anthropicTools,
      }),
    });

    if (!firstRes.ok) {
      const err = await firstRes.text();
      throw new Error(`Anthropic API error (${firstRes.status}): ${err}`);
    }

    const firstData = await firstRes.json();
    const toolUseBlocks = (firstData.content || []).filter((b: any) => b.type === 'tool_use');

    if (toolUseBlocks.length === 0) {
      const textBlock = (firstData.content || []).find((b: any) => b.type === 'text');
      return { reply: textBlock?.text || 'No response generated.', toolCallsExecuted };
    }

    // Execute requested MCP tools
    messages.push({ role: 'assistant', content: firstData.content });
    const toolResultContent: any[] = [];

    for (const tu of toolUseBlocks) {
      const out = await executeMcpTool(tu.name, tu.input || {});
      toolCallsExecuted.push({ tool: tu.name, args: tu.input, output: out });
      toolResultContent.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: out,
      });
    }

    messages.push({ role: 'user', content: toolResultContent });

    // Final response generation with tool results
    const secondRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        system: systemPrompt,
        messages,
        tools: anthropicTools,
      }),
    });

    const secondData = await secondRes.json();
    const textBlock = (secondData.content || []).find((b: any) => b.type === 'text');
    return { reply: textBlock?.text || 'Analysis completed with MCP tools.', toolCallsExecuted };
  }

  // 2. OpenAI / OpenRouter / Groq / DeepSeek
  if (config.provider === 'OPENAI_OPENROUTER') {
    const endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
    const openAiTools = toOpenAiTools(TERMINALX_MCP_TOOLS);

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `CONTEXT:\n${contextSnapshot}\n\nUSER PROMPT:\n${userPrompt}` },
    ];

    const firstRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o',
        messages,
        tools: openAiTools,
        tool_choice: 'auto',
      }),
    });

    if (!firstRes.ok) {
      const err = await firstRes.text();
      throw new Error(`OpenAI/OpenRouter API error (${firstRes.status}): ${err}`);
    }

    const firstData = await firstRes.json();
    const choice = firstData.choices?.[0];
    const toolCalls = choice?.message?.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      return { reply: choice?.message?.content || 'No response generated.', toolCallsExecuted };
    }

    messages.push(choice.message);

    for (const tc of toolCalls) {
      const fnName = tc.function.name;
      const fnArgs = JSON.parse(tc.function.arguments || '{}');
      const out = await executeMcpTool(fnName, fnArgs);
      toolCallsExecuted.push({ tool: fnName, args: fnArgs, output: out });

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: out,
      });
    }

    const secondRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o',
        messages,
      }),
    });

    const secondData = await secondRes.json();
    return {
      reply: secondData.choices?.[0]?.message?.content || 'Tool execution completed.',
      toolCallsExecuted,
    };
  }

  // 3. Google Gemini (Gemini 1.5 Flash / Pro)
  if (config.provider === 'GOOGLE_GEMINI') {
    const model = config.model || 'gemini-1.5-flash';
    const baseUrl = config.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models';
    const url = `${baseUrl}/${model}:generateContent?key=${config.apiKey}`;

    const geminiTools = toGeminiTools(TERMINALX_MCP_TOOLS);

    const firstRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nCONTEXT:\n${contextSnapshot}\n\nUSER PROMPT:\n${userPrompt}` }],
          },
        ],
        tools: geminiTools,
      }),
    });

    if (!firstRes.ok) {
      const err = await firstRes.text();
      throw new Error(`Gemini API error (${firstRes.status}): ${err}`);
    }

    const firstData = await firstRes.json();
    const candidate = firstData.candidates?.[0];
    const functionCallPart = (candidate?.content?.parts || []).find((p: any) => p.functionCall);

    if (!functionCallPart) {
      const textPart = (candidate?.content?.parts || []).find((p: any) => p.text);
      return { reply: textPart?.text || 'No response generated.', toolCallsExecuted };
    }

    const fnCall = functionCallPart.functionCall;
    const out = await executeMcpTool(fnCall.name, fnCall.args || {});
    toolCallsExecuted.push({ tool: fnCall.name, args: fnCall.args, output: out });

    // Send function response back to Gemini
    const secondRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nCONTEXT:\n${contextSnapshot}\n\nUSER PROMPT:\n${userPrompt}` }],
          },
          candidate.content,
          {
            role: 'function',
            parts: [
              {
                functionResponse: {
                  name: fnCall.name,
                  response: { content: out },
                },
              },
            ],
          },
        ],
      }),
    });

    const secondData = await secondRes.json();
    const textPart = (secondData.candidates?.[0]?.content?.parts || []).find((p: any) => p.text);
    return {
      reply: textPart?.text || 'Tool analysis processed successfully.',
      toolCallsExecuted,
    };
  }

  // 4. Remote MCP Streamable HTTP / SSE Server (like dmcharts)
  if (config.provider === 'MCP_SERVER') {
    const endpoint = config.endpoint || 'http://localhost:3000/mcp';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: config.apiKey ? `Bearer ${config.apiKey}` : '',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call_agent',
        params: {
          prompt: userPrompt,
          context: contextSnapshot,
          available_tools: TERMINALX_MCP_TOOLS,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`MCP Server returned HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      reply: data.result?.text || data.result?.content || JSON.stringify(data.result),
      toolCallsExecuted: data.result?.toolCalls || [],
    };
  }

  // 5. Local Ollama Fallback
  {
    const endpoint = config.endpoint || 'http://localhost:11434/api/generate';
    const fullPrompt = `${systemPrompt}\n\nCONTEXT:\n${contextSnapshot}\n\nUSER PROMPT:\n${userPrompt}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model || 'deepseek-r1:latest',
        prompt: fullPrompt,
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Local Ollama error (${res.status}). Ensure Ollama is running on localhost.`);
    }

    const data = await res.json();
    return { reply: data.response || 'No response from local Ollama.', toolCallsExecuted };
  }
}
