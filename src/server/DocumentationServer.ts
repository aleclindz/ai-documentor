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
      res.json({ content: this.documentation?.frontend });
    });

    this.app.get('/api/backend', async (req, res) => {
      await this.ensureDocumentation();
      res.json({ content: this.documentation?.backend });
    });

    this.app.get('/api/database', async (req, res) => {
      await this.ensureDocumentation();
      res.json({ content: this.documentation?.database });
    });

    this.app.get('/api/userflows', async (req, res) => {
      await this.ensureDocumentation();
      res.json({ content: this.documentation?.userFlows });
    });

    this.app.get('/api/architecture', async (req, res) => {
      await this.ensureDocumentation();
      res.json({ diagram: this.documentation?.architectureDiagram });
    });

    this.app.get('/api/deployment', async (req, res) => {
      await this.ensureDocumentation();
      res.json({ content: this.documentation?.deploymentGuide });
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