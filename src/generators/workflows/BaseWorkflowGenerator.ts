import { CodebaseAnalysis } from '../../analyzers/CodebaseAnalyzer.js';

export interface UserFlow {
  name: string;
  slug: string;
  description: string;
  steps: UserFlowStep[];
  diagram?: string;
}

export interface UserFlowStep {
  action: string;
  component?: string;
  componentSlug?: string;
  event?: string;
  apiEndpoint?: string;
  apiSlug?: string;
  serviceFunction?: string;
  dbModel?: string;
  result: string;
}

export interface WorkflowGeneratorConfig {
  openaiApiKey: string;
  debug?: boolean;
}

export abstract class BaseWorkflowGenerator {
  protected config: WorkflowGeneratorConfig;

  constructor(config: WorkflowGeneratorConfig) {
    this.config = config;
  }

  abstract canHandle(analysis: CodebaseAnalysis): boolean;
  abstract generateWorkflows(analysis: CodebaseAnalysis): Promise<UserFlow[]>;

  protected async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a technical documentation expert. Generate precise, structured documentation based on code analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    return data.choices[0].message.content;
  }

  protected generateSlug(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  protected cleanJSONResponse(response: string): string {
    // Remove markdown code blocks if present
    let cleaned = response.trim();
    
    // Remove opening ```json or ``` 
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
    
    // Remove closing ```
    cleaned = cleaned.replace(/\n?```\s*$/i, '');
    
    // Remove any leading/trailing whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  }

  protected log(message: string): void {
    if (this.config.debug) {
      console.log(message);
    }
  }
}