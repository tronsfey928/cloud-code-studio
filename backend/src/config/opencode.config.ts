import { registerAs } from '@nestjs/config';

export default registerAs('opencode', () => ({
  llmProvider: process.env.OPENCODE_LLM_PROVIDER || 'anthropic',
  llmModel: process.env.OPENCODE_LLM_MODEL || '',
  llmApiKey: process.env.OPENCODE_LLM_API_KEY || '',
  llmBaseUrl: process.env.OPENCODE_LLM_BASE_URL || '',
}));
