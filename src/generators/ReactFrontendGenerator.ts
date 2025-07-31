import { CodebaseAnalysis } from '../analyzers/CodebaseAnalyzer.js';
import { ReactPageAnalyzer, ReactPage, PageComponent, PageNavigation } from '../analyzers/ReactPageAnalyzer.js';

export interface FrontendDocumentation {
  overview: string;
  pages: PageDocumentation[];
  navigation: NavigationMap;
}

export interface PageDocumentation {
  page: ReactPage;
  componentsMarkdown: string;
  navigationLinks: string[];
}

export interface NavigationMap {
  structure: NavigationNode[];
  crossReferences: CrossReference[];
}

export interface NavigationNode {
  name: string;
  slug: string;
  type: 'page' | 'component';
  children: NavigationNode[];
  route?: string;
}

export interface CrossReference {
  from: string;
  to: string;
  trigger: string;
  type: 'navigation' | 'component-reference';
}

export class ReactFrontendGenerator {
  private analysis: CodebaseAnalysis;
  private pageAnalyzer: ReactPageAnalyzer;

  constructor(analysis: CodebaseAnalysis) {
    this.analysis = analysis;
    this.pageAnalyzer = new ReactPageAnalyzer(analysis);
  }

  async generateFrontendDocs(): Promise<FrontendDocumentation> {
    console.log('🎨 Generating React frontend documentation...');
    
    // Analyze pages and components
    const { pages, navigations } = this.pageAnalyzer.analyzePages();
    
    // Generate documentation for each page
    const pageDocumentations = pages.map(page => this.generatePageDocumentation(page, pages));
    
    // Build navigation structure
    const navigationMap = this.buildNavigationMap(pages, navigations);
    
    // Generate overview
    const overview = this.generateFrontendOverview(pages);
    
    return {
      overview,
      pages: pageDocumentations,
      navigation: navigationMap
    };
  }

  private generatePageDocumentation(page: ReactPage, allPages: ReactPage[]): PageDocumentation {
    const componentsMarkdown = this.generateComponentsMarkdown(page.components, allPages);
    const navigationLinks = this.generateNavigationLinks(page, allPages);
    
    return {
      page,
      componentsMarkdown,
      navigationLinks
    };
  }

  private generateComponentsMarkdown(components: PageComponent[], allPages: ReactPage[]): string {
    if (components.length === 0) {
      return '**No interactive components detected on this page.**';
    }

    // Group components by type
    const groupedComponents = this.groupComponentsByType(components);
    
    let markdown = '';
    
    Object.entries(groupedComponents).forEach(([type, comps]) => {
      markdown += `### ${this.formatComponentTypeHeader(type)}\n\n`;
      
      comps.forEach(component => {
        markdown += this.generateComponentMarkdown(component, allPages);
        markdown += '\n';
      });
      
      markdown += '\n';
    });
    
    return markdown;
  }

  private groupComponentsByType(components: PageComponent[]): Record<string, PageComponent[]> {
    const grouped: Record<string, PageComponent[]> = {};
    
    components.forEach(component => {
      const type = component.type;
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(component);
    });
    
    return grouped;
  }

  private formatComponentTypeHeader(type: string): string {
    const typeMap: Record<string, string> = {
      'button': '🔘 Buttons & Actions',
      'link': '🔗 Navigation Links', 
      'form': '📝 Forms & Input',
      'input': '📋 Input Fields',
      'modal': '🪟 Modals & Dialogs',
      'card': '🃏 Cards & Content',
      'navigation': '🧭 Navigation Components',
      'other': '🔧 Other Components'
    };
    
    return typeMap[type] || `🔧 ${type.charAt(0).toUpperCase() + type.slice(1)} Components`;
  }

  private generateComponentMarkdown(component: PageComponent, allPages: ReactPage[]): string {
    let markdown = `#### ${component.name}`;
    
    // Add component text if available
    if (component.text) {
      markdown += ` - "${component.text}"`;
    }
    
    markdown += `\n\n`;
    markdown += `> **Location**: \`${component.filePath}:${component.line}\`  \n`;
    markdown += `> **Type**: ${component.type}  \n`;
    markdown += `> **Description**: ${component.description}\n\n`;
    
    // Add component details
    if (component.onClick) {
      markdown += `**Click Handler**: \`${component.onClick}\`\n\n`;
    }
    
    if (component.navigatesTo) {
      const targetPage = this.findPageByRoute(component.navigatesTo, allPages);
      if (targetPage) {
        markdown += `**Navigates To**: [${targetPage.name}](#${targetPage.slug}) (\`${component.navigatesTo}\`)\n\n`;
      } else {
        markdown += `**Navigates To**: \`${component.navigatesTo}\`\n\n`;
      }
    }
    
    // Add props if any
    if (component.props.length > 0) {
      markdown += `**Props**:\n`;
      component.props.forEach(prop => {
        const value = prop.value ? ` = "${prop.value}"` : '';
        markdown += `- \`${prop.name}\` (${prop.type})${value}\n`;
      });
      markdown += '\n';
    }
    
    return markdown;
  }

  private findPageByRoute(route: string, pages: ReactPage[]): ReactPage | undefined {
    return pages.find(page => page.route === route);
  }

  private generateNavigationLinks(page: ReactPage, allPages: ReactPage[]): string[] {
    const links: string[] = [];
    
    // Find components that navigate to other pages
    page.components.forEach(component => {
      if (component.navigatesTo) {
        const targetPage = this.findPageByRoute(component.navigatesTo, allPages);
        if (targetPage) {
          links.push(`[${targetPage.name}](#${targetPage.slug})`);
        }
      }
    });
    
    return [...new Set(links)]; // Remove duplicates
  }

  private buildNavigationMap(pages: ReactPage[], navigations: PageNavigation[]): NavigationMap {
    // Build hierarchical navigation structure
    const structure = this.buildNavigationStructure(pages);
    
    // Build cross-references
    const crossReferences = this.buildCrossReferences(pages, navigations);
    
    return { structure, crossReferences };
  }

  private buildNavigationStructure(pages: ReactPage[]): NavigationNode[] {
    const structure: NavigationNode[] = [];
    
    // Group pages by route hierarchy
    const routeGroups = this.groupPagesByRoute(pages);
    
    Object.entries(routeGroups).forEach(([routePrefix, pageGroup]) => {
      const node: NavigationNode = {
        name: routePrefix === '/' ? 'Home' : this.formatRouteName(routePrefix),
        slug: this.generateSlug(routePrefix),
        type: 'page',
        children: [],
        route: routePrefix
      };
      
      // Add pages as children
      pageGroup.forEach(page => {
        const pageNode: NavigationNode = {
          name: page.name,
          slug: page.slug,
          type: 'page',
          children: [],
          route: page.route
        };
        
        // Add components as sub-children
        page.components.forEach(component => {
          pageNode.children.push({
            name: component.text || component.name,
            slug: `${page.slug}-${this.generateSlug(component.name)}`,
            type: 'component',
            children: []
          });
        });
        
        node.children.push(pageNode);
      });
      
      structure.push(node);
    });
    
    return structure;
  }

  private groupPagesByRoute(pages: ReactPage[]): Record<string, ReactPage[]> {
    const groups: Record<string, ReactPage[]> = {};
    
    pages.forEach(page => {
      const routeParts = page.route?.split('/') || [];
      const topLevel = routeParts.length > 1 ? `/${routeParts[1]}` : '/';
      
      if (!groups[topLevel]) {
        groups[topLevel] = [];
      }
      groups[topLevel].push(page);
    });
    
    return groups;
  }

  private formatRouteName(route: string): string {
    return route
      .replace(/^\//, '')
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || 'Home';
  }

  private buildCrossReferences(pages: ReactPage[], navigations: PageNavigation[]): CrossReference[] {
    const crossRefs: CrossReference[] = [];
    
    // Build cross-references from component navigation
    pages.forEach(page => {
      page.components.forEach(component => {
        if (component.navigatesTo) {
          const targetPage = this.findPageByRoute(component.navigatesTo, pages);
          if (targetPage) {
            crossRefs.push({
              from: page.slug,
              to: targetPage.slug,
              trigger: component.text || component.name,
              type: 'navigation'
            });
          }
        }
      });
    });
    
    return crossRefs;
  }

  private generateFrontendOverview(pages: ReactPage[]): string {
    const totalComponents = pages.reduce((sum, page) => sum + page.components.length, 0);
    const interactiveComponents = pages.reduce((sum, page) => 
      sum + page.components.filter(c => ['button', 'link', 'form', 'input'].includes(c.type)).length, 0
    );
    
    return `# Frontend Architecture Overview

This React application consists of **${pages.length} pages** with **${totalComponents} components** (${interactiveComponents} interactive).

## Pages Structure

${pages.map(page => `- **[${page.name}](#${page.slug})** (\`${page.route}\`) - ${page.components.length} components`).join('\n')}

## Component Distribution

${this.generateComponentDistribution(pages)}

## Navigation Flow

The application uses a combination of:
- **Direct links** for page-to-page navigation
- **Button clicks** for actions and form submissions
- **Programmatic navigation** using React Router or Next.js routing

Click on any page below to see its components and navigation details.`;
  }

  private generateComponentDistribution(pages: ReactPage[]): string {
    const componentTypes: Record<string, number> = {};
    
    pages.forEach(page => {
      page.components.forEach(component => {
        componentTypes[component.type] = (componentTypes[component.type] || 0) + 1;
      });
    });
    
    return Object.entries(componentTypes)
      .sort(([,a], [,b]) => b - a)
      .map(([type, count]) => `- **${this.formatComponentTypeHeader(type).replace(/🔘|🔗|📝|📋|🪟|🃏|🧭|🔧/g, '').trim()}**: ${count}`)
      .join('\n');
  }

  private generateSlug(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}