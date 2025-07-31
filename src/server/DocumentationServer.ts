import express from 'express';
import { join, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { GeneratedDocumentation } from '../generators/DocumentationGenerator.js';
import { CodebaseAnalyzer } from '../analyzers/CodebaseAnalyzer.js';
import { DocumentationGenerator } from '../generators/DocumentationGenerator.js';
import { Config } from '../utils/Config.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DocumentationServer {
  private app: express.Application;
  private server: any;
  private wss?: WebSocketServer;
  private analyzer: CodebaseAnalyzer;
  private generator?: DocumentationGenerator;
  private documentation?: GeneratedDocumentation;
  private config: any;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.analyzer = new CodebaseAnalyzer(process.cwd());
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setConfig(config: any) {
    this.config = config;
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    // Serve static files from the templates/static directory
    this.app.use(express.static(join(__dirname, '../templates/static')));
    this.app.set('view engine', 'ejs');
    this.app.set('views', join(__dirname, '../templates'));
  }

  private setupRoutes(): void {
    // Main documentation page
    this.app.get('/', async (req, res) => {
      await this.ensureDocumentation();
      res.render('index', { 
        documentation: this.documentation,
        mermaidCDN: 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js',
        marked: marked
      });
    });

    // API endpoints for navigation
    this.app.get('/api/overview', async (req, res) => {
      await this.ensureDocumentation();
      res.json({ content: this.documentation?.overview });
    });

    this.app.get('/api/frontend', async (req, res) => {
      await this.ensureDocumentation();
      const content = this.documentation?.frontend;
      if (!content) {
        res.json({ content: 'This project does not contain frontend components or user interface code.' });
      } else {
        res.json({ content });
      }
    });

    // Frontend Pages section
    this.app.get('/api/frontend-pages', async (req, res) => {
      await this.ensureDocumentation();
      const frontend = this.documentation?.frontend;
      if (!frontend || !frontend.pages || frontend.pages.length === 0) {
        res.json({ content: 'No pages detected in this frontend application.' });
      } else {
        // Generate Pages markdown from the pages data
        let pagesMarkdown = `# Frontend Pages\n\nThis application consists of ${frontend.pages.length} distinct pages that users can navigate to.\n\n`;
        
        frontend.pages.forEach((page: any) => {
          pagesMarkdown += `## ${page.name}\n`;
          pagesMarkdown += `**Route**: \`${page.route}\`\n\n`;
          pagesMarkdown += `${page.purpose}\n\n`;
          
          if (page.componentsMarkdown) {
            pagesMarkdown += page.componentsMarkdown + '\n\n';
          }
          
          if (page.navigationLinks && page.navigationLinks.length > 0) {
            pagesMarkdown += `### Navigation Links\n\n`;
            pagesMarkdown += `This page provides navigation to:\n`;
            page.navigationLinks.forEach((link: string) => {
              pagesMarkdown += `- ${link}\n`;
            });
            pagesMarkdown += '\n';
          }
        });
        
        res.json({ content: pagesMarkdown });
      }
    });

    // Frontend Components section
    this.app.get('/api/frontend-components', async (req, res) => {
      await this.ensureDocumentation();
      const frontend = this.documentation?.frontend;
      if (!frontend || !frontend.components || frontend.components.length === 0) {
        res.json({ content: 'No interactive components detected in this frontend application.' });
      } else {
        // Generate Components markdown
        let componentsMarkdown = `# Frontend Components\n\nThis application contains ${frontend.components.length} interactive components across all pages.\n\n`;
        
        // Group components by page/location
        const componentsByFile: Record<string, any[]> = {};
        frontend.components.forEach((component: any) => {
          const location = component.filePath || 'Unknown';
          if (!componentsByFile[location]) {
            componentsByFile[location] = [];
          }
          componentsByFile[location].push(component);
        });
        
        Object.entries(componentsByFile).forEach(([location, components]) => {
          componentsMarkdown += `## Components in ${location}\n\n`;
          
          components.forEach(component => {
            componentsMarkdown += `### ${component.name}\n\n`;
            componentsMarkdown += `**Purpose**: ${component.purpose}\n\n`;
            
            if (component.props && component.props.length > 0) {
              componentsMarkdown += `**Props**: ${component.props.join(', ')}\n\n`;
            }
            
            componentsMarkdown += `**Usage**: ${component.usage}\n\n`;
            componentsMarkdown += `**Interactions**: ${component.interactions}\n\n`;
            
            if (component.uiEvents && component.uiEvents.length > 0) {
              componentsMarkdown += `**UI Events**:\n`;
              component.uiEvents.forEach((event: any) => {
                componentsMarkdown += `- ${event.event}: ${event.description}\n`;
              });
              componentsMarkdown += '\n';
            }
          });
        });
        
        res.json({ content: componentsMarkdown });
      }
    });

    this.app.get('/api/backend', async (req, res) => {
      await this.ensureDocumentation();
      const content = this.documentation?.backend;
      if (!content) {
        res.json({ content: 'This project does not contain backend server code or API endpoints.' });
      } else {
        res.json({ content });
      }
    });

    this.app.get('/api/database', async (req, res) => {
      await this.ensureDocumentation();
      const content = this.documentation?.database;
      if (!content) {
        res.json({ content: 'This project does not contain database connections or data persistence code.' });
      } else {
        res.json({ content });
      }
    });

    this.app.get('/api/userflows', async (req, res) => {
      await this.ensureDocumentation();
      const content = this.documentation?.userFlows;
      if (!content || content.length === 0) {
        res.json({ content: 'No user workflow documentation available for this project type.' });
      } else {
        res.json({ content });
      }
    });

    this.app.get('/api/architecture', async (req, res) => {
      await this.ensureDocumentation();
      res.json({ diagram: this.documentation?.architectureDiagram });
    });

    this.app.get('/api/deployment', async (req, res) => {
      await this.ensureDocumentation();
      const content = this.documentation?.deploymentGuide;
      if (!content) {
        res.json({ content: 'No deployment configuration detected for this project.' });
      } else {
        res.json({ content });
      }
    });

    this.app.get('/api/troubleshooting', async (req, res) => {
      await this.ensureDocumentation();
      res.json({ content: this.documentation?.troubleshooting });
    });

    // Regenerate documentation
    this.app.post('/api/regenerate', async (req, res) => {
      try {
        await this.generateDocumentation();
        res.json({ success: true, message: 'Documentation regenerated successfully' });
      } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  private async ensureDocumentation(): Promise<void> {
    if (!this.documentation) {
      await this.loadDocumentation();
    }
  }

  private async loadDocumentation(): Promise<void> {
    try {
      const outputDir = this.config?.outputDir || './docs';
      const documentationPath = join(outputDir, 'documentation.json');
      
      if (existsSync(documentationPath)) {
        console.log('📖 Loading existing documentation...');
        const content = readFileSync(documentationPath, 'utf-8');
        this.documentation = JSON.parse(content);
        console.log('✅ Documentation loaded successfully');
      } else {
        console.log('📝 No existing documentation found, generating new...');
        await this.generateDocumentation();
      }
    } catch (error) {
      console.error('❌ Failed to load documentation:', error);
      console.log('📝 Fallback: generating new documentation...');
      await this.generateDocumentation();
    }
  }

  private setupWebSocket(): void {
    this.wss = new WebSocketServer({ server: this.server });
    
    this.wss.on('connection', (ws) => {
      console.log('📱 Client connected');
      
      ws.on('close', () => {
        console.log('📱 Client disconnected');
      });
    });
  }

  refresh(): void {
    if (this.wss) {
      this.wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify({ type: 'refresh' }));
        }
      });
    }
  }

  private async generateDocumentation(): Promise<void> {
    try {
      if (!this.generator && this.config) {
        this.generator = new DocumentationGenerator(this.config);
      }
      
      const analysis = await this.analyzer.analyze();
      if (this.generator) {
        this.documentation = await this.generator.generate(analysis, (status: string) => {
          console.log(status);
        });
      }
    } catch (error) {
      console.error('Failed to generate documentation:', error);
      throw error;
    }
  }

  async start(port: number = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(port, () => {
        console.log(`📖 Documentation server running at http://localhost:${port}`);
        resolve();
      });
      
      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.log(`❌ Port ${port} is already in use`);
          console.log(`💡 Stop the existing server or use a different port with --port <port>`);
          process.exit(1);
        } else {
          console.error(`❌ Server error:`, error);
          reject(error);
        }
      });
    });
  }
}