# 📖 Documentor

**Automated documentation generator for any codebase using LLMs**

Documentor is an open-source tool that analyzes your codebase and generates comprehensive, Confluence-style documentation automatically. It creates detailed explanations of how your application works, perfect for developers who need to understand a new project quickly.

## ✨ Features

- 🔍 **Intelligent Code Analysis** - Parses multiple languages and frameworks
- 🤖 **LLM-Powered Documentation** - Uses OpenAI GPT-4 for human-readable explanations  
- 🏗️ **Architecture Diagrams** - Generates Mermaid diagrams automatically
- 🔄 **User Flow Mapping** - Shows how user actions flow through your system
- 🌐 **Local Web Interface** - Beautiful documentation viewer
- ⚡ **Auto-Update** - Watches for code changes and regenerates docs
- 🎯 **Framework Agnostic** - Works with React, Vue, Express, Next.js, and more
- 🔧 **Easy Setup** - One command installation and configuration

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g documentor

# Or install in your project
npm install --save-dev documentor
```

### Initialize in your project

```bash
cd your-project
documentor init
```

This will prompt you to:
- Enter your OpenAI API key
- Configure output directory
- Select frameworks used
- Choose deployment platforms
- Set database type

### Generate documentation

```bash
# Generate documentation once
documentor generate

# Generate and watch for changes
documentor generate --watch

# Serve documentation locally
documentor serve
```

Open http://localhost:3000 to view your documentation!

## 📚 What Gets Documented

### 🏠 Project Overview
- Project purpose and technology stack
- Architecture overview and key features
- Getting started instructions
- Project structure explanation

### 🎨 Frontend Documentation
- React/Vue/Angular component analysis
- Props, state, and user interactions
- Page routing and navigation
- Styling and UI patterns

### ⚙️ Backend Documentation  
- API endpoints with parameters and responses
- Database queries and data models
- Authentication and middleware
- Service architecture

### 🗄️ Database Documentation
- Schema overview and relationships
- Table structures and columns
- Query patterns and performance notes
- Data model explanations

### 🔄 User Flows
- Step-by-step user journeys
- Frontend-to-backend interaction mapping
- Database operations for each action
- Error handling flows

### 🏗️ Architecture Diagrams
- System architecture visualization
- Component relationships
- Data flow diagrams
- Database schema diagrams

### 🚀 Deployment Guide
- Platform-specific deployment instructions
- Environment setup and configuration
- Build and deployment scripts
- Monitoring and troubleshooting

## 🛠️ Configuration

Create a `.documentor.json` file in your project root:

```json
{
  "openaiApiKey": "your-api-key-here",
  "outputDirectory": "./docs",
  "watchMode": false,
  "includePatterns": [
    "**/*.{ts,tsx,js,jsx,py,go,rs,java}",
    "**/*.{json,md,yml,yaml}"
  ],
  "excludePatterns": [
    "node_modules/**",
    "dist/**",
    "build/**",
    ".git/**",
    "**/*.test.*"
  ],
  "frameworks": ["React", "Express", "Next.js"],
  "deploymentPlatforms": ["Vercel"],
  "databaseType": "PostgreSQL"
}
```

## 🎯 Supported Technologies

### Frontend Frameworks
- ⚛️ React (including Next.js)
- 💚 Vue.js (including Nuxt.js) 
- 🅰️ Angular
- 🧡 Svelte

### Backend Frameworks  
- 🟢 Node.js (Express, Fastify, NestJS)
- 🐍 Python (Django, Flask)
- 🐹 Go (Gin, Echo)
- 🦀 Rust (Actix Web)
- ☕ Java (Spring Boot)

### Databases
- 🐘 PostgreSQL
- 🐬 MySQL  
- 🍃 MongoDB
- 🔥 Firebase Firestore
- ⚡ Supabase
- 📱 SQLite

### Deployment Platforms
- ▲ Vercel
- 🌐 Netlify  
- ☁️ AWS
- 🌩️ Google Cloud
- 🔷 Azure
- 🚂 Railway
- 🎨 Render

## 📖 CLI Commands

```bash
# Initialize documentor in your project
documentor init

# Generate documentation
documentor generate [options]
  -w, --watch     Watch for file changes
  -o, --output    Output directory (default: ./docs)

# Start documentation server  
documentor serve [options]
  -p, --port      Port to serve on (default: 3000)

# Configure settings
documentor config

# Show help
documentor --help
```

## 🔧 Advanced Usage

### Custom Prompts

You can customize the LLM prompts in your configuration:

```json
{
  "customPrompts": {
    "overview": "Create a technical overview focusing on...",
    "frontend": "Analyze React components with emphasis on...",
    "backend": "Document APIs with special attention to...",
    "database": "Explain the database schema highlighting..."
  }
}
```

### Programmatic Usage

```typescript
import { CodebaseAnalyzer, DocumentationGenerator, Config } from 'documentor';

const config = await Config.load();
const analyzer = new CodebaseAnalyzer(process.cwd());
const generator = new DocumentationGenerator(config);

const analysis = await analyzer.analyze();
const documentation = await generator.generate(analysis);

console.log(documentation.overview);
```

### Integration with CI/CD

```yml
# .github/workflows/docs.yml
name: Generate Docs
on: [push]
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install -g documentor
      - run: documentor generate
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      - run: # Deploy docs to your platform
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Setup

```bash
git clone https://github.com/aleclindz/documentor.git
cd documentor
npm install
npm run build
npm link

# Test with a sample project
cd ../your-test-project
documentor init
```

## 📋 Roadmap

- [ ] **VS Code Extension** - Generate docs directly in your editor
- [ ] **Team Collaboration** - Share docs with team members
- [ ] **API Documentation** - OpenAPI/Swagger integration
- [ ] **More Languages** - C#, Ruby, PHP support
- [ ] **Custom Templates** - Customizable output formats
- [ ] **Git Integration** - Automatic docs on commits
- [ ] **Performance Metrics** - Code quality insights
- [ ] **Cloud Hosting** - Optional hosted documentation

## ❓ FAQ

**Q: How much does this cost?**
A: Documentor is free and open-source. You only pay for OpenAI API usage (typically $1-5 per project).

**Q: Is my code sent to OpenAI?**
A: Only code snippets and structure are sent to OpenAI for analysis. Your full codebase stays local.

**Q: Can I use this without internet?**
A: You need internet for the initial documentation generation, but the local server works offline.

**Q: How accurate is the generated documentation?**
A: Very accurate for code structure and flow. The LLM provides intelligent explanations based on actual code analysis.

**Q: Can I customize the output?**
A: Yes! You can customize prompts, templates, and output formats.

## 🐛 Troubleshooting

### Common Issues

**"OpenAI API key not found"**
```bash
documentor config
# Re-enter your API key
```

**"Failed to analyze codebase"**
```bash
# Check file permissions and patterns
documentor generate --verbose
```

**"Documentation server won't start"**
```bash
# Check if port is in use
documentor serve --port 3001
```

### Getting Help

- 📚 [Documentation](https://github.com/aleclindz/documentor/wiki)
- 🐛 [Report Issues](https://github.com/aleclindz/documentor/issues)
- 💬 [Discussions](https://github.com/aleclindz/documentor/discussions)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for providing the GPT-4 API
- The open-source community for inspiration and feedback
- All contributors who help make this project better

---

**Made with ❤️ by [Alec Lindsay](https://github.com/aleclindz)**

*⭐ Star this repo if you find it helpful!*