import express from 'express';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { marked } from 'marked';
import { GeneratedDocumentation } from '../generators/DocumentationGenerator.js';
import { CodebaseAnalyzer } from '../analyzers/CodebaseAnalyzer.js';
import { DocumentationGenerator } from '../generators/DocumentationGenerator.js';
import { Config } from '../utils/Config.js';

export class DocumentationServer {
  private app: express.Application;
  private analyzer: CodebaseAnalyzer;
  private generator?: DocumentationGenerator;
  private documentation?: GeneratedDocumentation;

  constructor() {
    this.app = express();
    this.analyzer = new CodebaseAnalyzer(process.cwd());
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
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
        mermaidCDN: 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js'
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
      await this.generateDocumentation();
    }
  }

  private async generateDocumentation(): Promise<void> {
    try {
      const config = await Config.load();
      this.generator = new DocumentationGenerator(config);
      
      const analysis = await this.analyzer.analyze();
      this.documentation = await this.generator.generate(analysis);
    } catch (error) {
      console.error('Failed to generate documentation:', error);
      throw error;
    }
  }

  async start(port: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        console.log(`📖 Documentation server running at http://localhost:${port}`);
        resolve();
      });
    });
  }
}