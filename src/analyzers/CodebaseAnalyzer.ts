import { glob } from 'glob';
import { readFileSync, statSync } from 'fs';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Project } from 'ts-morph';
import { join, relative, extname, dirname } from 'path';
import * as path from 'path';

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
  holisticInsights?: HolisticInsights;
}

export interface HolisticInsights {
  codeQuality: CodeQualityMetrics;
  patterns: ArchitecturalPatterns;
  dependencies: DependencyAnalysis;
  security: SecurityInsights;
  performance: PerformanceInsights;
  maintainability: MaintainabilityScore;
}

export interface CodeQualityMetrics {
  complexity: number;
  testCoverage: number;
  codeSmells: string[];
  duplications: number;
}

export interface ArchitecturalPatterns {
  identified: string[];
  antiPatterns: string[];
  recommendations: string[];
}

export interface DependencyAnalysis {
  outdated: string[];
  unused: string[];
  vulnerabilities: string[];
  bundleSize: number;
}

export interface SecurityInsights {
  vulnerabilities: SecurityVulnerability[];
  recommendations: string[];
  score: number;
}

export interface SecurityVulnerability {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  line: number;
  description: string;
}

export interface PerformanceInsights {
  bottlenecks: string[];
  optimizations: string[];
  score: number;
}

export interface MaintainabilityScore {
  score: number;
  factors: {
    complexity: number;
    documentation: number;
    testability: number;
    modularity: number;
  };
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

  async analyze(progressCallback?: (status: string, progress: number) => void): Promise<CodebaseAnalysis> {
    progressCallback?.('📋 Reading project configuration...', 0);
    const packageJson = this.readPackageJson();
    
    progressCallback?.('🔍 Discovering files...', 10);
    const files = await this.getProjectFiles();
    
    progressCallback?.('📁 Organizing by directories...', 20);
    const filesByDirectory = this.groupFilesByDirectory(files);
    
    progressCallback?.('⚡ Processing directories in parallel...', 30);
    const analysisResults = await this.analyzeFilesInParallel(filesByDirectory, progressCallback);
    
    progressCallback?.('🔍 Detecting frameworks and technologies...', 80);
    const frameworks = this.detectFrameworks(analysisResults);
    const databases = this.detectDatabases(analysisResults);
    const deployment = this.detectDeployment();
    
    progressCallback?.('🏗️ Analyzing architecture...', 90);
    const architecture = this.analyzeArchitecture(analysisResults);
    
    progressCallback?.('🧹 Running holistic sweep...', 95);
    const holisticAnalysis = await this.performHolisticSweep(analysisResults, frameworks, databases);
    
    progressCallback?.('✅ Analysis complete!', 100);
    
    return {
      projectName: packageJson?.name || 'Unknown Project',
      rootPath: this.rootPath,
      files: analysisResults,
      dependencies: packageJson?.dependencies || {},
      devDependencies: packageJson?.devDependencies || {},
      scripts: packageJson?.scripts || {},
      framework: frameworks,
      database: databases,
      deployment,
      architecture,
      holisticInsights: holisticAnalysis
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

      (traverse as any).default(ast, {
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

  private groupFilesByDirectory(files: string[]): Map<string, string[]> {
    const filesByDirectory = new Map<string, string[]>();
    
    files.forEach(file => {
      const dir = path.dirname(file);
      if (!filesByDirectory.has(dir)) {
        filesByDirectory.set(dir, []);
      }
      filesByDirectory.get(dir)!.push(file);
    });
    
    return filesByDirectory;
  }

  private async analyzeFilesInParallel(
    filesByDirectory: Map<string, string[]>, 
    progressCallback?: (status: string, progress: number) => void
  ): Promise<FileInfo[]> {
    const directories = Array.from(filesByDirectory.keys());
    const totalDirectories = directories.length;
    const results: FileInfo[] = [];
    
    // Process directories in batches to avoid overwhelming the system
    const batchSize = Math.min(4, totalDirectories); // Max 4 concurrent directories
    
    for (let i = 0; i < totalDirectories; i += batchSize) {
      const batch = directories.slice(i, i + batchSize);
      const batchPromises = batch.map(async (dir) => {
        const files = filesByDirectory.get(dir)!;
        progressCallback?.(`📁 Processing ${dir}...`, 30 + ((i / totalDirectories) * 40));
        
        const dirResults = await Promise.all(
          files.map(file => this.analyzeFile(file))
        );
        return dirResults;
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.flat());
    }
    
    return results;
  }

  private async performHolisticSweep(
    files: FileInfo[], 
    frameworks: string[], 
    databases: DatabaseInfo[]
  ): Promise<HolisticInsights> {
    const codeQuality = this.analyzeCodeQuality(files);
    const patterns = this.identifyArchitecturalPatterns(files, frameworks);
    const dependencies = this.analyzeDependencies(files);
    const security = this.analyzeSecurityConcerns(files);
    const performance = this.analyzePerformance(files);
    const maintainability = this.calculateMaintainabilityScore(files);

    return {
      codeQuality,
      patterns,
      dependencies,
      security,
      performance,
      maintainability
    };
  }

  private analyzeCodeQuality(files: FileInfo[]): CodeQualityMetrics {
    let totalComplexity = 0;
    const codeSmells: string[] = [];
    let duplications = 0;

    files.forEach(file => {
      // Calculate cyclomatic complexity
      const complexity = file.functions.length * 2 + file.classes.length * 3;
      totalComplexity += complexity;

      // Detect code smells
      if (file.functions.length > 10) {
        codeSmells.push(`Too many functions in ${file.relativePath}`);
      }
      if (file.content.length > 1000 && file.functions.length < 2) {
        codeSmells.push(`Large file with few functions: ${file.relativePath}`);
      }
      if (file.functions.some(f => f.params.length > 5)) {
        codeSmells.push(`Functions with too many parameters in ${file.relativePath}`);
      }
    });

    // Estimate test coverage (basic heuristic)
    const testFiles = files.filter(f => 
      f.relativePath.includes('.test.') || 
      f.relativePath.includes('.spec.') ||
      f.relativePath.includes('__tests__')
    );
    const testCoverage = Math.min(100, (testFiles.length / files.length) * 200);

    return {
      complexity: totalComplexity / files.length,
      testCoverage,
      codeSmells,
      duplications
    };
  }

  private identifyArchitecturalPatterns(files: FileInfo[], frameworks: string[]): ArchitecturalPatterns {
    const identified: string[] = [];
    const antiPatterns: string[] = [];
    const recommendations: string[] = [];

    // Detect MVC pattern
    const hasControllers = files.some(f => f.relativePath.includes('controller'));
    const hasModels = files.some(f => f.relativePath.includes('model'));
    const hasViews = files.some(f => f.relativePath.includes('view') || f.components.length > 0);
    
    if (hasControllers && hasModels && hasViews) {
      identified.push('MVC (Model-View-Controller)');
    }

    // Detect Component-based architecture
    if (frameworks.includes('React') || frameworks.includes('Vue')) {
      identified.push('Component-based Architecture');
      
      // Check for proper component organization
      const componentFiles = files.filter(f => f.components.length > 0);
      if (componentFiles.length > 10 && !files.some(f => f.relativePath.includes('components/'))) {
        antiPatterns.push('Components not organized in dedicated folder');
        recommendations.push('Organize components in a dedicated components/ directory');
      }
    }

    // Detect API patterns
    const apiFiles = files.filter(f => f.routes.length > 0);
    if (apiFiles.length > 0) {
      identified.push('RESTful API Pattern');
    }

    // Detect layered architecture
    const hasServices = files.some(f => f.relativePath.includes('service'));
    const hasRepositories = files.some(f => f.relativePath.includes('repository') || f.relativePath.includes('dao'));
    
    if (hasServices && hasRepositories) {
      identified.push('Layered Architecture');
    }

    return { identified, antiPatterns, recommendations };
  }

  private analyzeDependencies(files: FileInfo[]): DependencyAnalysis {
    const allImports = new Set<string>();
    files.forEach(file => {
      file.dependencies.forEach(dep => allImports.add(dep));
    });

    // This would need external tools for full analysis
    return {
      outdated: [], // Would need npm outdated
      unused: [], // Would need depcheck
      vulnerabilities: [], // Would need npm audit
      bundleSize: 0 // Would need webpack-bundle-analyzer
    };
  }

  private analyzeSecurityConcerns(files: FileInfo[]): SecurityInsights {
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];

    files.forEach(file => {
      // Check for common security issues
      if (file.content.includes('eval(')) {
        vulnerabilities.push({
          type: 'Code Injection',
          severity: 'high',
          file: file.relativePath,
          line: 0, // Would need more sophisticated parsing
          description: 'Use of eval() can lead to code injection vulnerabilities'
        });
      }

      if (file.content.includes('innerHTML') && !file.content.includes('DOMPurify')) {
        vulnerabilities.push({
          type: 'XSS Vulnerability',
          severity: 'medium',
          file: file.relativePath,
          line: 0,
          description: 'Direct innerHTML assignment without sanitization'
        });
      }

      if (file.content.includes('process.env') && file.relativePath.includes('client')) {
        vulnerabilities.push({
          type: 'Information Disclosure',
          severity: 'medium',
          file: file.relativePath,
          line: 0,
          description: 'Environment variables used in client-side code'
        });
      }
    });

    const score = Math.max(0, 100 - (vulnerabilities.length * 10));

    if (score < 80) {
      recommendations.push('Review and fix identified security vulnerabilities');
    }
    if (!files.some(f => f.relativePath.includes('security') || f.relativePath.includes('auth'))) {
      recommendations.push('Consider implementing dedicated security/authentication modules');
    }

    return { vulnerabilities, recommendations, score };
  }

  private analyzePerformance(files: FileInfo[]): PerformanceInsights {
    const bottlenecks: string[] = [];
    const optimizations: string[] = [];

    files.forEach(file => {
      // Check for performance bottlenecks
      if (file.content.includes('useEffect') && file.content.includes('[]') === false) {
        bottlenecks.push(`Potential re-render issue in ${file.relativePath}`);
        optimizations.push('Add dependency arrays to useEffect hooks');
      }

      if (file.content.includes('map(') && file.content.includes('filter(')) {
        bottlenecks.push(`Multiple array iterations in ${file.relativePath}`);
        optimizations.push('Consider combining map and filter operations');
      }

      if (file.functions.some(f => f.name.includes('sync') && f.isAsync === false)) {
        bottlenecks.push(`Synchronous operations in ${file.relativePath}`);
        optimizations.push('Consider making blocking operations asynchronous');
      }
    });

    const score = Math.max(0, 100 - (bottlenecks.length * 5));

    return { bottlenecks, optimizations, score };
  }

  private calculateMaintainabilityScore(files: FileInfo[]): MaintainabilityScore {
    const avgComplexity = files.reduce((sum, file) => 
      sum + file.functions.length + file.classes.length, 0) / files.length;
    
    const documentationRatio = files.filter(f => 
      f.content.includes('/**') || f.content.includes('//') || f.content.includes('#')
    ).length / files.length;
    
    const hasTests = files.some(f => 
      f.relativePath.includes('.test.') || f.relativePath.includes('.spec.')
    );
    
    const hasModularStructure = files.some(f => 
      f.relativePath.includes('/') && f.exports.length > 0
    );

    const complexity = Math.max(0, 100 - (avgComplexity * 5));
    const documentation = documentationRatio * 100;
    const testability = hasTests ? 80 : 20;
    const modularity = hasModularStructure ? 90 : 30;

    const overallScore = (complexity + documentation + testability + modularity) / 4;

    return {
      score: Math.round(overallScore),
      factors: {
        complexity: Math.round(complexity),
        documentation: Math.round(documentation),
        testability,
        modularity
      }
    };
  }

}