import { CodebaseAnalysis, FileInfo, FileType } from './CodebaseAnalyzer.js';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export interface ReactPage {
  name: string;
  slug: string;
  filePath: string;
  route?: string;
  components: PageComponent[];
  description: string;
  imports: string[];
}

export interface PageComponent {
  name: string;
  type: 'button' | 'form' | 'link' | 'input' | 'modal' | 'card' | 'navigation' | 'other';
  text?: string;
  onClick?: string;
  navigatesTo?: string;
  props: ComponentProp[];
  filePath: string;
  line: number;
  description: string;
}

export interface ComponentProp {
  name: string;
  type: string;
  value?: string;
}

export interface PageNavigation {
  from: ReactPage;
  to: ReactPage;
  trigger: PageComponent;
  method: 'onClick' | 'form-submit' | 'link' | 'programmatic';
}

export class ReactPageAnalyzer {
  private analysis: CodebaseAnalysis;
  private pages: ReactPage[] = [];
  private navigations: PageNavigation[] = [];

  constructor(analysis: CodebaseAnalysis) {
    this.analysis = analysis;
  }

  analyzePages(): { pages: ReactPage[], navigations: PageNavigation[] } {
    console.log('🔍 Analyzing React pages and components...');
    
    // Step 1: Identify all page files
    const pageFiles = this.identifyPageFiles();
    console.log(`Found ${pageFiles.length} potential page files`);
    
    // Step 2: Parse each page and extract components
    this.pages = pageFiles.map(file => this.analyzePage(file)).filter(page => page !== null) as ReactPage[];
    console.log(`Analyzed ${this.pages.length} pages with components`);
    
    // Step 3: Build navigation graph between pages
    this.navigations = this.buildNavigationGraph();
    console.log(`Built ${this.navigations.length} navigation connections`);
    
    return { pages: this.pages, navigations: this.navigations };
  }

  private identifyPageFiles(): FileInfo[] {
    // Look for React pages in common locations
    return this.analysis.files.filter(file => {
      const path = file.relativePath.toLowerCase();
      
      // Next.js App Router
      if (path.includes('/app/') && (path.includes('/page.') || path.includes('/layout.'))) {
        return true;
      }
      
      // Next.js Pages Router
      if (path.includes('/pages/') && !path.includes('/api/')) {
        return true;
      }
      
      // React Router pages
      if (path.includes('/pages/') || path.includes('/views/') || path.includes('/screens/')) {
        return true;
      }
      
      // Components that are likely pages (contain routing keywords)
      if (file.content.includes('useRouter') || 
          file.content.includes('useNavigate') || 
          file.content.includes('Router.push') ||
          file.content.includes('navigate(')) {
        return true;
      }
      
      return false;
    });
  }

  private analyzePage(file: FileInfo): ReactPage | null {
    try {
      const ast = parse(file.content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
      });

      const page: ReactPage = {
        name: this.extractPageName(file),
        slug: this.generateSlug(this.extractPageName(file)),
        filePath: file.relativePath,
        route: this.extractRoute(file, ast),
        components: [],
        description: this.generatePageDescription(file),
        imports: []
      };

      // Extract imports
      page.imports = this.extractImports(ast);
      
      // Extract components from JSX
      page.components = this.extractPageComponents(ast, file);

      return page;
    } catch (error) {
      console.warn(`Failed to analyze page ${file.relativePath}:`, error);
      return null;
    }
  }

  private extractPageName(file: FileInfo): string {
    // Extract page name from file path
    const pathParts = file.relativePath.split('/');
    
    // Handle Next.js App Router (page.tsx/jsx)
    if (pathParts[pathParts.length - 1].startsWith('page.')) {
      const folder = pathParts[pathParts.length - 2];
      return this.formatPageName(folder);
    }
    
    // Handle regular file names
    const fileName = pathParts[pathParts.length - 1].replace(/\.(tsx?|jsx?)$/, '');
    return this.formatPageName(fileName);
  }

  private formatPageName(name: string): string {
    if (name === 'index' || name === 'page') return 'Home';
    
    return name
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private extractRoute(file: FileInfo, ast: any): string {
    // Try to extract route from Next.js file structure
    const pathParts = file.relativePath.split('/');
    
    if (pathParts.includes('app')) {
      // Next.js App Router
      const routeParts = pathParts.slice(pathParts.indexOf('app') + 1);
      return '/' + routeParts.filter(part => !part.includes('page.')).join('/');
    } else if (pathParts.includes('pages')) {
      // Next.js Pages Router
      const routeParts = pathParts.slice(pathParts.indexOf('pages') + 1);
      let route = '/' + routeParts.join('/').replace(/\.(tsx?|jsx?)$/, '');
      return route === '/index' ? '/' : route;
    }
    
    return '/unknown';
  }

  private extractImports(ast: any): string[] {
    const imports: string[] = [];
    
    (traverse as any).default(ast, {
      ImportDeclaration: (path: any) => {
        if (t.isStringLiteral(path.node.source)) {
          imports.push(path.node.source.value);
        }
      }
    });
    
    return imports;
  }

  private extractPageComponents(ast: any, file: FileInfo): PageComponent[] {
    const components: PageComponent[] = [];
    
    (traverse as any).default(ast, {
      JSXElement: (path: any) => {
        const component = this.parseJSXComponent(path, file);
        if (component) {
          components.push(component);
        }
      }
    });
    
    return components;
  }

  private parseJSXComponent(path: any, file: FileInfo): PageComponent | null {
    const node = path.node;
    const openingElement = node.openingElement;
    
    if (!t.isJSXIdentifier(openingElement.name)) return null;
    
    const tagName = openingElement.name.name;
    
    // Focus on interactive elements and common components
    const componentType = this.classifyComponent(tagName, node);
    if (componentType === 'ignore') return null;
    
    const component: PageComponent = {
      name: tagName,
      type: componentType,
      text: this.extractComponentText(node),
      props: this.extractProps(openingElement),
      filePath: file.relativePath,
      line: node.loc?.start.line || 0,
      description: this.generateComponentDescription(tagName, componentType, this.extractComponentText(node))
    };

    // Extract event handlers and navigation
    component.onClick = this.extractEventHandler(openingElement, 'onClick');
    component.navigatesTo = this.extractNavigationTarget(openingElement, file);

    return component;
  }

  private classifyComponent(tagName: string, node: any): PageComponent['type'] | 'ignore' {
    const tag = tagName.toLowerCase();
    
    // Interactive elements
    if (tag === 'button') return 'button';
    if (tag === 'a' || tag === 'link') return 'link';
    if (tag === 'form') return 'form';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'input';
    
    // Common component patterns
    if (tag.includes('button') || tag.includes('btn')) return 'button';
    if (tag.includes('modal') || tag.includes('dialog')) return 'modal';
    if (tag.includes('card')) return 'card';
    if (tag.includes('nav') || tag.includes('menu')) return 'navigation';
    if (tag.includes('form')) return 'form';
    
    // Check if it has interactive props
    const hasClickHandler = node.openingElement.attributes?.some((attr: any) => 
      t.isJSXAttribute(attr) && 
      t.isJSXIdentifier(attr.name) && 
      attr.name.name === 'onClick'
    );
    
    if (hasClickHandler) return 'button';
    
    // Ignore purely presentational elements
    if (['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'section', 'article'].includes(tag)) {
      return 'ignore';
    }
    
    return 'other';
  }

  private extractComponentText(node: any): string {
    if (!node.children) return '';
    
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

  private extractProps(openingElement: any): ComponentProp[] {
    const props: ComponentProp[] = [];
    
    openingElement.attributes?.forEach((attr: any) => {
      if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
        const prop: ComponentProp = {
          name: attr.name.name,
          type: 'unknown'
        };
        
        if (t.isStringLiteral(attr.value)) {
          prop.type = 'string';
          prop.value = attr.value.value;
        } else if (t.isJSXExpressionContainer(attr.value)) {
          prop.type = 'expression';
          if (t.isStringLiteral(attr.value.expression)) {
            prop.value = attr.value.expression.value;
          }
        }
        
        props.push(prop);
      }
    });
    
    return props;
  }

  private extractEventHandler(openingElement: any, eventName: string): string | undefined {
    const attr = openingElement.attributes?.find((attr: any) => 
      t.isJSXAttribute(attr) && 
      t.isJSXIdentifier(attr.name) && 
      attr.name.name === eventName
    );
    
    if (!attr || !t.isJSXExpressionContainer(attr.value)) return undefined;
    
    const expression = attr.value.expression;
    if (t.isIdentifier(expression)) {
      return expression.name;
    } else if (t.isMemberExpression(expression)) {
      // Handle things like router.push, navigate, etc.
      return this.extractMemberExpression(expression);
    }
    
    return 'inline-function';
  }

  private extractMemberExpression(expression: any): string {
    if (t.isIdentifier(expression.object) && t.isIdentifier(expression.property)) {
      return `${expression.object.name}.${expression.property.name}`;
    }
    return 'complex-expression';
  }

  private extractNavigationTarget(openingElement: any, file: FileInfo): string | undefined {
    // Look for href attributes
    const hrefAttr = openingElement.attributes?.find((attr: any) => 
      t.isJSXAttribute(attr) && 
      t.isJSXIdentifier(attr.name) && 
      attr.name.name === 'href'
    );
    
    if (hrefAttr && t.isStringLiteral(hrefAttr.value)) {
      return hrefAttr.value.value;
    }
    
    // Look for navigation patterns in onClick handlers
    // This would need more sophisticated analysis
    return undefined;
  }

  private buildNavigationGraph(): PageNavigation[] {
    const navigations: PageNavigation[] = [];
    
    // This would analyze component onClick handlers and navigation calls
    // to build connections between pages
    
    return navigations;
  }

  private generatePageDescription(file: FileInfo): string {
    const pageName = this.extractPageName(file);
    return `The ${pageName} page provides user interface and functionality for ${pageName.toLowerCase()} related features.`;
  }

  private generateComponentDescription(name: string, type: PageComponent['type'], text: string): string {
    const displayText = text ? ` labeled "${text}"` : '';
    
    switch (type) {
      case 'button':
        return `Interactive button${displayText} that triggers user actions`;
      case 'link':
        return `Navigation link${displayText} that takes users to different pages`;
      case 'form':
        return `Form component for user input and data submission`;
      case 'input':
        return `Input field${displayText} for user data entry`;
      case 'modal':
        return `Modal dialog${displayText} for focused user interactions`;
      case 'card':
        return `Card component${displayText} displaying related information`;
      case 'navigation':
        return `Navigation component for site/app navigation`;
      default:
        return `${name} component${displayText}`;
    }
  }

  private generateSlug(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}