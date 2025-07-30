import { BaseWorkflowGenerator, UserFlow } from './BaseWorkflowGenerator.js';
import { CodebaseAnalysis } from '../../analyzers/CodebaseAnalyzer.js';

export class WebAppWorkflowGenerator extends BaseWorkflowGenerator {
  canHandle(analysis: CodebaseAnalysis): boolean {
    // Detect web applications by checking for frontend frameworks and web patterns
    const hasFrontendFrameworks = analysis.framework.some(fw => 
      ['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt.js'].includes(fw)
    );
    
    const hasWebDependencies = !!(analysis.dependencies.react || 
                              analysis.dependencies.vue ||
                              analysis.dependencies.angular ||
                              analysis.dependencies.svelte ||
                              analysis.dependencies.next ||
                              analysis.dependencies.nuxt ||
                              analysis.dependencies.express ||
                              analysis.dependencies.fastify);
    
    const hasWebFiles = analysis.files.some(file => 
      file.path.includes('components/') ||
      file.path.includes('pages/') ||
      file.path.includes('views/') ||
      file.path.includes('.tsx') ||
      file.path.includes('.vue') ||
      file.content.includes('export default function') ||
      file.content.includes('export const')
    );

    const hasUIComponents = analysis.files.some(file => 
      file.components.length > 0
    );

    this.log(`WebApp Detection: frameworks=${hasFrontendFrameworks}, deps=${hasWebDependencies}, files=${hasWebFiles}, components=${hasUIComponents}`);
    
    return hasFrontendFrameworks || hasWebDependencies || hasWebFiles || hasUIComponents;
  }

  async generateWorkflows(analysis: CodebaseAnalysis): Promise<UserFlow[]> {
    this.log('Generating Web Application workflows...');

    const prompt = this.buildWebAppPrompt(analysis);
    
    try {
      const response = await this.callOpenAI(prompt);
      const parsed = JSON.parse(response);
      
      return parsed.userFlows || parsed.workflows || [];
    } catch (error) {
      console.error('Error generating web app user workflows:', error);
      return this.generateFallbackWorkflows(analysis);
    }
  }

  private buildWebAppPrompt(analysis: CodebaseAnalysis): string {
    const components = this.extractComponents(analysis);
    const apiEndpoints = this.extractAPIEndpoints(analysis);
    const interactionLinks = analysis.links || [];

    return `
# Web Application User Flow Documentation Generation

Based on this application analysis, create comprehensive user flows with cross-references:

## Project Analysis:
**Application Name**: ${analysis.projectName}
**Framework**: ${analysis.framework.join(', ')}
**Frontend Components**: ${components.join(', ') || 'Standard components detected'}
**API Endpoints**: ${apiEndpoints.join(', ') || 'Backend endpoints detected'}
**Interaction Links**: ${interactionLinks.map(l => `${l.uiComponent}.${l.event} → ${l.apiEndpoint} → ${l.dbModel || 'DB'}`).join(', ') || 'Standard interactions'}

Create 3-5 major user flows as structured JSON. Each flow should represent a core user journey in the application.

Expected JSON structure:
{
  "userFlows": [
    {
      "name": "User Authentication",
      "slug": "user-authentication",
      "description": "Complete user login and registration process",
      "steps": [
        {
          "action": "User navigates to login page",
          "componentSlug": "login-form",
          "event": "navigation",
          "apiSlug": "get-login-page",
          "serviceFunction": "renderLoginPage",
          "dbModel": "",
          "result": "Login form displayed"
        },
        {
          "action": "User submits credentials",
          "componentSlug": "login-form",
          "event": "submit",
          "apiSlug": "post-auth-login",
          "serviceFunction": "validateCredentials",
          "dbModel": "users",
          "result": "User authenticated and redirected"
        }
      ]
    }
  ]
}

Focus on these types of flows:
1. **Authentication flows** (login, registration, logout)
2. **Core feature flows** (main app functionality)
3. **Data management flows** (create, read, update, delete operations)
4. **Navigation flows** (moving between sections)
5. **Settings/Profile flows** (user preferences, profile management)

Make each step specific to the components and APIs detected in the codebase.
Ensure each flow has 2-6 logical steps that represent a complete user journey.
Return only the JSON structure.
`;
  }

  private extractComponents(analysis: CodebaseAnalysis): string[] {
    const components: string[] = [];
    
    analysis.files.forEach(file => {
      file.components.forEach(component => {
        components.push(component.name);
      });
    });

    return [...new Set(components)]; // Remove duplicates
  }

  private extractAPIEndpoints(analysis: CodebaseAnalysis): string[] {
    const endpoints: string[] = [];
    
    analysis.files.forEach(file => {
      file.routes.forEach(route => {
        endpoints.push(`${route.method} ${route.path}`);
      });
    });

    return [...new Set(endpoints)]; // Remove duplicates
  }

  private generateFallbackWorkflows(analysis: CodebaseAnalysis): UserFlow[] {
    return [
      {
        name: 'Application Navigation',
        slug: 'application-navigation',
        description: 'Basic navigation through the application',
        steps: [
          {
            action: 'User opens application',
            componentSlug: 'main-app',
            event: 'load',
            apiEndpoint: '/',
            serviceFunction: 'loadApplication',
            result: 'Application interface displayed'
          },
          {
            action: 'User navigates to main features',
            componentSlug: 'navigation',
            event: 'click',
            apiEndpoint: '/main',
            serviceFunction: 'loadMainContent',
            result: 'Main content area updated'
          }
        ]
      },
      {
        name: 'User Interaction',
        slug: 'user-interaction',
        description: 'Common user interactions within the application',
        steps: [
          {
            action: 'User interacts with interface',
            componentSlug: 'interactive-component',
            event: 'interaction',
            apiEndpoint: '/api/action',
            serviceFunction: 'handleUserAction',
            result: 'System responds to user input'
          }
        ]
      }
    ];
  }
}