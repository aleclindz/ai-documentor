import OpenAI from 'openai';
import { marked } from 'marked';
import { writeFileSync, mkdirSync, existsSync, statSync, unlinkSync, readdirSync, renameSync, rmSync } from 'fs';
import { join } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { CodebaseAnalysis, FileInfo, FunctionInfo, ComponentInfo, RouteInfo } from '../analyzers/CodebaseAnalyzer.js';
import { Config } from '../utils/Config.js';
import { MermaidGenerator } from './MermaidGenerator.js';
import { WorkflowGeneratorFactory } from './workflows/index.js';
import { ReactFrontendGenerator } from './ReactFrontendGenerator.js';
import { slug } from '../utils/slug.js';

export interface GeneratedDocumentation {
  overview: string;
  gettingStarted?: string;
  userGuide?: string;
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
  featuresAndFunctionality: string;
  components: ComponentDocumentation[];
  pages: PageDocumentation[];
  styling: string;
  stateManagement: string;
}

export interface ComponentDocumentation {
  name: string;
  slug: string;
  purpose: string;
  props: string[];
  usage: string;
  interactions: string;
  filePath: string;
  uiEvents?: Array<{event: string; description: string; apiEndpointSlug?: string}>;
}

export interface PageDocumentation {
  route: string;
  name: string;
  slug: string;
  purpose: string;
  components: string[];
  componentsMarkdown: string;
  navigationLinks: string[];
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
  slug: string;
  purpose: string;
  parameters: Parameter[];
  response: string;
  errorHandling: string;
  filePath: string;
  serviceFunction?: string;
  linkedComponents?: string[];
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
  slug: string;
  description: string;
  steps: UserFlowStep[];
  diagram?: string;
}

export interface UserFlowStep {
  action: string;
  componentSlug?: string;
  event?: string;
  apiSlug?: string;
  serviceFunction?: string;
  dbModel?: string;
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
  private workflowFactory: WorkflowGeneratorFactory;

  constructor(config: any) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey
    });
    this.mermaidGenerator = new MermaidGenerator();
    this.workflowFactory = new WorkflowGeneratorFactory({
      openaiApiKey: config.openaiApiKey,
      debug: config.debug
    });
  }

  async generate(analysis: CodebaseAnalysis, progressCallback?: (status: string) => void): Promise<GeneratedDocumentation> {
    progressCallback?.('📋 Generating project overview...');
    console.log(`🔍 Project analysis: ${analysis.files.length} files, frameworks: ${analysis.framework.join(', ')}`);
    const overview = await this.generateOverview(analysis);
    console.log('✅ Project overview generated successfully');
    
    // Only generate sections that are relevant to this codebase
    let frontend, backend, database, userFlows, apiDocumentation, deploymentGuide;
    
    if (analysis.relevantSections.frontend) {
      progressCallback?.('🎨 Analyzing frontend components...');
      frontend = await this.generateFrontendDocs(analysis);
    }
    
    if (analysis.relevantSections.backend) {
      progressCallback?.('⚙️  Documenting backend services...');
      backend = await this.generateBackendDocs(analysis);
    }
    
    if (analysis.relevantSections.database) {
      progressCallback?.('🗄️  Analyzing database structure...');
      database = await this.generateDatabaseDocs(analysis);
    }
    
    if (analysis.relevantSections.userWorkflows) {
      progressCallback?.('🔄 Generating user workflows...');
      userFlows = await this.generateUserWorkflows(analysis);
    }
    
    progressCallback?.('📊 Creating architecture diagrams...');
    const architectureDiagram = await this.mermaidGenerator.generateArchitectureDiagram(analysis);
    
    if (analysis.relevantSections.api) {
      progressCallback?.('📡 Documenting API endpoints...');
      apiDocumentation = await this.generateAPIDocumentation(analysis);
    }
    
    if (analysis.relevantSections.deployment) {
      progressCallback?.('🚀 Writing deployment guide...');
      deploymentGuide = await this.generateDeploymentGuide(analysis);
    }
    
    progressCallback?.('🔧 Creating troubleshooting guide...');
    const troubleshooting = await this.generateTroubleshooting(analysis);

    // Generate Getting Started guide
    progressCallback?.('🚀 Creating getting started guide...');
    const gettingStarted = await this.generateGettingStartedGuide(analysis);

    // Generate User Guide
    progressCallback?.('📖 Creating comprehensive user guide...');
    const userGuide = await this.generateUserGuide(analysis, frontend);

    const documentation: GeneratedDocumentation = {
      overview,
      gettingStarted,
      userGuide,
      frontend,
      backend,
      database,
      userFlows,
      architectureDiagram,
      apiDocumentation,
      deploymentGuide,
      troubleshooting
    };

    // Write documentation to files
    await this.saveDocumentationFiles(documentation);

    return documentation;
  }

  private async generateOverview(analysis: CodebaseAnalysis): Promise<string> {
    const prompt = `
# Project Overview Documentation for End Users

You are writing documentation for a software project that will be read by both technical and non-technical users. Your goal is to create a welcoming, user-focused overview that explains what this application does and why someone would want to use it.

## Project Analysis:
- **Project Name**: ${analysis.projectName}
- **Technology Stack**: ${analysis.framework.join(', ')}
- **File Count**: ${analysis.files.length} files
- **Main Dependencies**: ${Object.keys(analysis.dependencies).slice(0, 8).join(', ')}
- **Architecture**: ${analysis.architecture.frontend.length} frontend files, ${analysis.architecture.backend.length} backend files

## Key Dependencies:
${Object.entries(analysis.dependencies).slice(0, 10).map(([name, version]) => `- ${name}: ${version}`).join('\n')}

## Main Application Files:
${analysis.files.slice(0, 8).map(f => `- ${f.relativePath} (${f.functions.length} functions, ${f.components.length} components)`).join('\n')}

Create a user-friendly project overview in **1-2 paragraphs** that covers:

## What This Application Does
Write as if explaining to a friend or colleague who doesn't know programming. Focus on:
- What problem does this solve for users?
- What can people do with this application?
- Who would find this useful?
- What makes this application special or different?

## How It Works (Simple Explanation)  
Explain the basic concept without technical jargon:
- What happens when someone uses the application?
- What is the user experience like?
- How does information flow through the system?

## Key Features & Capabilities
List the main things users can do:
- Primary features and functionality
- User workflows and interactions
- Types of data or content handled
- Main user benefits

## Technology Overview (Friendly)
Briefly explain the technical foundation in accessible terms:
- What frameworks/technologies power the application
- Why these technologies were chosen (benefits to users)
- How the different parts work together

Write in a warm, welcoming tone that makes the project approachable to anyone reading the documentation. Avoid technical jargon and focus on user value and practical benefits. Use clear, conversational language while still being informative and professional.

Format the response as well-structured Markdown with proper headers and engaging content.
`;

    return await this.callOpenAI(prompt);
  }

  private async generateFrontendDocs(analysis: CodebaseAnalysis): Promise<FrontendDocumentation> {
    // Check if this is a React project to use React-specific generator
    const isReactProject = analysis.framework.includes('React') || 
                           analysis.dependencies.react || 
                           analysis.dependencies['next'];

    if (isReactProject) {
      console.log('🎨 Using React-optimized frontend documentation generator...');
      const reactGenerator = new ReactFrontendGenerator(analysis);
      const reactFrontendDocs = await reactGenerator.generateFrontendDocs();
      
      // Convert ReactFrontendGenerator output to DocumentationGenerator format
      return {
        overview: reactFrontendDocs.overview,
        featuresAndFunctionality: this.generateReactFeaturesAndFunctionality(reactFrontendDocs),
        components: this.convertReactComponentsToDocFormat(reactFrontendDocs.pages),
        pages: this.convertReactPagesToDocFormat(reactFrontendDocs.pages),
        styling: this.detectStylingSystem(analysis),
        stateManagement: this.detectStateManagement(analysis)
      };
    }

    // Fallback to generic frontend documentation for non-React projects
    return this.generateGenericFrontendDocs(analysis);
  }
  
  private generateReactFeaturesAndFunctionality(reactDocs: any): string {
    let features = `# Frontend Features & Functionality\n\nThis React application provides a comprehensive user interface with ${reactDocs.pages.length} distinct pages and interactive components.\n\n`;
    
    // Add pages overview
    features += `## Pages Overview\n\n`;
    reactDocs.pages.forEach((pageDoc: any) => {
      features += `### ${pageDoc.page.name}\n`;
      features += `**Route**: \`${pageDoc.page.route}\`\n\n`;
      features += `${pageDoc.page.description}\n\n`;
      
      if (pageDoc.page.components.length > 0) {
        features += `**Interactive Components**: ${pageDoc.page.components.length}\n`;
        const interactiveComponents = pageDoc.page.components.filter((c: any) => 
          ['button', 'link', 'form', 'input'].includes(c.type)
        );
        if (interactiveComponents.length > 0) {
          features += `- ${interactiveComponents.map((c: any) => c.text || c.name).join(', ')}\n`;
        }
      }
      features += '\n';
    });
    
    // Add navigation flow
    if (reactDocs.navigation.crossReferences.length > 0) {
      features += `## Navigation Flow\n\n`;
      features += `The application provides seamless navigation between pages through:\n\n`;
      reactDocs.navigation.crossReferences.forEach((ref: any) => {
        features += `- **${ref.trigger}** navigates from [${ref.from}](#${ref.from}) to [${ref.to}](#${ref.to})\n`;
      });
      features += '\n';
    }
    
    return features;
  }
  
  private convertReactComponentsToDocFormat(pages: any[]): ComponentDocumentation[] {
    const components: ComponentDocumentation[] = [];
    
    pages.forEach(pageDoc => {
      pageDoc.page.components.forEach((component: any) => {
        components.push({
          name: component.name,
          slug: slug(component.name),
          purpose: component.description,
          props: component.props.map((p: any) => `${p.name}: ${p.type}`),
          usage: `Used in ${pageDoc.page.name} page`,
          interactions: component.onClick ? `Click handler: ${component.onClick}` : 'No interactions defined',
          filePath: component.filePath,
          uiEvents: component.onClick ? [{
            event: 'click',
            description: `User clicks ${component.text || component.name}`,
            apiEndpointSlug: component.navigatesTo ? slug(component.navigatesTo) : undefined
          }] : []
        });
      });
    });
    
    return components;
  }
  
  private convertReactPagesToDocFormat(pages: any[]): any[] {
    return pages.map(pageDoc => ({
      route: pageDoc.page.route,
      name: pageDoc.page.name,
      slug: pageDoc.page.slug,
      purpose: pageDoc.page.description,
      components: pageDoc.page.components.map((c: any) => c.name),
      componentsMarkdown: pageDoc.componentsMarkdown,
      navigationLinks: pageDoc.navigationLinks,
      dataFlow: 'Data flows through React props and state management'
    }));
  }
  
  private detectStylingSystem(analysis: CodebaseAnalysis): string {
    if (analysis.dependencies['styled-components']) return 'Styled Components';
    if (analysis.dependencies['@emotion/react']) return 'Emotion CSS-in-JS';
    if (analysis.dependencies['tailwindcss']) return 'Tailwind CSS';
    if (analysis.files.some(f => f.relativePath.includes('.scss') || f.relativePath.includes('.sass'))) return 'SCSS/Sass';
    if (analysis.files.some(f => f.relativePath.includes('.css'))) return 'CSS';
    return 'CSS/SCSS styling system';
  }
  
  private detectStateManagement(analysis: CodebaseAnalysis): string {
    if (analysis.dependencies['redux']) return 'Redux';
    if (analysis.dependencies['zustand']) return 'Zustand';
    if (analysis.dependencies['recoil']) return 'Recoil';
    if (analysis.dependencies['@tanstack/react-query']) return 'React Query with React State';
    return 'React State (useState, useContext)';
  }
  
  private async generateGenericFrontendDocs(analysis: CodebaseAnalysis): Promise<FrontendDocumentation> {
    const frontendFiles = analysis.files.filter(f => 
      f.components.length > 0 || 
      f.type.toString().includes('react') || 
      f.type.toString().includes('vue') ||
      f.relativePath.includes('components') ||
      f.relativePath.includes('pages')
    );

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

Provide detailed technical analysis in Markdown format with proper headers and subheaders.
`;

    const featuresPrompt = `
# Frontend Features & Functionality Analysis

Create comprehensive user-focused documentation covering:

## 1. Core Features Overview
- What can users do with this application?
- What are the main features and capabilities?

## 2. User Interface Components  
- What buttons, forms, and interactive elements exist?
- How do users interact with different parts of the interface?

## 3. Navigation & User Experience
- How do users move between different sections?
- What navigation patterns are used?

Focus on user-visible functionality. Use clear, non-technical language.
Format with proper Markdown headers, subheaders, bullet points, and clear structure.
`;

    const [overview, featuresAndFunctionality] = await Promise.all([
      this.callOpenAI(overviewPrompt),
      this.callOpenAI(featuresPrompt)
    ]);

    // Fallback component documentation
    const components: ComponentDocumentation[] = frontendFiles.flatMap(f => 
      f.components.map(c => ({
        name: c.name,
        slug: slug(c.name),
        purpose: `${c.name} component`,
        props: c.props,
        usage: `Used in ${f.relativePath}`,
        interactions: 'User interactions to be documented',
        filePath: f.relativePath
      }))
    );

    return {
      overview,
      featuresAndFunctionality,
      components,
      pages: [],
      styling: this.detectStylingSystem(analysis),
      stateManagement: this.detectStateManagement(analysis)
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

Analyze these backend files and create comprehensive API documentation with cross-linking:

${backendFiles.slice(0, 5).map(f => `
## File: ${f.relativePath}
**Routes**: ${f.routes.map(r => `${r.method} ${r.path}`).join(', ')}
**Functions**: ${f.functions.map(fn => `${fn.name}(${fn.params.join(', ')})`).join(', ')}
**Database Queries**: ${f.databaseQueries.length}

\`\`\`typescript
${f.content.slice(0, 1000)}...
\`\`\`
`).join('\n')}

## UI Component → API Mapping:
${analysis.links.map(l => `- ${l.uiComponent}.${l.event} -> ${l.apiEndpoint} (${l.serviceFunction || 'handler TBD'})`).join('\n')}

For each API endpoint, include:
1. **slug**: URL-friendly identifier (e.g., "get-users", "post-login")
2. **serviceFunction**: The handler function name
3. **linkedComponents**: Array of component slugs that call this API
4. **Purpose**: What this endpoint does
5. **Parameters**: Request parameters and body
6. **Response**: Response structure and examples
7. **Error Handling**: Error codes and messages
8. **Database Operations**: What data is accessed/modified

Format the response as structured Markdown with clear sections and proper anchor links.
`;

    const response = await this.callOpenAI(prompt);

    const apis: APIEndpoint[] = backendFiles.flatMap(f => 
      f.routes.map(r => ({
        method: r.method,
        path: r.path,
        slug: slug(`${r.method}-${r.path}`),
        purpose: `${r.method} endpoint for ${r.path}`,
        parameters: r.params.map(p => ({
          name: p,
          type: 'string',
          required: true,
          description: `${p} parameter`
        })),
        response: 'JSON response',
        errorHandling: 'Standard HTTP error codes',
        filePath: f.relativePath,
        serviceFunction: r.handler
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

  private async generateUserWorkflows(analysis: CodebaseAnalysis): Promise<UserFlow[]> {
    // Use the new workflow generator factory to determine the best generator
    if (this.config.debug) {
      const info = this.workflowFactory.getGeneratorInfo(analysis);
      console.log(`🔄 Using ${info.name} workflow generator: ${info.reason}`);
    }
    
    return await this.workflowFactory.generateWorkflows(analysis);
  }



  private async generateAPIDocumentation(analysis: CodebaseAnalysis): Promise<APIDocumentation[]> {
    const apiRoutes = analysis.files.flatMap(f => f.routes);
    
    if (apiRoutes.length === 0) return [];

    // Group routes by functionality for better organization
    const routesByFunction = this.groupRoutesByFunction(apiRoutes);
    
    const prompt = `
# Enhanced API Documentation Generation

Create comprehensive API documentation with examples and cross-references for this ${analysis.framework.join(', ')} application.

## Application Context
- **Project**: ${analysis.projectName}
- **Framework**: ${analysis.framework.join(', ')}
- **Authentication**: ${this.detectAuthPatterns(analysis)}
- **Database**: ${this.detectDatabasePatterns(analysis)}

## API Routes Detected (${apiRoutes.length} endpoints)
${Object.entries(routesByFunction).map(([category, routes]) => `
### ${category}
${routes.map((route: any) => `
- **${route.method} ${route.path}**  
  Handler: \`${route.handler}\`  
  Middleware: ${route.middleware.length > 0 ? route.middleware.join(', ') : 'None'}  
  File: \`${route.filePath || 'Unknown'}\`
`).join('')}
`).join('\n')}

Create API documentation with the following enhanced structure for EACH endpoint:

## Overview
Brief description of the API architecture and authentication approach.

${apiRoutes.map(route => `
## ${route.method.toUpperCase()} ${route.path}

**Description**: [What this endpoint does and why users would call it]

**Authentication**: [Required authentication - API key, Bearer token, session, or none]

**Parameters**:
\`\`\`typescript
// Path Parameters
${route.params.length > 0 ? route.params.map(p => `${p}: string // Description of ${p}`).join('\n') : '// None'}

// Query Parameters  
// [List any query parameters]

// Request Body (if applicable)
interface RequestBody {
  // Define the expected request structure
}
\`\`\`

**Example Request**:
\`\`\`bash
curl -X ${route.method.toUpperCase()} "${analysis.projectName || 'localhost:3000'}${route.path}" \\
  -H "Content-Type: application/json" \\
  ${this.detectAuthPatterns(analysis) ? `-H "Authorization: Bearer YOUR_TOKEN" \\` : ''}
  ${route.method !== 'GET' ? `-d '{"example": "data"}'` : ''}
\`\`\`

**Response Examples**:
\`\`\`json
// Success (200)
{
  "success": true,
  "data": {
    // Response structure based on endpoint purpose
  }
}

// Error (400/401/404/500)
{
  "error": "Error message",  
  "details": "Additional error context"
}
\`\`\`

**Related Components**: [Link to frontend components that call this API]

---
`).join('\n')}

Focus on:
1. Real, practical examples that developers can copy-paste
2. Clear explanation of what each endpoint does from a user perspective
3. Proper error handling documentation
4. Cross-references to frontend components that use each API
5. Authentication requirements clearly stated
6. Request/response schemas that match the actual application structure

Make this documentation that a developer could use to integrate with the API immediately.
Use the actual detected routes and patterns from the codebase analysis.
`;

    const response = await this.callOpenAI(prompt);

    try {
      const parsed = JSON.parse(response);
      return parsed.apis || parsed || [];
    } catch {
      // Enhanced fallback with better structure
      return apiRoutes.map(route => ({
        endpoint: route.path,
        method: route.method,
        description: this.generateEndpointDescription(route),
        parameters: route.params.map(p => ({
          name: p,
          type: 'string',
          required: true,
          description: `${p} parameter for ${route.path}`
        })),
        responses: [
          {
            status: 200,
            description: 'Success',
            schema: '{"success": true, "data": {}}'
          },
          {
            status: 400,
            description: 'Bad Request',
            schema: '{"error": "Invalid parameters"}'
          }
        ],
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

  private async handleExistingOutput(outputDir: string): Promise<boolean> {
    if (!existsSync(outputDir)) {
      return true; // No conflict, proceed
    }

    const stats = statSync(outputDir);
    let existingItems: string[] = [];
    let conflictType = '';

    if (stats.isDirectory()) {
      try {
        existingItems = readdirSync(outputDir);
        conflictType = 'directory';
      } catch (error) {
        console.log(chalk.red('❌ Error reading existing docs directory:', error));
        return false;
      }
    } else {
      conflictType = 'file';
      existingItems = [outputDir];
    }

    // Skip prompts if --force flag is set or running in CI
    if (this.config.force || process.env.CI) {
      await this.createBackup(outputDir, stats.isDirectory());
      return true;
    }

    // Show what exists
    console.log(chalk.yellow(`\n⚠️  Found existing ${conflictType}: ${outputDir}`));
    if (conflictType === 'directory' && existingItems.length > 0) {
      console.log(chalk.gray(`   Contains: ${existingItems.slice(0, 5).join(', ')}${existingItems.length > 5 ? '...' : ''}`));
    }

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'How would you like to proceed?',
        choices: [
          { name: '🔄 Create backup and overwrite', value: 'backup' },
          { name: '❌ Cancel generation', value: 'cancel' },
          { name: '⚡ Overwrite without backup', value: 'overwrite' }
        ],
        default: 'backup'
      }
    ]);

    switch (action) {
      case 'backup':
        await this.createBackup(outputDir, stats.isDirectory());
        return true;
      case 'overwrite':
        if (stats.isDirectory()) {
          // Remove directory contents but keep the directory
          this.clearDirectory(outputDir);
        } else {
          unlinkSync(outputDir);
        }
        return true;
      case 'cancel':
        return false;
      default:
        return false;
    }
  }

  private async createBackup(outputPath: string, isDirectory: boolean): Promise<void> {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const backupPath = `${outputPath}.backup.${dateStr}-${timeStr}`;
    
    try {
      console.log(chalk.blue(`💾 Creating backup: ${backupPath}`));
      renameSync(outputPath, backupPath);
      console.log(chalk.green(`✅ Backup created successfully`));
    } catch (error) {
      console.log(chalk.red('❌ Failed to create backup:', error));
      throw error;
    }
  }

  private clearDirectory(dirPath: string): void {
    try {
      const files = readdirSync(dirPath);
      for (const file of files) {
        const filePath = join(dirPath, file);
        rmSync(filePath, { recursive: true, force: true });
      }
    } catch (error) {
      console.log(chalk.red('❌ Error clearing directory:', error));
      throw error;
    }
  }

  private async saveDocumentationFiles(documentation: GeneratedDocumentation): Promise<void> {
    const outputDir = this.config.outputDir || './docs';
    
    // Check if output directory/file exists and handle accordingly
    const shouldProceed = await this.handleExistingOutput(outputDir);
    if (!shouldProceed) {
      console.log(chalk.yellow('📄 Documentation generation cancelled by user.'));
      return;
    }
    
    // Create output directory if it doesn't exist
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Save each section as markdown files (only if they exist)
    writeFileSync(join(outputDir, 'overview.md'), documentation.overview);
    
    if (documentation.gettingStarted) {
      writeFileSync(join(outputDir, 'getting-started.md'), documentation.gettingStarted);
    }
    
    if (documentation.userGuide) {
      writeFileSync(join(outputDir, 'user-guide.md'), documentation.userGuide);
    }
    
    if (documentation.frontend) {
      writeFileSync(join(outputDir, 'frontend.md'), this.formatFrontendDocs(documentation.frontend));
    }
    
    if (documentation.backend) {
      writeFileSync(join(outputDir, 'backend.md'), this.formatBackendDocs(documentation.backend));
    }
    
    if (documentation.database) {
      writeFileSync(join(outputDir, 'database.md'), this.formatDatabaseDocs(documentation.database));
    }
    
    if (documentation.userFlows && documentation.userFlows.length > 0) {
      writeFileSync(join(outputDir, 'user-flows.md'), this.formatUserFlows(documentation.userFlows));
    }
    
    writeFileSync(join(outputDir, 'architecture.md'), documentation.architectureDiagram);
    
    if (documentation.apiDocumentation) {
      writeFileSync(join(outputDir, 'api.md'), this.formatAPIDocumentation(documentation.apiDocumentation));
    }
    
    if (documentation.deploymentGuide) {
      writeFileSync(join(outputDir, 'deployment.md'), documentation.deploymentGuide);
    }
    
    writeFileSync(join(outputDir, 'troubleshooting.md'), documentation.troubleshooting);

    // Save complete documentation as JSON for server use
    writeFileSync(join(outputDir, 'documentation.json'), JSON.stringify(documentation, null, 2));

    // Create navigation README
    const readmeContent = this.generateNavigationReadme(documentation);
    writeFileSync(join(outputDir, 'README.md'), readmeContent);
    
    // Show completion message
    const fileCount = readdirSync(outputDir).length;
    console.log(chalk.green(`📝 Successfully wrote ${fileCount} documentation files to ${outputDir}/`));
  }

  private formatFrontendDocs(frontend: FrontendDocumentation): string {
    return `# Frontend Documentation

${frontend.featuresAndFunctionality}

---

## Technical Architecture

${frontend.overview}

## Components

${frontend.components.map(c => `### ${c.name} {#${c.slug}}

${c.purpose}

**Props:** ${c.props.join(', ')}

**Usage:** ${c.usage}

${c.uiEvents && c.uiEvents.length > 0 ? `
**Events → Backend:**
${c.uiEvents.map(event => `- \`${event.event}\` ➜ [${event.apiEndpointSlug}](backend.md#${event.apiEndpointSlug}) - ${event.description}`).join('\n')}
` : ''}
`).join('\n')}`;
  }

  private formatBackendDocs(backend: BackendDocumentation): string {
    return `# Backend Documentation

${backend.overview}

## API Endpoints

${backend.apis.map(api => `### ${api.method} ${api.path} {#${api.slug}}

${api.purpose}

**Service Function:** \`${api.serviceFunction}\`

${api.linkedComponents && api.linkedComponents.length > 0 ? `
**Triggered by UI Components:**
${api.linkedComponents.map(componentSlug => `- [${componentSlug}](frontend.md#${componentSlug})`).join('\n')}
` : ''}

**Parameters:**
${api.parameters.map(p => `- **${p.name}** (${p.type}${p.required ? ', required' : ', optional'}): ${p.description}`).join('\n')}

**Response:** ${api.response}

**Error Handling:** ${api.errorHandling}

---
`).join('\n')}`;
  }

  private formatDatabaseDocs(database: DatabaseDocumentation): string {
    return `# Database Documentation\n\n${database.overview}\n\n## Schema\n\n${database.schema.map(table => `### ${table.name}\n${table.purpose}\n`).join('\n')}\n\n## Queries\n\n${database.queries.map(q => `### ${q.type} Query\n${q.purpose}\n\`\`\`sql\n${q.query}\n\`\`\``).join('\n\n')}`;
  }

  private formatUserFlows(userFlows: UserFlow[]): string {
    return `# User Flows

${userFlows.map(flow => `## ${flow.name} {#${flow.slug}}

**Description:** ${flow.description}

**Steps:**
${flow.steps.map((step, i) => `${i + 1}. **${step.action}**
   ${step.componentSlug ? `- **UI Component:** [${step.componentSlug}](frontend.md#${step.componentSlug})` : ''}
   ${step.event ? `- **Event:** \`${step.event}\`` : ''}
   ${step.apiSlug ? `- **API Call:** [${step.apiSlug}](backend.md#${step.apiSlug})` : ''}
   ${step.serviceFunction ? `- **Service:** \`${step.serviceFunction}\`` : ''}
   ${step.dbModel ? `- **Database:** \`${step.dbModel}\`` : ''}
   - **Result:** ${step.result}
`).join('\n')}

---
`).join('\n')}`;
  }

  private formatAPIDocumentation(apis: APIDocumentation[]): string {
    return `# API Documentation\n\n${apis.map(api => `## ${api.method} ${api.endpoint}\n\n${api.description}\n\n**Parameters:**\n${api.parameters.map(p => `- ${p.name}: ${p.type} - ${p.description}`).join('\n')}\n`).join('\n')}`;
  }

  private generateNavigationReadme(documentation: GeneratedDocumentation): string {
    const projectName = documentation.overview.match(/# (.*)/)?.[1] || 'Project Documentation';
    
    return `# ${projectName}

> **${projectName}** - ${this.extractProjectDescription(documentation.overview)}

## 🚀 Quick Navigation

### For Users
${documentation.userGuide ? `- [**User Guide**](user-guide.md) - Complete guide to using ${projectName}` : ''}
${documentation.gettingStarted ? `- [**Getting Started**](getting-started.md) - Setup and first steps` : ''}
${documentation.userFlows && documentation.userFlows.length > 0 ? `- [**User Workflows**](user-flows.md) - Step-by-step task guides` : ''}

### For Developers
${documentation.apiDocumentation ? `- [**API Reference**](api.md) - Complete API documentation` : ''}
${documentation.database ? `- [**Database Schema**](database.md) - Data structure and relationships` : ''}
- [**Architecture Overview**](architecture.md) - System design and components
${documentation.frontend ? `- [**Frontend Guide**](frontend.md) - UI components and pages` : ''}
${documentation.backend ? `- [**Backend Services**](backend.md) - Server-side functionality` : ''}

### Reference
- [**Troubleshooting**](troubleshooting.md) - Common issues and solutions
${documentation.deploymentGuide ? `- [**Deployment**](deployment.md) - Production deployment guide` : ''}

## 📖 Documentation Overview

This documentation is organized around user workflows and developer needs:

### User-Focused Documentation
- **Pages & Features** - What users see and can do on each page
- **Workflows** - Step-by-step guides for common tasks  
- **Feature Explanations** - How each feature works from the user's perspective

### Developer-Focused Documentation
- **API Endpoints** - Complete request/response documentation with examples
- **Component Architecture** - How UI components interact with backend services
- **Database Operations** - Table structures and data flow
- **Integration Guides** - External service connections and configurations

## 🔗 Cross-Reference System

This documentation includes extensive cross-linking between:
- User actions → UI components → API endpoints → Database operations
- Frontend features → Backend services → Data storage
- User workflows → Technical implementation → Database queries

Navigate by clicking on any linked component, API, or database reference to jump directly to its documentation.

## 📝 Key Features Documented

${this.generateFeaturesList(documentation)}

## 🛠️ CLI Commands

- \`ai-documentor\` - Generate fresh documentation from your codebase
- \`ai-documentor view\` - Start documentation server and view in browser
- \`ai-documentor --force\` - Regenerate without prompts

## 🔗 Cross-References

This documentation includes extensive cross-linking between:
- User flows → UI components → API endpoints → Database operations
- Frontend components with their backend API calls
- API endpoints with the components that trigger them
- Complete traceability from user action to data persistence

Navigate by clicking on any linked component, API, or database reference to jump directly to its documentation.
`;
  }

  private async generateGettingStartedGuide(analysis: CodebaseAnalysis): Promise<string> {
    const projectType = analysis.framework.includes('React') || analysis.framework.includes('Next.js') ? 'web application' : 
                       analysis.framework.includes('Express') ? 'API service' : 'application';
    
    const hasAuth = analysis.files.some(f => 
      f.content.includes('auth') || f.content.includes('login') || f.content.includes('session')
    );
    
    const hasDashboard = analysis.files.some(f => 
      f.relativePath.toLowerCase().includes('dashboard') || f.content.includes('dashboard')
    );
    
    const prompt = `
# Getting Started Guide Generation

Create a comprehensive getting started guide for this ${projectType}:

## Project Analysis
- **Name**: ${analysis.projectName}
- **Framework**: ${analysis.framework.join(', ')}
- **Has Authentication**: ${hasAuth}
- **Has Dashboard**: ${hasDashboard}
- **Dependencies**: ${Object.keys(analysis.dependencies).slice(0, 10).join(', ')}

## Key Files Detected
${analysis.files.filter(f => 
  f.relativePath.includes('page') || 
  f.relativePath.includes('component') || 
  f.relativePath.includes('api')
).slice(0, 8).map(f => `- ${f.relativePath}: ${f.components.length} components, ${f.routes.length} routes`).join('\n')}

Create a Getting Started guide with this structure:

# Getting Started with ${analysis.projectName}

## Welcome to [Project Name]
Brief explanation of what this application does and who it's for.

## 🚀 Quick Start (5 Minutes)
Step-by-step instructions to get users up and running:
${hasAuth ? `
### 1. Create Your Account
1. Visit the application
2. Click **Sign Up**
3. Enter email and password
4. Verify account (if needed)

### 2. First Login
1. Sign in with credentials
2. Complete any onboarding steps
` : ''}
${hasDashboard ? `
### 3. Navigate to Dashboard
1. Access your main dashboard
2. Familiarize yourself with the interface
3. Check available features
` : ''}

### ${hasAuth ? '4' : '3'}. Start Using Key Features
Based on the detected components and pages, provide 2-3 most important first actions.

## 📋 Detailed Setup Guide
More comprehensive setup instructions including:
- System requirements
- Browser compatibility
- Initial configuration steps
- Common setup issues

## 🎯 Next Steps
Guide users to the most important features and documentation sections.

Make this practical and actionable with specific steps users can follow immediately.
Use friendly, encouraging language that reduces friction for new users.
Focus on getting users to their first success quickly.
`;

    return await this.callOpenAI(prompt);
  }

  private async generateUserGuide(analysis: CodebaseAnalysis, frontend?: any): Promise<string> {
    if (!frontend || !frontend.pages || frontend.pages.length === 0) {
      return 'User guide not available - no frontend pages detected.';
    }

    const prompt = `
# User Guide Generation

Create a comprehensive user guide for this application organized by the pages users will interact with.

## Application Analysis
- **Project**: ${analysis.projectName}
- **Framework**: ${analysis.framework.join(', ')}
- **Pages Detected**: ${frontend.pages.length}

## Page Information
${frontend.pages.slice(0, 10).map((page: any) => `
### ${page.name}
- **Route**: ${page.route}
- **Components**: ${page.components?.length || 0}
- **Purpose**: ${page.purpose}
- **Interactive Elements**: ${page.components?.filter((c: any) => ['button', 'link', 'form', 'input'].includes(c.type)).length || 0}
`).join('\n')}

Create a User Guide with this structure:

# ${analysis.projectName} User Guide

## Overview
Brief explanation of what this application does and how it helps users.

${frontend.pages.map((page: any) => `
## 📄 ${page.name}

### What You See
Describe what users see when they visit this page.

### What You Can Do
List the specific actions users can take on this page:
${page.components?.filter((c: any) => ['button', 'link', 'form', 'input'].includes(c.type)).map((c: any) => 
  `- **${c.text || c.name}** - Interactive ${c.type} for user actions`
).join('\n') || '- View information and navigate'}

${page.navigationLinks?.length > 0 ? `
### Navigation Options
From this page, you can navigate to:
${page.navigationLinks.map((link: string) => `- ${link}`).join('\n')}
` : ''}

**Related API**: [\`/api/[relevant-endpoint]\`](api-reference.md#endpoint-section)

---
`).join('\n')}

For each page section, focus on:
1. What users actually see on the page
2. What actions they can perform
3. What happens when they click buttons or fill forms
4. Where they can go next

Use clear, non-technical language that any user can understand.
Make this a complete reference for how to use every part of the application.
`;

    return await this.callOpenAI(prompt);
  }

  private groupRoutesByFunction(routes: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    
    routes.forEach(route => {
      let category = 'General';
      
      if (route.path.includes('/auth')) category = 'Authentication';
      else if (route.path.includes('/user') || route.path.includes('/account')) category = 'User Management';
      else if (route.path.includes('/api/gsc')) category = 'Google Search Console';
      else if (route.path.includes('/api/websites')) category = 'Website Management';
      else if (route.path.includes('/api/content')) category = 'Content Management';
      else if (route.path.includes('/api/subscription')) category = 'Subscriptions';
      else if (route.path.includes('/api/cms')) category = 'CMS Integration';
      else if (route.path.includes('/admin')) category = 'Administration';
      
      if (!groups[category]) groups[category] = [];
      groups[category].push(route);
    });
    
    return groups;
  }

  private detectAuthPatterns(analysis: CodebaseAnalysis): string {
    const hasJWT = analysis.files.some(f => f.content.includes('jwt') || f.dependencies.includes('jsonwebtoken'));
    const hasAuth0 = analysis.files.some(f => f.content.includes('auth0'));
    const hasNextAuth = analysis.dependencies['next-auth'] !== undefined;
    const hasSession = analysis.files.some(f => f.content.includes('session'));
    
    if (hasAuth0) return 'Auth0';
    if (hasNextAuth) return 'NextAuth.js';
    if (hasJWT) return 'JWT Bearer tokens';
    if (hasSession) return 'Session-based';
    return 'No authentication detected';
  }

  private detectDatabasePatterns(analysis: CodebaseAnalysis): string {
    if (analysis.dependencies.mongodb || analysis.dependencies.mongoose) return 'MongoDB';
    if (analysis.dependencies.pg || analysis.dependencies.postgresql) return 'PostgreSQL';
    if (analysis.dependencies.mysql || analysis.dependencies.mysql2) return 'MySQL';
    if (analysis.dependencies.sqlite || analysis.dependencies.sqlite3) return 'SQLite';
    if (analysis.dependencies.prisma) return 'Prisma ORM';
    if (analysis.dependencies.sequelize) return 'Sequelize ORM';
    return 'Database not detected';
  }

  private generateEndpointDescription(route: any): string {
    const method = route.method.toUpperCase();
    const path = route.path;
    
    if (path.includes('/auth')) {
      if (method === 'POST' && path.includes('/login')) return 'Authenticate user and return access token';
      if (method === 'POST' && path.includes('/register')) return 'Register new user account';
      if (method === 'POST' && path.includes('/logout')) return 'Log out user and invalidate session';
    }
    
    if (path.includes('/user') || path.includes('/account')) {
      if (method === 'GET') return 'Retrieve user account information';
      if (method === 'PUT' || method === 'PATCH') return 'Update user account details';
      if (method === 'DELETE') return 'Delete user account';
    }
    
    if (path.includes('/websites')) {
      if (method === 'GET') return 'List websites managed by the user';
      if (method === 'POST') return 'Add new website to management';
      if (method === 'DELETE') return 'Remove website from management';
    }
    
    return `${method} endpoint for ${path}`;
  }

  private extractProjectDescription(overview: string): string {
    // Try to extract the first paragraph after the title
    const lines = overview.split('\n');
    const titleIndex = lines.findIndex(line => line.startsWith('# '));
    
    if (titleIndex !== -1 && titleIndex + 2 < lines.length) {
      const descriptionLine = lines[titleIndex + 2];
      if (descriptionLine && descriptionLine.length > 20) {
        return descriptionLine.substring(0, 100) + (descriptionLine.length > 100 ? '...' : '');
      }
    }
    
    return 'Automated documentation generated from codebase analysis';
  }

  private generateFeaturesList(documentation: GeneratedDocumentation): string {
    const features: string[] = [];
    
    if (documentation.frontend?.pages && documentation.frontend.pages.length > 0) {
      features.push(`### Frontend Features
- **${documentation.frontend.pages.length} Pages** - Complete user interface documentation
- **Interactive Components** - Buttons, forms, and user interactions mapped to backend services`);
    }
    
    if (documentation.apiDocumentation && documentation.apiDocumentation.length > 0) {
      features.push(`### API Features  
- **${documentation.apiDocumentation.length} Endpoints** - Complete API reference with examples
- **Authentication** - Security and access control documentation`);
    }
    
    if (documentation.userFlows && documentation.userFlows.length > 0) {
      features.push(`### User Workflows
- **${documentation.userFlows.length} Workflows** - Step-by-step user journey documentation`);
    }
    
    return features.join('\n\n');
  }

  private async callOpenAI(prompt: string, timeoutMs: number = 60000): Promise<string> {
    try {
      console.log('🤖 Making OpenAI API call...');
      
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`OpenAI API call timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      // Race between API call and timeout
      const response = await Promise.race([
        this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
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
        }),
        timeoutPromise
      ]);

      console.log('✅ OpenAI API call completed successfully');
      return response.choices[0]?.message?.content || 'Documentation generation failed';
    } catch (error) {
      console.error('❌ OpenAI API Error:', error);
      
      if (error instanceof Error && error.message.includes('timed out')) {
        return `# Documentation Generation Timeout\n\nThe AI documentation generation timed out after ${timeoutMs/1000} seconds. This may be due to:\n- Network connectivity issues\n- OpenAI API rate limits\n- Large prompt size\n\nTry again with a smaller project or check your internet connection.`;
      }
      
      return `# Documentation Generation Error\n\nError: ${error}\n\nPlease check your OpenAI API key and network connection.`;
    }
  }
}