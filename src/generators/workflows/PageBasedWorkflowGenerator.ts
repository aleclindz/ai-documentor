import { BaseWorkflowGenerator, UserFlow } from './BaseWorkflowGenerator.js';
import { CodebaseAnalysis } from '../../analyzers/CodebaseAnalyzer.js';

export interface PageFlow {
  name: string;
  slug: string;
  description: string;
  pageType: 'landing' | 'dashboard' | 'form' | 'list' | 'detail' | 'auth' | 'settings' | 'generic';
  actions: PageAction[];
  content?: string;
  components?: string[];
}

export interface PageAction {
  name: string;
  type: 'button' | 'form' | 'link' | 'input' | 'upload' | 'selection';
  description: string;
  trigger: string; // e.g., "onClick", "onSubmit", "onChange"
  backendFunction?: BackendReference;
  navigatesTo?: string; // slug of another page
  dataFlow?: DataFlowReference;
}

export interface BackendReference {
  functionName: string;
  slug: string;
  apiEndpoint?: string;
  description: string;
  databaseOperations?: DatabaseOperation[];
}

export interface DatabaseOperation {
  operation: 'create' | 'read' | 'update' | 'delete';
  table: string;
  description: string;
}

export interface DataFlowReference {
  from: string;
  to: string;
  dataType: string;
  description: string;
}

export class PageBasedWorkflowGenerator extends BaseWorkflowGenerator {
  canHandle(analysis: CodebaseAnalysis): boolean {
    // This generator works for web applications with pages/components
    const hasPages = analysis.files.some(file => 
      file.path.includes('pages/') || 
      file.path.includes('views/') || 
      file.path.includes('components/') ||
      file.components.length > 0
    );

    const hasRoutes = analysis.files.some(file => file.routes.length > 0);
    const hasWebFramework = analysis.framework.some(fw => 
      ['React', 'Vue', 'Angular', 'Next.js', 'Nuxt.js', 'Express'].includes(fw)
    );

    this.log(`PageBased Detection: pages=${hasPages}, routes=${hasRoutes}, framework=${hasWebFramework}`);
    
    return hasPages && (hasRoutes || hasWebFramework);
  }

  async generateWorkflows(analysis: CodebaseAnalysis): Promise<UserFlow[]> {
    this.log('Generating page-based user flows with cross-references...');

    const prompt = this.buildPageBasedPrompt(analysis);
    
    try {
      const response = await this.callOpenAI(prompt);
      const cleanedResponse = this.cleanJSONResponse(response);
      const parsed = JSON.parse(cleanedResponse);
      
      // Convert page flows to standard UserFlow format
      return this.convertPageFlowsToUserFlows(parsed.pageFlows || []);
    } catch (error) {
      console.error('Error generating page-based user flows:', error);
      return this.generateFallbackPageFlows(analysis);
    }
  }

  private buildPageBasedPrompt(analysis: CodebaseAnalysis): string {
    const pages = this.extractPages(analysis);
    const components = this.extractComponents(analysis);
    const apiEndpoints = this.extractAPIEndpoints(analysis);
    const routes = this.extractRoutes(analysis);

    return `
# Page-Based User Flow Documentation Generation

Create comprehensive user flow documentation organized by pages/views, with cross-references to backend functions and database operations.

## Project Analysis:
**Application Name**: ${analysis.projectName}
**Framework**: ${analysis.framework.join(', ')}
**Pages/Routes Detected**: ${pages.join(', ') || 'Standard web pages detected'}
**Components**: ${components.slice(0, 15).join(', ') || 'UI components detected'}
**API Endpoints**: ${apiEndpoints.slice(0, 10).join(', ') || 'Backend endpoints detected'}
**Routing**: ${routes.slice(0, 8).join(', ') || 'Navigation detected'}

## Required Structure:

Create page-based user flows as JSON with this structure:

{
  "pageFlows": [
    {
      "name": "Landing Page",
      "slug": "landing-page",
      "description": "Main entry point where users first visit the website to learn about the product/service",
      "pageType": "landing",
      "content": "Brief summary of what content is displayed on this page",
      "components": ["Header", "Hero", "Features", "Footer"],
      "actions": [
        {
          "name": "Create Account Button",
          "type": "button",
          "description": "Primary call-to-action button that allows new users to register",
          "trigger": "onClick",
          "backendFunction": {
            "functionName": "createAccount",
            "slug": "create-account-function",
            "apiEndpoint": "POST /api/auth/register",
            "description": "Creates a new user account and stores user data",
            "databaseOperations": [
              {
                "operation": "create",
                "table": "users",
                "description": "Creates a new row in the users table with user details"
              }
            ]
          },
          "navigatesTo": "signup-page"
        },
        {
          "name": "Login Button",
          "type": "button", 
          "description": "Allows existing users to sign into their account",
          "trigger": "onClick",
          "backendFunction": {
            "functionName": "authenticateUser",
            "slug": "authenticate-user-function",
            "apiEndpoint": "POST /api/auth/login",
            "description": "Validates user credentials and creates authentication session",
            "databaseOperations": [
              {
                "operation": "read",
                "table": "users",
                "description": "Queries user table to verify credentials"
              }
            ]
          },
          "navigatesTo": "dashboard"
        }
      ]
    },
    {
      "name": "Dashboard",
      "slug": "dashboard",
      "description": "Main user interface after login where users manage their account and access features",
      "pageType": "dashboard",
      "content": "Overview of user data, quick actions, and navigation to main features",
      "actions": [
        {
          "name": "Profile Settings",
          "type": "link",
          "description": "Navigate to user profile management",
          "trigger": "onClick",
          "navigatesTo": "profile-settings"
        }
      ]
    }
  ]
}

## Guidelines:

1. **Page Types**: Use appropriate types: landing, dashboard, form, list, detail, auth, settings, generic
2. **Action Types**: button, form, link, input, upload, selection
3. **Backend Functions**: Always include slug for cross-referencing to backend documentation
4. **Database Operations**: Specify create, read, update, or delete operations
5. **Navigation**: Use navigatesTo to link between pages
6. **Cross-References**: Every backend function should have a unique slug for linking

Based on the detected pages and API endpoints, create 4-8 comprehensive page flows that represent the main user journeys through the application.

Focus on:
- User-facing pages (not admin or internal pages)
- Primary user actions and workflows
- Cross-references between frontend actions and backend functions
- Clear navigation paths between pages
- Database operations triggered by user actions

Return only the JSON structure.
`;
  }

  private extractPages(analysis: CodebaseAnalysis): string[] {
    const pages: string[] = [];
    
    analysis.files.forEach(file => {
      // Extract page names from file paths
      if (file.path.includes('pages/') || file.path.includes('views/')) {
        const pageName = file.path.split('/').pop()?.replace(/\.(tsx?|jsx?|vue)$/, '');
        if (pageName && !pageName.includes('_') && pageName !== 'index') {
          pages.push(pageName);
        }
      }
      
      // Extract from component names that look like pages
      file.components.forEach(component => {
        if (component.name.toLowerCase().includes('page') || 
            component.name.toLowerCase().includes('screen') ||
            ['Dashboard', 'Home', 'Landing', 'Login', 'Register', 'Profile'].includes(component.name)) {
          pages.push(component.name);
        }
      });
    });

    return [...new Set(pages)];
  }

  private extractComponents(analysis: CodebaseAnalysis): string[] {
    const components: string[] = [];
    
    analysis.files.forEach(file => {
      file.components.forEach(component => {
        components.push(component.name);
      });
    });

    return [...new Set(components)];
  }

  private extractAPIEndpoints(analysis: CodebaseAnalysis): string[] {
    const endpoints: string[] = [];
    
    analysis.files.forEach(file => {
      file.routes.forEach(route => {
        endpoints.push(`${route.method} ${route.path}`);
      });
    });

    return [...new Set(endpoints)];
  }

  private extractRoutes(analysis: CodebaseAnalysis): string[] {
    const routes: string[] = [];
    
    analysis.files.forEach(file => {
      // Look for routing patterns in code
      if (file.content.includes('Route') || file.content.includes('router') || file.content.includes('navigate')) {
        const routeMatches = file.content.match(/['"`]\/[^'"`\s]*['"`]/g);
        if (routeMatches) {
          routeMatches.forEach(match => {
            const route = match.replace(/['"`]/g, '');
            if (route.length > 1) routes.push(route);
          });
        }
      }
    });

    return [...new Set(routes)];
  }

  private convertPageFlowsToUserFlows(pageFlows: PageFlow[]): UserFlow[] {
    return pageFlows.map(page => ({
      name: page.name,
      slug: page.slug,
      description: page.description,
      steps: page.actions.map(action => ({
        action: action.name,
        component: page.name,
        componentSlug: page.slug,
        event: action.trigger,
        apiEndpoint: action.backendFunction?.apiEndpoint || '',
        apiSlug: action.backendFunction?.slug || '',
        serviceFunction: action.backendFunction?.functionName || '',
        dbModel: action.backendFunction?.databaseOperations?.[0]?.table || '',
        result: action.navigatesTo ? `Navigate to ${action.navigatesTo}` : action.description
      }))
    }));
  }


  private generateFallbackPageFlows(analysis: CodebaseAnalysis): UserFlow[] {
    return [
      {
        name: 'Landing Page',
        slug: 'landing-page',
        description: 'Main entry point for users to learn about the application',
        steps: [
          {
            action: 'Get Started Button',
            component: 'Landing Page',
            componentSlug: 'landing-page',
            event: 'onClick',
            apiEndpoint: '/api/auth/register',
            serviceFunction: 'createAccount',
            result: 'Navigate to signup page'
          }
        ]
      },
      {
        name: 'Dashboard',
        slug: 'dashboard',
        description: 'Main user interface after successful login',
        steps: [
          {
            action: 'View Profile',
            component: 'Dashboard',
            componentSlug: 'dashboard',
            event: 'onClick',
            apiEndpoint: '/api/user/profile',
            serviceFunction: 'getUserProfile',
            result: 'Display user profile information'
          }
        ]
      }
    ];
  }
}