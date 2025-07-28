import { glob } from 'glob';
import { readFileSync, statSync } from 'fs';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Project } from 'ts-morph';
import { join, relative, extname } from 'path';
import chokidar from 'chokidar';

export interface FileInfo {
  path: string;
  relativePath: string;
  type: FileType;
  size: number;
  lastModified: Date;
  content: string;
  dependencies: string[];
  exports: string[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  components: ComponentInfo[];
  routes: RouteInfo[];
  databaseQueries: DatabaseQuery[];
}

export interface FunctionInfo {
  name: string;
  params: string[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  startLine: number;
  endLine: number;
  description?: string;
}

export interface ClassInfo {
  name: string;
  methods: FunctionInfo[];
  properties: string[];
  extends?: string;
  implements?: string[];
  isExported: boolean;
}

export interface ComponentInfo {
  name: string;
  props: string[];
  hooks: string[];
  isExported: boolean;
  framework: 'react' | 'vue' | 'svelte' | 'angular';
}

export interface RouteInfo {
  path: string;
  method: string;
  handler: string;
  middleware: string[];
  params: string[];
}

export interface DatabaseQuery {
  type: 'select' | 'insert' | 'update' | 'delete';
  table: string;
  query: string;
  location: string;
}

export enum FileType {
  TypeScript = 'typescript',
  JavaScript = 'javascript',
  React = 'react',
  Vue = 'vue',
  Svelte = 'svelte',
  CSS = 'css',
  SCSS = 'scss',
  HTML = 'html',
  JSON = 'json',
  Markdown = 'markdown',
  Python = 'python',
  Go = 'go',
  Rust = 'rust',
  Java = 'java',
  Config = 'config',
  Unknown = 'unknown'
}

export interface CodebaseAnalysis {
  projectName: string;
  rootPath: string;
  files: FileInfo[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  framework: string[];
  database: DatabaseInfo[];
  deployment: DeploymentInfo[];
  architecture: ArchitectureInfo;
}

export interface DatabaseInfo {
  type: string;
  host?: string;
  tables: string[];
  schema?: any;
}

export interface DeploymentInfo {
  platform: string;
  config: any;
  environment: string[];
}

export interface ArchitectureInfo {
  frontend: string[];
  backend: string[];
  database: string[];
  services: string[];
  apis: string[];
}

export class CodebaseAnalyzer {
  private rootPath: string;
  private tsProject?: Project;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  async analyze(): Promise<CodebaseAnalysis> {
    const packageJson = this.readPackageJson();
    const files = await this.getProjectFiles();
    const analysisResults = await Promise.all(files.map(f => this.analyzeFile(f)));
    
    return {
      projectName: packageJson?.name || 'Unknown Project',
      rootPath: this.rootPath,
      files: analysisResults,
      dependencies: packageJson?.dependencies || {},
      devDependencies: packageJson?.devDependencies || {},
      scripts: packageJson?.scripts || {},
      framework: this.detectFrameworks(analysisResults),
      database: this.detectDatabases(analysisResults),
      deployment: this.detectDeployment(),
      architecture: this.analyzeArchitecture(analysisResults)
    };
  }

  private async getProjectFiles(): Promise<string[]> {
    const patterns = [
      '**/*.{ts,tsx,js,jsx}',
      '**/*.{py,go,rs,java}',
      '**/*.{vue,svelte}',
      '**/*.{css,scss,sass}',
      '**/*.{html,md}',
      '**/*.{json,yaml,yml}',
      '**/package.json',
      '**/tsconfig.json',
      '**/next.config.js',
      '**/vercel.json',
      '**/supabase/**',
      '**/prisma/**'
    ];

    const ignorePatterns = [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.git/**',
      '**/*.min.js',
      '**/*.test.{ts,js}',
      '**/*.spec.{ts,js}'
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: this.rootPath,
        ignore: ignorePatterns,
        absolute: true
      });
      files.push(...matches);
    }

    return [...new Set(files)];
  }

  private async analyzeFile(filePath: string): Promise<FileInfo> {
    const relativePath = relative(this.rootPath, filePath);
    const stats = statSync(filePath);
    const content = readFileSync(filePath, 'utf-8');
    const fileType = this.getFileType(filePath);

    const analysis: FileInfo = {
      path: filePath,
      relativePath,
      type: fileType,
      size: stats.size,
      lastModified: stats.mtime,
      content,
      dependencies: [],
      exports: [],
      functions: [],
      classes: [],
      components: [],
      routes: [],
      databaseQueries: []
    };

    if (fileType === FileType.TypeScript || fileType === FileType.JavaScript || fileType === FileType.React) {
      await this.analyzeJSFile(analysis);
    } else if (fileType === FileType.JSON) {
      this.analyzeJsonFile(analysis);
    }

    return analysis;
  }

  private async analyzeJSFile(fileInfo: FileInfo): Promise<void> {
    try {
      const ast = parse(fileInfo.content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy']
      });

      traverse(ast, {
        ImportDeclaration: (path) => {
          fileInfo.dependencies.push(path.node.source.value);
        },
        
        ExportNamedDeclaration: (path) => {
          if (path.node.declaration) {
            if (t.isFunctionDeclaration(path.node.declaration)) {
              fileInfo.exports.push(path.node.declaration.id?.name || 'anonymous');
            } else if (t.isVariableDeclaration(path.node.declaration)) {
              path.node.declaration.declarations.forEach(decl => {
                if (t.isIdentifier(decl.id)) {
                  fileInfo.exports.push(decl.id.name);
                }
              });
            }
          }
        },

        FunctionDeclaration: (path) => {
          const func = path.node;
          fileInfo.functions.push({
            name: func.id?.name || 'anonymous',
            params: func.params.map(p => t.isIdentifier(p) ? p.name : 'param'),
            isAsync: func.async,
            isExported: path.parent.type === 'ExportNamedDeclaration' || path.parent.type === 'ExportDefaultDeclaration',
            startLine: func.loc?.start.line || 0,
            endLine: func.loc?.end.line || 0
          });
        },

        ClassDeclaration: (path) => {
          const cls = path.node;
          const methods: FunctionInfo[] = [];
          
          cls.body.body.forEach(member => {
            if (t.isClassMethod(member) && t.isIdentifier(member.key)) {
              methods.push({
                name: member.key.name,
                params: member.params.map(p => t.isIdentifier(p) ? p.name : 'param'),
                isAsync: member.async,
                isExported: false,
                startLine: member.loc?.start.line || 0,
                endLine: member.loc?.end.line || 0
              });
            }
          });

          fileInfo.classes.push({
            name: cls.id?.name || 'anonymous',
            methods,
            properties: [],
            extends: cls.superClass && t.isIdentifier(cls.superClass) ? cls.superClass.name : undefined,
            isExported: path.parent.type === 'ExportNamedDeclaration' || path.parent.type === 'ExportDefaultDeclaration'
          });
        },

        // Detect React components
        JSXElement: (path) => {
          const parentFunction = path.getFunctionParent();
          if (parentFunction && t.isFunctionDeclaration(parentFunction.node)) {
            const componentName = parentFunction.node.id?.name;
            if (componentName && !fileInfo.components.some(c => c.name === componentName)) {
              fileInfo.components.push({
                name: componentName,
                props: [],
                hooks: [],
                isExported: parentFunction.parent.type === 'ExportNamedDeclaration',
                framework: 'react'
              });
            }
          }
        },

        // Detect API routes and database queries
        CallExpression: (path) => {
          const callee = path.node.callee;
          
          // Express routes
          if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
            const method = callee.property.name;
            if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
              const args = path.node.arguments;
              if (args.length > 0 && t.isStringLiteral(args[0])) {
                fileInfo.routes.push({
                  path: args[0].value,
                  method: method.toUpperCase(),
                  handler: 'handler',
                  middleware: [],
                  params: []
                });
              }
            }
          }

          // Database queries
          if (t.isIdentifier(callee)) {
            const methodName = callee.name;
            if (['query', 'select', 'insert', 'update', 'delete', 'from'].includes(methodName.toLowerCase())) {
              const args = path.node.arguments;
              if (args.length > 0 && t.isStringLiteral(args[0])) {
                fileInfo.databaseQueries.push({
                  type: methodName.toLowerCase() as any,
                  table: 'unknown',
                  query: args[0].value,
                  location: `${fileInfo.relativePath}:${path.node.loc?.start.line || 0}`
                });
              }
            }
          }
        }
      });
    } catch (error) {
      console.warn(`Failed to parse ${fileInfo.relativePath}:`, error);
    }
  }

  private analyzeJsonFile(fileInfo: FileInfo): void {
    try {
      const json = JSON.parse(fileInfo.content);
      if (fileInfo.relativePath.includes('package.json')) {
        if (json.dependencies) {
          fileInfo.dependencies = Object.keys(json.dependencies);
        }
      }
    } catch (error) {
      console.warn(`Failed to parse JSON ${fileInfo.relativePath}:`, error);
    }
  }

  private getFileType(filePath: string): FileType {
    const ext = extname(filePath).toLowerCase();
    const basename = filePath.split('/').pop() || '';

    if (ext === '.ts' || ext === '.tsx') return FileType.TypeScript;
    if (ext === '.js' || ext === '.jsx') return FileType.JavaScript;
    if (ext === '.vue') return FileType.Vue;
    if (ext === '.svelte') return FileType.Svelte;
    if (ext === '.css') return FileType.CSS;
    if (ext === '.scss' || ext === '.sass') return FileType.SCSS;
    if (ext === '.html') return FileType.HTML;
    if (ext === '.json') return FileType.JSON;
    if (ext === '.md') return FileType.Markdown;
    if (ext === '.py') return FileType.Python;
    if (ext === '.go') return FileType.Go;
    if (ext === '.rs') return FileType.Rust;
    if (ext === '.java') return FileType.Java;

    if (['package.json', 'tsconfig.json', 'next.config.js', 'vercel.json'].includes(basename)) {
      return FileType.Config;
    }

    return FileType.Unknown;
  }

  private readPackageJson(): any {
    try {
      const packagePath = join(this.rootPath, 'package.json');
      return JSON.parse(readFileSync(packagePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  private detectFrameworks(files: FileInfo[]): string[] {
    const frameworks: string[] = [];
    
    files.forEach(file => {
      const deps = [...file.dependencies];
      
      if (deps.some(d => d.includes('react'))) frameworks.push('React');
      if (deps.some(d => d.includes('vue'))) frameworks.push('Vue');
      if (deps.some(d => d.includes('svelte'))) frameworks.push('Svelte');
      if (deps.some(d => d.includes('angular'))) frameworks.push('Angular');
      if (deps.some(d => d.includes('next'))) frameworks.push('Next.js');
      if (deps.some(d => d.includes('nuxt'))) frameworks.push('Nuxt.js');
      if (deps.some(d => d.includes('express'))) frameworks.push('Express');
      if (deps.some(d => d.includes('fastify'))) frameworks.push('Fastify');
    });

    return [...new Set(frameworks)];
  }

  private detectDatabases(files: FileInfo[]): DatabaseInfo[] {
    const databases: DatabaseInfo[] = [];
    
    files.forEach(file => {
      const deps = [...file.dependencies];
      
      if (deps.some(d => d.includes('prisma'))) {
        databases.push({ type: 'PostgreSQL/MySQL (Prisma)', tables: [] });
      }
      if (deps.some(d => d.includes('mongoose'))) {
        databases.push({ type: 'MongoDB (Mongoose)', tables: [] });
      }
      if (deps.some(d => d.includes('supabase'))) {
        databases.push({ type: 'Supabase', tables: [] });
      }
    });

    return databases;
  }

  private detectDeployment(): DeploymentInfo[] {
    const deployments: DeploymentInfo[] = [];
    
    try {
      const vercelConfig = join(this.rootPath, 'vercel.json');
      if (readFileSync(vercelConfig, 'utf-8')) {
        deployments.push({ platform: 'Vercel', config: {}, environment: [] });
      }
    } catch {}

    try {
      const packageJson = this.readPackageJson();
      if (packageJson?.scripts?.build && packageJson?.scripts?.start) {
        deployments.push({ platform: 'Generic Node.js', config: {}, environment: [] });
      }
    } catch {}

    return deployments;
  }

  private analyzeArchitecture(files: FileInfo[]): ArchitectureInfo {
    const frontend: string[] = [];
    const backend: string[] = [];
    const database: string[] = [];
    const services: string[] = [];
    const apis: string[] = [];

    files.forEach(file => {
      if (file.components.length > 0) {
        frontend.push(file.relativePath);
      }
      
      if (file.routes.length > 0) {
        backend.push(file.relativePath);
        apis.push(...file.routes.map(r => `${r.method} ${r.path}`));
      }
      
      if (file.databaseQueries.length > 0) {
        database.push(file.relativePath);
      }
    });

    return { frontend, backend, database, services, apis };
  }

  watch(callback: (changes: string[]) => void): void {
    const watcher = chokidar.watch(this.rootPath, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true
    });

    watcher.on('change', (path) => callback([path]));
    watcher.on('add', (path) => callback([path]));
    watcher.on('unlink', (path) => callback([path]));
  }
}