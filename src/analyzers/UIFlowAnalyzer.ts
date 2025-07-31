import { CodebaseAnalysis, FileInfo, FileType } from './CodebaseAnalyzer.js';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export interface UIElement {
  id: string;
  type: 'button' | 'form' | 'link' | 'input';
  text: string;
  component: string;
  filePath: string;
  line: number;
  onClick?: string;
  onSubmit?: string;
  href?: string;
  apiCall?: APICall;
}

export interface APICall {
  method: string;
  endpoint: string;
  function: string;
  filePath: string;
  line: number;
  backendRoute?: BackendRoute;
}

export interface BackendRoute {
  method: string;
  path: string;
  handler: string;
  filePath: string;
  line: number;
  dbOperations?: DatabaseOperation[];
}

export interface DatabaseOperation {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  columns: string[];
  filePath: string;
  line: number;
}

export interface UIFlow {
  uiElement: UIElement;
  apiCall?: APICall;
  backendRoute?: BackendRoute;
  dbOperations?: DatabaseOperation[];
}

export class UIFlowAnalyzer {
  private analysis: CodebaseAnalysis;
  
  constructor(analysis: CodebaseAnalysis) {
    this.analysis = analysis;
  }

  analyzeUIFlows(): UIFlow[] {
    console.log('🔍 Analyzing UI-to-Backend flows...');
    
    const uiElements = this.extractUIElements();
    const apiCalls = this.extractAPICalls();
    const backendRoutes = this.extractBackendRoutes();
    const dbOperations = this.extractDatabaseOperations();
    
    console.log(`Found ${uiElements.length} UI elements, ${apiCalls.length} API calls, ${backendRoutes.length} backend routes`);
    
    // Build the flow graph
    const flows = this.buildFlowConnections(uiElements, apiCalls, backendRoutes, dbOperations);
    
    console.log(`Built ${flows.length} complete UI flows`);
    return flows;
  }

  private extractUIElements(): UIElement[] {
    const elements: UIElement[] = [];
    
    // Focus on React/Next.js components
    const componentFiles = this.analysis.files.filter(f => 
      (f.type === FileType.React || f.type === FileType.TypeScript) &&
      (f.path.includes('components/') || f.path.includes('pages/') || f.path.includes('app/'))
    );

    componentFiles.forEach(file => {
      try {
        const ast = parse(file.content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx']
        });

        (traverse as any).default(ast, {
          JSXElement: (path: any) => {
            const element = this.parseJSXElement(path, file);
            if (element) {
              elements.push(element);
            }
          }
        });
      } catch (error) {
        console.warn(`Failed to parse ${file.relativePath} for UI elements:`, error);
      }
    });

    return elements;
  }

  private parseJSXElement(path: any, file: FileInfo): UIElement | null {
    const node = path.node;
    const openingElement = node.openingElement;
    
    if (!t.isJSXIdentifier(openingElement.name)) return null;
    
    const tagName = openingElement.name.name.toLowerCase();
    
    // Focus on interactive elements
    if (!['button', 'a', 'form', 'input'].includes(tagName)) return null;
    
    const element: Partial<UIElement> = {
      type: tagName as UIElement['type'],
      component: this.findParentComponent(path, file),
      filePath: file.relativePath,
      line: node.loc?.start.line || 0
    };

    // Extract text content
    element.text = this.extractElementText(node);
    
    // Extract event handlers
    openingElement.attributes?.forEach((attr: any) => {
      if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
        const attrName = attr.name.name;
        
        if (attrName === 'onClick' && t.isJSXExpressionContainer(attr.value)) {
          element.onClick = this.extractHandlerName(attr.value.expression);
        } else if (attrName === 'onSubmit' && t.isJSXExpressionContainer(attr.value)) {
          element.onSubmit = this.extractHandlerName(attr.value.expression);
        } else if (attrName === 'href' && t.isStringLiteral(attr.value)) {
          element.href = attr.value.value;
        }
      }
    });

    // Generate unique ID
    element.id = this.generateElementId(element as UIElement);
    
    return element as UIElement;
  }

  
  private extractElementText(node: any): string {
    // Extract text content from JSX element
    if (node.children) {
      return node.children
        .map((child: any) => {
          if (t.isJSXText(child)) return child.value.trim();
          if (t.isJSXExpressionContainer(child) && t.isStringLiteral(child.expression)) {
            return child.expression.value;
          }
          return '';
        })
        .join(' ')
        .trim();
    }
    return '';
  }

  private extractHandlerName(expression: any): string {
    if (t.isIdentifier(expression)) {
      return expression.name;
    } else if (t.isMemberExpression(expression)) {
      return `${this.extractHandlerName(expression.object)}.${t.isIdentifier(expression.property) ? expression.property.name : ''}`;
    } else if (t.isArrowFunctionExpression(expression) || t.isFunctionExpression(expression)) {
      return 'inline-function';
    }
    return 'unknown-handler';
  }

  private findParentComponent(path: any, file: FileInfo): string {
    // Find the React component that contains this element
    let parent = path.getFunctionParent();
    while (parent) {
      if (t.isFunctionDeclaration(parent.node) && parent.node.id) {
        return parent.node.id.name;
      } else if (t.isVariableDeclarator(parent.parent) && t.isIdentifier(parent.parent.id)) {
        return parent.parent.id.name;
      }
      parent = parent.getFunctionParent();
    }
    
    // Fallback to filename
    return file.relativePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Unknown';
  }

  private generateElementId(element: UIElement): string {
    const text = element.text.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return `${element.type}-${text || 'unnamed'}-${element.line}`;
  }

  private extractAPICalls(): APICall[] {
    // TODO: Implement API call extraction
    // Look for fetch(), axios.*, api.* calls in components
    return [];
  }

  private extractBackendRoutes(): BackendRoute[] {
    // TODO: Implement backend route extraction
    // Look for Express routes, Next.js API routes, etc.
    return [];
  }

  private extractDatabaseOperations(): DatabaseOperation[] {
    // TODO: Implement database operation extraction
    // Look for Prisma, Sequelize, raw SQL queries
    return [];
  }

  private buildFlowConnections(
    uiElements: UIElement[],
    apiCalls: APICall[],
    backendRoutes: BackendRoute[],
    dbOperations: DatabaseOperation[]
  ): UIFlow[] {
    // TODO: Implement flow connection logic
    // Connect UI elements → API calls → backend routes → DB operations
    return uiElements.map(element => ({ uiElement: element }));
  }
}