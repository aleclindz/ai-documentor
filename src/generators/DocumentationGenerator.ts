import OpenAI from 'openai';
import { marked } from 'marked';
import { CodebaseAnalysis, FileInfo, FunctionInfo, ComponentInfo, RouteInfo } from '../analyzers/CodebaseAnalyzer.js';
import { Config } from '../utils/Config.js';
import { MermaidGenerator } from './MermaidGenerator.js';

export interface GeneratedDocumentation {
  overview: string;
  frontend: FrontendDocumentation;
  backend: BackendDocumentation;
  database: DatabaseDocumentation;
  userFlows: UserFlow[];
  architectureDiagram: string;
  apiDocumentation: APIDocumentation[];
  deploymentGuide: string;
  troubleshooting: string;
}

export interface FrontendDocumentation {
  overview: string;
  components: ComponentDocumentation[];
  pages: PageDocumentation[];
  styling: string;
  stateManagement: string;
}

export interface ComponentDocumentation {
  name: string;
  purpose: string;
  props: string[];
  usage: string;
  interactions: string;
  filePath: string;
}

export interface PageDocumentation {
  route: string;
  purpose: string;
  components: string[];
  dataFlow: string;
}

export interface BackendDocumentation {
  overview: string;
  apis: APIEndpoint[];
  services: ServiceDocumentation[];
  middleware: string[];
  authentication: string;
}

export interface APIEndpoint {
  method: string;
  path: string;
  purpose: string;
  parameters: Parameter[];
  response: string;
  errorHandling: string;
  filePath: string;
}

export interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ServiceDocumentation {
  name: string;
  purpose: string;
  functions: FunctionDocumentation[];
  dependencies: string[];
}

export interface FunctionDocumentation {
  name: string;
  purpose: string;
  parameters: Parameter[];
  returnValue: string;
  sideEffects: string;
}

export interface DatabaseDocumentation {
  overview: string;
  schema: TableDocumentation[];
  queries: QueryDocumentation[];
  relationships: string;
}

export interface TableDocumentation {
  name: string;
  purpose: string;
  columns: ColumnDocumentation[];
  relationships: string[];
}

export interface ColumnDocumentation {
  name: string;
  type: string;
  nullable: boolean;
  description: string;
}

export interface QueryDocumentation {
  type: string;
  purpose: string;
  query: string;
  usage: string;
}

export interface UserFlow {
  name: string;
  description: string;
  steps: UserFlowStep[];
  diagram: string;
}

export interface UserFlowStep {
  action: string;
  component: string;
  backendCall?: string;
  databaseQuery?: string;
  result: string;
}

export interface APIDocumentation {
  endpoint: string;
  method: string;
  description: string;
  parameters: Parameter[];
  responses: ResponseDocumentation[];
  examples: ExampleDocumentation[];
}

export interface ResponseDocumentation {
  status: number;
  description: string;
  schema: string;
}

export interface ExampleDocumentation {
  title: string;
  request: string;
  response: string;
}

export class DocumentationGenerator {
  private openai: OpenAI;
  private config: any;
  private mermaidGenerator: MermaidGenerator;

  constructor(config: any) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey
    });
    this.mermaidGenerator = new MermaidGenerator();
  }

  async generate(analysis: CodebaseAnalysis): Promise<GeneratedDocumentation> {
    const documentation: GeneratedDocumentation = {
      overview: await this.generateOverview(analysis),
      frontend: await this.generateFrontendDocs(analysis),
      backend: await this.generateBackendDocs(analysis),
      database: await this.generateDatabaseDocs(analysis),
      userFlows: await this.generateUserFlows(analysis),
      architectureDiagram: await this.mermaidGenerator.generateArchitectureDiagram(analysis),
      apiDocumentation: await this.generateAPIDocumentation(analysis),
      deploymentGuide: await this.generateDeploymentGuide(analysis),
      troubleshooting: await this.generateTroubleshooting(analysis)
    };

    return documentation;
  }

  private async generateOverview(analysis: CodebaseAnalysis): Promise<string> {
    const prompt = `
# Project Documentation Overview Generation

You are an expert technical writer creating comprehensive documentation for a software project. 

## Project Analysis:
- **Project Name**: ${analysis.projectName}
- **Frameworks**: ${analysis.framework.join(', ')}
- **File Count**: ${analysis.files.length}
- **Dependencies**: ${Object.keys(analysis.dependencies).length} main dependencies
- **Architecture**: Frontend (${analysis.architecture.frontend.length} files), Backend (${analysis.architecture.backend.length} files)

## Dependencies:
${Object.entries(analysis.dependencies).map(([name, version]) => `- ${name}: ${version}`).join('\n')}

## Key Files:
${analysis.files.slice(0, 10).map(f => `- ${f.relativePath} (${f.functions.length} functions, ${f.components.length} components)`).join('\n')}

Create a comprehensive project overview that includes:

1. **Project Purpose**: What this application does and who it's for
2. **Technology Stack**: Detailed breakdown of frameworks, libraries, and tools used
3. **Architecture Overview**: High-level structure and how components interact
4. **Key Features**: Main functionality and capabilities
5. **Project Structure**: How the codebase is organized
6. **Getting Started**: Brief setup and running instructions

Write this as if explaining to a developer who knows nothing about the project but needs to understand it quickly. Use clear, professional language and include specific technical details where relevant.

Format the response in well-structured Markdown.
`;

    return await this.callOpenAI(prompt);
  }

  private async generateFrontendDocs(analysis: CodebaseAnalysis): Promise<FrontendDocumentation> {
    const frontendFiles = analysis.files.filter(f => 
      f.components.length > 0 || 
      f.type.toString().includes('react') || 
      f.type.toString().includes('vue') ||
      f.relativePath.includes('components') ||
      f.relativePath.includes('pages')
    );

    const componentsPrompt = `
# Frontend Component Documentation Generation

Analyze these React/Frontend components and create detailed documentation:

${frontendFiles.slice(0, 5).map(f => `
## File: ${f.relativePath}
**Components**: ${f.components.map(c => c.name).join(', ')}
**Functions**: ${f.functions.map(fn => fn.name).join(', ')}
**Dependencies**: ${f.dependencies.slice(0, 5).join(', ')}

\`\`\`typescript
${f.content.slice(0, 1000)}...
\`\`\`
`).join('\n')}

For each component, provide:
1. **Purpose**: What the component does and when to use it
2. **Props**: Expected properties and their types
3. **State**: Internal state management
4. **User Interactions**: How users interact with it
5. **Data Flow**: How data flows in and out
6. **Side Effects**: API calls, state updates, etc.

Format as structured JSON that matches the ComponentDocumentation interface.
`;

    const overviewPrompt = `
# Frontend Architecture Overview

Based on this frontend analysis:
- **Total Components**: ${frontendFiles.reduce((acc, f) => acc + f.components.length, 0)}
- **Frameworks**: ${analysis.framework.filter(f => ['React', 'Vue', 'Angular', 'Svelte'].includes(f)).join(', ')}
- **Styling**: CSS, SCSS files detected: ${analysis.files.filter(f => f.type.toString().includes('css')).length}

Create a comprehensive frontend overview covering:
1. Architecture philosophy and patterns used
2. Component hierarchy and organization
3. State management approach
4. Styling methodology
5. Key UI patterns and conventions

Provide detailed technical analysis in Markdown format.
`;

    const [overview, componentsResponse] = await Promise.all([
      this.callOpenAI(overviewPrompt),
      this.callOpenAI(componentsPrompt)
    ]);

    let components: ComponentDocumentation[] = [];
    try {
      const parsed = JSON.parse(componentsResponse);
      components = parsed.components || [];
    } catch {
      // Fallback to basic component analysis
      components = frontendFiles.flatMap(f => 
        f.components.map(c => ({
          name: c.name,
          purpose: `${c.name} component`,
          props: c.props,
          usage: `Used in ${f.relativePath}`,
          interactions: 'User interactions to be documented',
          filePath: f.relativePath
        }))
      );
    }

    return {
      overview,
      components,
      pages: [], // To be implemented based on routing analysis
      styling: 'CSS/SCSS styling system',
      stateManagement: analysis.dependencies['redux'] ? 'Redux' : 
                      analysis.dependencies['zustand'] ? 'Zustand' : 
                      'React State'
    };
  }

  private async generateBackendDocs(analysis: CodebaseAnalysis): Promise<BackendDocumentation> {
    const backendFiles = analysis.files.filter(f => 
      f.routes.length > 0 || 
      f.relativePath.includes('api') ||
      f.relativePath.includes('server') ||
      f.relativePath.includes('controllers')
    );

    const prompt = `
# Backend API Documentation Generation

Analyze these backend files and create comprehensive API documentation:

${backendFiles.slice(0, 5).map(f => `
## File: ${f.relativePath}
**Routes**: ${f.routes.map(r => `${r.method} ${r.path}`).join(', ')}
**Functions**: ${f.functions.map(fn => `${fn.name}(${fn.params.join(', ')})`).join(', ')}
**Database Queries**: ${f.databaseQueries.length}

\`\`\`typescript
${f.content.slice(0, 1000)}...
\`\`\`
`).join('\n')}

Create detailed documentation covering:
1. **API Endpoints**: Purpose, parameters, responses, error handling
2. **Service Functions**: Business logic and data processing
3. **Middleware**: Authentication, validation, logging
4. **Error Handling**: How errors are managed and returned
5. **Database Integration**: How data is accessed and modified

Format the response as structured Markdown with clear sections.
`;

    const response = await this.callOpenAI(prompt);

    const apis: APIEndpoint[] = backendFiles.flatMap(f => 
      f.routes.map(r => ({
        method: r.method,
        path: r.path,
        purpose: `${r.method} endpoint for ${r.path}`,
        parameters: r.params.map(p => ({
          name: p,
          type: 'string',
          required: true,
          description: `${p} parameter`
        })),
        response: 'JSON response',
        errorHandling: 'Standard HTTP error codes',
        filePath: f.relativePath
      }))
    );

    return {
      overview: response,
      apis,
      services: [],
      middleware: [],
      authentication: analysis.dependencies['jsonwebtoken'] ? 'JWT' : 'Custom'
    };
  }

  private async generateDatabaseDocs(analysis: CodebaseAnalysis): Promise<DatabaseDocumentation> {
    const dbFiles = analysis.files.filter(f => 
      f.databaseQueries.length > 0 ||
      f.relativePath.includes('schema') ||
      f.relativePath.includes('models') ||
      f.relativePath.includes('prisma')
    );

    const prompt = `
# Database Documentation Generation

Analyze the database usage in this project:

**Database Types**: ${analysis.database.map(db => db.type).join(', ')}

**Files with Database Queries**:
${dbFiles.slice(0, 5).map(f => `
## File: ${f.relativePath}
**Queries**: ${f.databaseQueries.map(q => `${q.type} - ${q.query.slice(0, 50)}...`).join(', ')}
`).join('\n')}

**Dependencies**:
${Object.keys(analysis.dependencies).filter(dep => 
  ['prisma', 'mongoose', 'sequelize', 'typeorm', 'supabase'].some(db => dep.includes(db))
).join(', ')}

Create comprehensive database documentation covering:
1. **Database Architecture**: Type, hosting, connection details
2. **Schema Overview**: Tables/collections and their relationships
3. **Query Patterns**: How data is accessed and modified
4. **Data Models**: Structure and validation rules
5. **Performance Considerations**: Indexing, optimization

Format as detailed Markdown documentation.
`;

    const response = await this.callOpenAI(prompt);

    return {
      overview: response,
      schema: [],
      queries: dbFiles.flatMap(f => 
        f.databaseQueries.map(q => ({
          type: q.type,
          purpose: `${q.type} operation on ${q.table}`,
          query: q.query,
          usage: `Used in ${q.location}`
        }))
      ),
      relationships: 'Database relationships to be documented'
    };
  }

  private async generateUserFlows(analysis: CodebaseAnalysis): Promise<UserFlow[]> {
    const prompt = `
# User Flow Documentation Generation

Based on this application analysis, create detailed user flows:

**Frontend Components**: ${analysis.files.filter(f => f.components.length > 0).map(f => 
  f.components.map(c => c.name).join(', ')
).join(', ')}

**API Endpoints**: ${analysis.files.flatMap(f => f.routes).map(r => `${r.method} ${r.path}`).join(', ')}

**Key Features Detected**:
${analysis.framework.includes('React') ? '- React-based user interface' : ''}
${analysis.dependencies['next'] ? '- Next.js routing and pages' : ''}
${Object.keys(analysis.dependencies).some(d => d.includes('auth')) ? '- Authentication system' : ''}

Create 3-5 major user flows covering:
1. **User Registration/Login** (if authentication detected)
2. **Main Application Flow** (primary user journey)
3. **Data Management** (CRUD operations)
4. **Error Handling Flow** (what happens when things go wrong)

For each flow, provide:
- Clear step-by-step user actions
- Which frontend components are involved
- What backend APIs are called
- Database operations that occur
- Expected outcomes

Format as structured JSON matching the UserFlow interface.
`;

    const response = await this.callOpenAI(prompt);

    try {
      const parsed = JSON.parse(response);
      return parsed.userFlows || parsed || [];
    } catch {
      return [{
        name: 'Main User Flow',
        description: 'Primary application workflow',
        steps: [{
          action: 'User interacts with application',
          component: 'Main component',
          result: 'Expected outcome'
        }],
        diagram: await this.mermaidGenerator.generateUserFlowDiagram('basic flow')
      }];
    }
  }

  private async generateAPIDocumentation(analysis: CodebaseAnalysis): Promise<APIDocumentation[]> {
    const apiRoutes = analysis.files.flatMap(f => f.routes);
    
    if (apiRoutes.length === 0) return [];

    const prompt = `
# API Documentation Generation

Create OpenAPI-style documentation for these endpoints:

${apiRoutes.map(route => `
**${route.method} ${route.path}**
- Handler: ${route.handler}
- Middleware: ${route.middleware.join(', ')}
- Parameters: ${route.params.join(', ')}
`).join('\n')}

For each endpoint, provide:
1. **Purpose**: What this endpoint does
2. **Authentication**: Required auth (if any)
3. **Parameters**: Query params, path params, body
4. **Request Examples**: Sample requests
5. **Response Examples**: Success and error responses
6. **Error Codes**: Possible HTTP status codes

Format as structured JSON matching the APIDocumentation interface.
`;

    const response = await this.callOpenAI(prompt);

    try {
      const parsed = JSON.parse(response);
      return parsed.apis || parsed || [];
    } catch {
      return apiRoutes.map(route => ({
        endpoint: route.path,
        method: route.method,
        description: `${route.method} endpoint for ${route.path}`,
        parameters: route.params.map(p => ({
          name: p,
          type: 'string',
          required: true,
          description: `${p} parameter`
        })),
        responses: [{
          status: 200,
          description: 'Success',
          schema: 'JSON response'
        }],
        examples: [{
          title: 'Basic Usage',
          request: `${route.method} ${route.path}`,
          response: '{ "status": "success" }'
        }]
      }));
    }
  }

  private async generateDeploymentGuide(analysis: CodebaseAnalysis): Promise<string> {
    const prompt = `
# Deployment Guide Generation

Create a comprehensive deployment guide for this project:

**Detected Deployment Platforms**:
${analysis.deployment.map(d => `- ${d.platform}`).join('\n')}

**Build Scripts**:
${Object.entries(analysis.scripts).map(([name, script]) => `- ${name}: ${script}`).join('\n')}

**Environment Dependencies**:
${Object.keys(analysis.dependencies).slice(0, 10).join(', ')}

**Database Requirements**:
${analysis.database.map(db => `- ${db.type}`).join('\n')}

Create step-by-step deployment instructions covering:
1. **Prerequisites**: Required tools and accounts
2. **Environment Setup**: Environment variables and configuration
3. **Build Process**: How to build the application
4. **Deployment Steps**: Platform-specific deployment instructions
5. **Post-Deployment**: Verification and monitoring
6. **Troubleshooting**: Common deployment issues

Include specific commands and configuration examples where applicable.
Format as detailed Markdown documentation.
`;

    return await this.callOpenAI(prompt);
  }

  private async generateTroubleshooting(analysis: CodebaseAnalysis): Promise<string> {
    const prompt = `
# Troubleshooting Guide Generation

Create a comprehensive troubleshooting guide based on this project structure:

**Technology Stack**: ${analysis.framework.join(', ')}
**Dependencies**: ${Object.keys(analysis.dependencies).slice(0, 15).join(', ')}
**File Types**: ${[...new Set(analysis.files.map(f => f.type))].join(', ')}

Create troubleshooting documentation covering:
1. **Common Setup Issues**: Problems during initial setup
2. **Build Errors**: Compilation and bundling issues
3. **Runtime Errors**: Application crashes and exceptions
4. **Performance Issues**: Slow loading, memory problems
5. **Database Connectivity**: Connection and query issues
6. **API Integration**: External service problems
7. **Deployment Issues**: Production deployment problems

For each issue category, provide:
- Symptoms and error messages
- Root cause analysis
- Step-by-step solutions
- Prevention strategies

Format as organized Markdown with clear sections and code examples.
`;

    return await this.callOpenAI(prompt);
  }

  private async callOpenAI(prompt: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert technical writer and software architect. Create comprehensive, accurate, and well-structured documentation. Focus on practical details that help developers understand and work with the codebase. Use clear, professional language and include specific technical details where relevant.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.3
      });

      return response.choices[0]?.message?.content || 'Documentation generation failed';
    } catch (error) {
      console.error('OpenAI API Error:', error);
      return `Error generating documentation: ${error}`;
    }
  }
}