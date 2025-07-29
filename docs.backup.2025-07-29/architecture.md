
graph TB
    %% Frontend Layer
    subgraph "Frontend Layer"
        FE0["React"]
    end
    
    %% Backend Layer
    subgraph "Backend Layer"
        BE0["DocumentationServer"]
        BE1["App"]
        BE2["users"]
        BE3["Express"]
    end
    
    %% Database Layer
    subgraph "Database Layer"
        
    end
    
    %% External Services
    subgraph "External Services"
        
    end
    
    %% Connections
    FE0 --> BE0
    FE0 --> BE1
    FE0 --> BE2
    FE0 --> BE3
    
    %% Styling
    classDef frontend fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef backend fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef database fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px
    
    class FE0 frontend
    class BE0 backend
    class BE1 backend
    class BE2 backend
    class BE3 backend
    
    
