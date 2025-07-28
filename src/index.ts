export { CodebaseAnalyzer } from './analyzers/CodebaseAnalyzer.js';
export { DocumentationGenerator } from './generators/DocumentationGenerator.js';
export { MermaidGenerator } from './generators/MermaidGenerator.js';
export { DocumentationServer } from './server/DocumentationServer.js';
export { Config } from './utils/Config.js';

// Re-export types for consumers
export type {
  CodebaseAnalysis,
  FileInfo,
  FunctionInfo,
  ComponentInfo,
  RouteInfo,
  DatabaseQuery,
  FileType
} from './analyzers/CodebaseAnalyzer.js';

export type {
  GeneratedDocumentation,
  FrontendDocumentation,
  BackendDocumentation,
  DatabaseDocumentation,
  UserFlow,
  APIDocumentation
} from './generators/DocumentationGenerator.js';

export type {
  DocumentorConfig
} from './utils/Config.js';