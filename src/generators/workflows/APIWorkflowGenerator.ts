import { BaseWorkflowGenerator, UserFlow } from './BaseWorkflowGenerator.js';
import { CodebaseAnalysis } from '../../analyzers/CodebaseAnalyzer.js';

export class APIWorkflowGenerator extends BaseWorkflowGenerator {
  canHandle(analysis: CodebaseAnalysis): boolean {
    // Detect API services by checking for server frameworks and API patterns
    const hasAPIFrameworks = !!(analysis.dependencies.express ||
                             analysis.dependencies.fastify ||
                             analysis.dependencies.koa ||
                             analysis.dependencies.hapi ||
                             analysis.dependencies.restify ||
                             analysis.dependencies['@nestjs/core']);
    
    const hasAPIFiles = analysis.files.some(file => 
      file.path.includes('routes/') ||
      file.path.includes('controllers/') ||
      file.path.includes('api/') ||
      file.path.includes('server.') ||
      file.content.includes('app.get(') ||
      file.content.includes('app.post(') ||
      file.content.includes('.route(') ||
      file.content.includes('router.')
    );

    const hasAPIRoutes = analysis.files.some(file => 
      file.routes.length > 0
    );

    // Check if this is primarily an API (has routes but limited frontend)
    const routeCount = analysis.files.reduce((sum, file) => sum + file.routes.length, 0);
    const componentCount = analysis.files.reduce((sum, file) => sum + file.components.length, 0);
    const isPrimarilyAPI = routeCount > 0 && (componentCount === 0 || routeCount > componentCount);

    this.log(`API Detection: frameworks=${hasAPIFrameworks}, files=${hasAPIFiles}, routes=${hasAPIRoutes}, primaryAPI=${isPrimarilyAPI}`);
    
    return hasAPIFrameworks || hasAPIFiles || hasAPIRoutes || isPrimarilyAPI;
  }

  async generateWorkflows(analysis: CodebaseAnalysis): Promise<UserFlow[]> {
    this.log('Generating API-specific workflows...');

    const prompt = this.buildAPIPrompt(analysis);
    
    try {
      const response = await this.callOpenAI(prompt);
      const parsed = JSON.parse(response);
      
      // Convert API workflows to standard UserFlow format
      return parsed.workflows?.map((workflow: any) => ({
        name: workflow.name,
        slug: workflow.slug || this.generateSlug(workflow.name),
        description: workflow.description,
        steps: workflow.steps?.map((step: any) => ({
          action: step.action,
          component: 'API Client',
          componentSlug: this.generateSlug(step.endpoint || 'api-client'),
          event: step.method?.toLowerCase() || 'request',
          apiEndpoint: step.endpoint,
          apiSlug: this.generateSlug(`${step.method || 'GET'} ${step.endpoint || ''}`),
          serviceFunction: step.handler || 'API handler',
          dbModel: step.model || '',
          result: step.result
        })) || []
      })) || [];
    } catch (error) {
      console.error('Error generating API workflows:', error);
      return this.generateFallbackWorkflows(analysis);
    }
  }

  private buildAPIPrompt(analysis: CodebaseAnalysis): string {
    const apiRoutes = this.extractAPIRoutes(analysis);
    const middleware = this.extractMiddleware(analysis);
    const databaseModels = this.extractDatabaseModels(analysis);

    return `
# API Service Workflow Documentation Generation

Analyze this API service and create structured workflow documentation covering API usage patterns and integration scenarios.

## Project Analysis:
**Service Name**: ${analysis.projectName}
**Framework**: ${analysis.framework.join(', ')}
**Dependencies**: ${Object.keys(analysis.dependencies).slice(0, 12).join(', ')}

## API Routes Detected:
${apiRoutes.length > 0 ? apiRoutes.join('\n') : 'Standard REST API patterns detected'}

## Middleware:
${middleware.length > 0 ? middleware.join(', ') : 'Standard middleware detected'}

## Database Models:
${databaseModels.length > 0 ? databaseModels.join(', ') : 'Data persistence detected'}

Create API workflow documentation as JSON with this structure:

{
  "workflows": [
    {
      "name": "API Authentication",
      "slug": "api-authentication",
      "description": "How to authenticate with the API service",
      "steps": [
        {
          "action": "Obtain API credentials",
          "method": "POST",
          "endpoint": "/auth/login",
          "handler": "authController.login",
          "model": "users",
          "headers": {"Content-Type": "application/json"},
          "body": {"username": "string", "password": "string"},
          "result": "Receive authentication token"
        },
        {
          "action": "Use token for authenticated requests",
          "method": "GET",
          "endpoint": "/api/protected",
          "handler": "protectedController.getData",
          "model": "",
          "headers": {"Authorization": "Bearer <token>"},
          "result": "Access protected resources"
        }
      ]
    },
    {
      "name": "Core API Operations",
      "slug": "core-api-operations",
      "description": "Primary CRUD operations and business logic",
      "steps": [
        {
          "action": "Create new resource",
          "method": "POST",
          "endpoint": "/api/resources",
          "handler": "resourceController.create",
          "model": "resources",
          "body": {"data": "object"},
          "result": "Resource created successfully"
        },
        {
          "action": "Retrieve resources",
          "method": "GET", 
          "endpoint": "/api/resources",
          "handler": "resourceController.list",
          "model": "resources",
          "result": "List of resources returned"
        }
      ]
    }
  ]
}

Based on the detected API routes and patterns, create 2-4 workflow sections that cover:
1. **Authentication/Authorization** (if auth patterns detected)
2. **Core CRUD Operations** (create, read, update, delete)
3. **Data Querying** (filtering, pagination, search)
4. **Error Handling** (common error scenarios)

Make each workflow specific to the actual endpoints detected in the codebase.
Include realistic request/response examples based on the API structure.
Return only the JSON structure.
`;
  }

  private extractAPIRoutes(analysis: CodebaseAnalysis): string[] {
    const routes: string[] = [];
    
    analysis.files.forEach(file => {
      file.routes.forEach(route => {
        routes.push(`- ${route.method} ${route.path} → ${route.handler} (${file.path})`);
      });
    });

    return routes;
  }

  private extractMiddleware(analysis: CodebaseAnalysis): string[] {
    const middleware: string[] = [];
    
    analysis.files.forEach(file => {
      file.routes.forEach(route => {
        route.middleware.forEach(mw => {
          if (!middleware.includes(mw)) {
            middleware.push(mw);
          }
        });
      });
    });

    return middleware;
  }

  private extractDatabaseModels(analysis: CodebaseAnalysis): string[] {
    const models: string[] = [];
    
    analysis.files.forEach(file => {
      // Look for common ORM patterns
      if (file.content.includes('Schema') || 
          file.content.includes('model') ||
          file.content.includes('Model') ||
          file.path.includes('models/') ||
          file.path.includes('schemas/')) {
        
        const modelMatches = file.content.match(/(?:const|let|var)\s+(\w+)\s*=.*?(?:Schema|model)/g);
        if (modelMatches) {
          modelMatches.forEach(match => {
            const modelName = match.match(/(?:const|let|var)\s+(\w+)/);
            if (modelName) models.push(modelName[1]);
          });
        }
      }
    });

    return [...new Set(models)];
  }

  private generateFallbackWorkflows(analysis: CodebaseAnalysis): UserFlow[] {
    return [
      {
        name: 'API Request Flow',
        slug: 'api-request-flow',
        description: 'Basic API request and response pattern',
        steps: [
          {
            action: 'Client sends API request',
            component: 'API Client',
            componentSlug: 'api-client',
            event: 'request',
            apiEndpoint: '/api/endpoint',
            serviceFunction: 'API handler',
            result: 'Server processes request'
          },
          {
            action: 'Server returns response',
            component: 'API Server', 
            componentSlug: 'api-server',
            event: 'response',
            apiEndpoint: '/api/endpoint',
            serviceFunction: 'Response handler',
            result: 'Client receives data'
          }
        ]
      },
      {
        name: 'Data Management',
        slug: 'data-management',
        description: 'CRUD operations through the API',
        steps: [
          {
            action: 'Create data resource',
            component: 'API Client',
            componentSlug: 'data-client',
            event: 'post',
            apiEndpoint: '/api/data',
            serviceFunction: 'createResource',
            result: 'Resource created in database'
          },
          {
            action: 'Retrieve data resource',
            component: 'API Client',
            componentSlug: 'data-client', 
            event: 'get',
            apiEndpoint: '/api/data',
            serviceFunction: 'getResource',
            result: 'Resource data returned'
          }
        ]
      }
    ];
  }
}