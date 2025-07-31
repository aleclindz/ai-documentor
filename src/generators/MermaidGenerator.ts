import { CodebaseAnalysis, FileInfo } from '../analyzers/CodebaseAnalyzer.js';

export class MermaidGenerator {
  
  async generateArchitectureDiagram(analysis: CodebaseAnalysis): Promise<string> {
    const components = this.extractComponents(analysis);
    
    return `
graph TB
    %% Frontend Layer
    subgraph "Frontend Layer"
        ${components.frontend.map((comp, idx) => `FE${idx}["${comp}"]`).join('\n        ')}
    end
    
    %% Backend Layer
    subgraph "Backend Layer"
        ${components.backend.map((comp, idx) => `BE${idx}["${comp}"]`).join('\n        ')}
    end
    
    %% Database Layer
    subgraph "Database Layer"
        ${components.database.map((comp, idx) => `DB${idx}["${comp}"]`).join('\n        ')}
    end
    
    %% External Services
    subgraph "External Services"
        ${components.external.map((comp, idx) => `EXT${idx}["${comp}"]`).join('\n        ')}
    end
    
    %% Connections
    ${this.generateConnections(components)}
    
    %% Styling
    classDef frontend fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef backend fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef database fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px
    
    ${components.frontend.map((_, idx) => `class FE${idx} frontend`).join('\n    ')}
    ${components.backend.map((_, idx) => `class BE${idx} backend`).join('\n    ')}
    ${components.database.map((_, idx) => `class DB${idx} database`).join('\n    ')}
    ${components.external.map((_, idx) => `class EXT${idx} external`).join('\n    ')}
`;
  }

  async generateUserFlowDiagram(flowName: string): Promise<string> {
    return `
graph TD
    A[User Opens Application] --> B{Authentication Required?}
    B -->|Yes| C[Login/Register]
    B -->|No| D[Main Dashboard]
    C --> D
    D --> E[User Action]
    E --> F[Frontend Component]
    F --> G[API Call]
    G --> H[Backend Processing]
    H --> I[Database Query]
    I --> J[Response to Frontend]
    J --> K[UI Update]
    K --> L[User Sees Result]
    
    style A fill:#e3f2fd
    style L fill:#e8f5e8
    style G fill:#fff3e0
    style I fill:#fce4ec
`;
  }

  async generateDatabaseSchema(analysis: CodebaseAnalysis): Promise<string> {
    const tables = this.extractDatabaseTables(analysis);
    
    return `
erDiagram
    ${tables.map(table => `
    ${table.name} {
        ${table.columns.map(col => `${col.type} ${col.name}`).join('\n        ')}
    }`).join('\n    ')}
    
    ${this.generateRelationships(tables)}
`;
  }

  async generateComponentHierarchy(analysis: CodebaseAnalysis): Promise<string> {
    const components = analysis.files
      .filter(f => f.components.length > 0)
      .flatMap(f => f.components.map(c => ({ ...c, file: f.relativePath })));

    return `
graph TD
    App[App Root]
    ${components.map((comp, idx) => `
    App --> C${idx}[${comp.name}]`).join('')}
    
    ${components.map((comp, idx) => `
    C${idx} --> F${idx}[${comp.file}]`).join('')}
    
    style App fill:#e3f2fd,stroke:#1976d2,stroke-width:3px
    ${components.map((_, idx) => `style C${idx} fill:#f3e5f5,stroke:#7b1fa2`).join('\n    ')}
`;
  }

  async generateAPIFlowDiagram(analysis: CodebaseAnalysis): Promise<string> {
    const apis = analysis.files.flatMap(f => f.routes);
    
    return `
sequenceDiagram
    participant C as Client
    participant F as Frontend
    participant B as Backend
    participant D as Database
    
    ${apis.slice(0, 5).map((api, idx) => `
    C->>F: User Action ${idx + 1}
    F->>B: ${api.method} ${api.path}
    B->>D: Query Data
    D-->>B: Return Results
    B-->>F: JSON Response
    F-->>C: Update UI`).join('\n    ')}
`;
  }

  private extractComponents(analysis: CodebaseAnalysis) {
    const frontend = [
      ...new Set([
        ...analysis.files
          .filter(f => f.components.length > 0)
          .flatMap(f => f.components.map(c => c.name)),
        ...analysis.framework.filter(f => ['React', 'Vue', 'Angular', 'Svelte'].includes(f))
      ])
    ].slice(0, 8); // Limit to 8 most important frontend components

    const backend = [
      ...new Set([
        ...analysis.files
          .filter(f => f.routes.length > 0)
          .map(f => f.relativePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'API'),
        ...analysis.framework.filter(f => ['Express', 'Fastify', 'NestJS'].includes(f))
      ])
    ].slice(0, 6); // Limit to 6 most important backend components

    // Simplify database representation - group by type instead of individual instances
    const database = [
      ...new Set(analysis.database.map(db => db.type))
    ].slice(0, 3); // Limit to 3 database types
    
    const external = Object.keys(analysis.dependencies)
      .filter(dep => [
        'stripe', 'sendgrid', 'twilio', 'aws-sdk', 'firebase',
        'supabase', 'vercel', 'netlify'
      ].some(service => dep.includes(service)))
      .slice(0, 3); // Limit to 3 external services

    return { frontend, backend, database, external };
  }

  private generateConnections(components: { frontend: string[], backend: string[], database: string[], external: string[] }): string {
    const connections: string[] = [];
    
    // Limit components to prevent diagram overload
    const maxFrontend = Math.min(components.frontend.length, 8);
    const maxBackend = Math.min(components.backend.length, 6);
    const maxDatabase = Math.min(components.database.length, 3);
    const maxExternal = Math.min(components.external.length, 3);
    
    // Create smart connections instead of full mesh
    // Frontend to Backend: Connect main components to primary backend services
    for (let feIdx = 0; feIdx < maxFrontend; feIdx++) {
      const beIdx = feIdx % maxBackend; // Distribute connections
      connections.push(`FE${feIdx} --> BE${beIdx}`);
    }

    // Backend to Database: Connect backend services to databases intelligently
    for (let beIdx = 0; beIdx < maxBackend; beIdx++) {
      const dbIdx = beIdx % maxDatabase; // Distribute connections
      connections.push(`BE${beIdx} --> DB${dbIdx}`);
    }

    // Backend to External Services: Connect some backend services to external APIs
    for (let beIdx = 0; beIdx < Math.min(maxBackend, 3); beIdx++) {
      for (let extIdx = 0; extIdx < maxExternal; extIdx++) {
        connections.push(`BE${beIdx} --> EXT${extIdx}`);
      }
    }

    return connections.join('\n    ');
  }

  private extractDatabaseTables(analysis: CodebaseAnalysis) {
    // This is a simplified extraction - in a real implementation,
    // you'd parse schema files, Prisma schemas, etc.
    const queries = analysis.files.flatMap(f => f.databaseQueries);
    const tableNames = [...new Set(queries.map(q => q.table).filter(t => t !== 'unknown'))];
    
    return tableNames.map(tableName => ({
      name: tableName,
      columns: [
        { name: 'id', type: 'string' },
        { name: 'created_at', type: 'timestamp' },
        { name: 'updated_at', type: 'timestamp' }
      ]
    }));
  }

  private generateRelationships(tables: any[]): string {
    // Simplified relationship generation
    if (tables.length < 2) return '';
    
    return tables.slice(1).map((table, idx) => 
      `${tables[0].name} ||--o{ ${table.name} : "has many"`
    ).join('\n    ');
  }
}