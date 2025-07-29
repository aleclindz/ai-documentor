import OpenAI from 'openai';
import { marked } from 'marked';
import { writeFileSync, mkdirSync, existsSync, statSync, unlinkSync, readdirSync, renameSync, rmSync } from 'fs';
import { join } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { CodebaseAnalysis, FileInfo, FunctionInfo, ComponentInfo, RouteInfo } from '../analyzers/CodebaseAnalyzer.js';
import { Config } from '../utils/Config.js';
import { MermaidGenerator } from './MermaidGenerator.js';
import { slug } from '../utils/slug.js';

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
  diagram: string;
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

  constructor(config: any) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey
    });
    this.mermaidGenerator = new MermaidGenerator();
  }

  async generate(analysis: CodebaseAnalysis, progressCallback?: (status: string) => void): Promise<GeneratedDocumentation> {
    progressCallback?.('📋 Generating project overview...');
    const overview = await this.generateOverview(analysis);
    
    progressCallback?.('🎨 Analyzing frontend components...');
    const frontend = await this.generateFrontendDocs(analysis);
    
    progressCallback?.('⚙️  Documenting backend services...');
    const backend = await this.generateBackendDocs(analysis);
    
    progressCallback?.('🗄️  Analyzing database structure...');
    const database = await this.generateDatabaseDocs(analysis);
    
    progressCallback?.('🔄 Mapping user workflows...');
    const userFlows = await this.generateUserFlows(analysis);
    
    progressCallback?.('📊 Creating architecture diagrams...');
    const architectureDiagram = await this.mermaidGenerator.generateArchitectureDiagram(analysis);
    
    progressCallback?.('📡 Documenting API endpoints...');
    const apiDocumentation = await this.generateAPIDocumentation(analysis);
    
    progressCallback?.('🚀 Writing deployment guide...');
    const deploymentGuide = await this.generateDeploymentGuide(analysis);
    
    progressCallback?.('🔧 Creating troubleshooting guide...');
    const troubleshooting = await this.generateTroubleshooting(analysis);

    const documentation: GeneratedDocumentation = {
      overview,
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
    const frontendFiles = analysis.files.filter(f => 
      f.components.length > 0 || 
      f.type.toString().includes('react') || 
      f.type.toString().includes('vue') ||
      f.relativePath.includes('components') ||
      f.relativePath.includes('pages')
    );

    const componentsPrompt = `
# Frontend Component Documentation Generation

Analyze these React/Frontend components and create detailed documentation with cross-linking support:

${frontendFiles.slice(0, 5).map(f => `
## File: ${f.relativePath}
**Components**: ${f.components.map(c => c.name).join(', ')}
**Functions**: ${f.functions.map(fn => fn.name).join(', ')}
**Dependencies**: ${f.dependencies.slice(0, 5).join(', ')}

\`\`\`typescript
${f.content.slice(0, 1000)}...
\`\`\`
`).join('\n')}

## UI → API Interaction Mapping:
${analysis.links.map(l => `- ${l.uiComponent}.${l.event} -> ${l.apiEndpoint}`).join('\n')}

For each component, provide:
1. **name**: Component name
2. **slug**: URL-friendly slug (auto-generated)
3. **Purpose**: What the component does and when to use it
4. **Props**: Expected properties and their types
5. **User Interactions**: How users interact with it
6. **uiEvents**: Array of {event, description, apiEndpointSlug} for interactions that call APIs
7. **Data Flow**: How data flows in and out
8. **Side Effects**: API calls, state updates, etc.

Format as structured JSON: {"components": [ComponentDocumentation objects]}
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

Provide detailed technical analysis in Markdown format with proper headers and subheaders.
`;

    const featuresPrompt = `
# Frontend Features & Functionality Analysis

Analyze the frontend from a user perspective based on these components and pages:

**Components Detected**:
${frontendFiles.flatMap(f => f.components).slice(0, 10).map(c => `- ${c.name}: ${c.props.join(', ')}`).join('\n')}

**Routes/Pages**:
${analysis.files.flatMap(f => f.routes).slice(0, 5).map(r => `- ${r.path} (${r.method})`).join('\n')}

**Key Files**:
${frontendFiles.slice(0, 5).map(f => `- ${f.relativePath}: ${f.functions.length} functions, ${f.components.length} components`).join('\n')}

Create comprehensive user-focused documentation covering:

## 1. Core Features Overview
- What can users do with this application?
- What are the main features and capabilities?
- What problems does this solve for users?

## 2. User Interface Components
- What buttons, forms, and interactive elements exist?
- What does each UI component do from the user's perspective?
- How do users interact with different parts of the interface?

## 3. User Workflows & Interactions
- What are the typical user journeys through the application?
- How do users accomplish their goals?
- What steps do users take to complete common tasks?

## 4. Data & Information Display
- What information is shown to users and where?
- How is data organized and presented?
- What can users do with the displayed information?

## 5. Navigation & User Experience
- How do users move between different sections?
- What navigation patterns are used?
- How is the user experience optimized?

Focus on user-visible functionality, not technical implementation. Write as if explaining to end users what they can expect when using the application. Use clear, non-technical language while being comprehensive about features and functionality.

Format with proper Markdown headers, subheaders, bullet points, and clear structure.
`;

    const [overview, featuresAndFunctionality, componentsResponse] = await Promise.all([
      this.callOpenAI(overviewPrompt),
      this.callOpenAI(featuresPrompt),
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
          slug: slug(c.name),
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
      featuresAndFunctionality,
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

  private async generateUserFlows(analysis: CodebaseAnalysis): Promise<UserFlow[]> {
    const prompt = `
# User Flow Documentation Generation

Based on this application analysis, create hyper-linked user flows with cross-references:

**Frontend Components**: ${analysis.files.filter(f => f.components.length > 0).map(f => 
  f.components.map(c => c.name).join(', ')
).join(', ')}

**API Endpoints**: ${analysis.files.flatMap(f => f.routes).map(r => `${r.method} ${r.path}`).join(', ')}

**Interaction Links**: ${analysis.links.map(l => `${l.uiComponent}.${l.event} → ${l.apiEndpoint} → ${l.dbModel || 'DB'}`).join(', ')}

Create 3-5 major user flows as structured JSON. Each flow should have:
- **name**: Descriptive flow name
- **slug**: URL-friendly identifier
- **description**: What this flow accomplishes
- **steps**: Array of detailed steps with cross-links

Each step should include:
- **action**: What the user does
- **componentSlug**: The UI component involved (use kebab-case)
- **event**: The interaction event (click, submit, etc.)
- **apiSlug**: The API endpoint called (format: "method-path")
- **serviceFunction**: Backend handler function name
- **dbModel**: Database table/model affected
- **result**: What happens next

Format as: {"userFlows": [UserFlow objects]}

Example structure:
{
  "userFlows": [
    {
      "name": "User Login",
      "slug": "user-login", 
      "description": "User authentication flow",
      "steps": [
        {
          "action": "User clicks login button",
          "componentSlug": "login-form",
          "event": "click",
          "apiSlug": "post-auth-login",
          "serviceFunction": "handleLogin",
          "dbModel": "users",
          "result": "Redirect to dashboard"
        }
      ]
    }
  ]
}
`;

    const response = await this.callOpenAI(prompt);

    try {
      const parsed = JSON.parse(response);
      return parsed.userFlows || parsed || [];
    } catch {
      return [{
        name: 'Main User Flow',
        slug: slug('Main User Flow'),
        description: 'Primary application workflow',
        steps: [{
          action: 'User interacts with application',
          componentSlug: slug('Main component'),
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

    // Save each section as markdown files
    writeFileSync(join(outputDir, 'overview.md'), documentation.overview);
    writeFileSync(join(outputDir, 'frontend.md'), this.formatFrontendDocs(documentation.frontend));
    writeFileSync(join(outputDir, 'backend.md'), this.formatBackendDocs(documentation.backend));
    writeFileSync(join(outputDir, 'database.md'), this.formatDatabaseDocs(documentation.database));
    writeFileSync(join(outputDir, 'user-flows.md'), this.formatUserFlows(documentation.userFlows));
    writeFileSync(join(outputDir, 'architecture.md'), documentation.architectureDiagram);
    writeFileSync(join(outputDir, 'api.md'), this.formatAPIDocumentation(documentation.apiDocumentation));
    writeFileSync(join(outputDir, 'deployment.md'), documentation.deploymentGuide);
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
    return `# Project Documentation

> Regenerate docs anytime with \`ai-documentor\`.
> View in your browser with \`ai-documentor view\`.

## 🚀 Quick Start

1. **User Flows** – start here to understand how users interact with the application
${documentation.userFlows.map(f => `     - [${f.name}](user-flows.md#${f.slug})`).join('\n')}

2. **Frontend** – user interface components and interactions
   - [Frontend Documentation](frontend.md)

3. **Backend** – server-side APIs and business logic  
   - [Backend Documentation](backend.md)

4. **Database** – data storage and schema
   - [Database Documentation](database.md)

5. **API Reference** – detailed endpoint documentation
   - [API Documentation](api.md)

6. **Architecture** – system design and component relationships
   - [Architecture Diagram](architecture.md)

7. **Deployment** – how to deploy and run the application
   - [Deployment Guide](deployment.md)

8. **Troubleshooting** – common issues and solutions
   - [Troubleshooting Guide](troubleshooting.md)

## 📖 CLI Commands

- \`ai-documentor\` - Generate fresh documentation from your codebase
- \`ai-documentor --force\` - Force regeneration even if docs exist  
- \`ai-documentor view\` - Start local server to browse documentation
- \`ai-documentor update\` - Update existing documentation
- \`ai-documentor --help\` - Show all available options

## 🔗 Cross-References

This documentation includes extensive cross-linking between:
- User flows → UI components → API endpoints → Database operations
- Frontend components with their backend API calls
- API endpoints with the components that trigger them
- Complete traceability from user action to data persistence

Navigate by clicking on any linked component, API, or database reference to jump directly to its documentation.
`;
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