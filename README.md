# 🤖 AI Documentor

**AI-powered documentation generator for any codebase**

Generate comprehensive, beautiful documentation for your projects using advanced AI analysis. Simply run one command and get instant, professional documentation with live preview and auto-updates.

[![npm version](https://badge.fury.io/js/ai-documentor.svg)](https://badge.fury.io/js/ai-documentor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## NPM Package

https://www.npmjs.com/package/ai-documentor

## ✨ Features

- 🚀 **One Command Setup** - Just run `ai-documentor` (no flags needed)
- 🤖 **AI-Powered Analysis** - Uses OpenAI to understand and document your code
- 🌐 **Live Server** - Instant preview at `localhost:3000` with hot reload
- 👀 **File Watching** - Auto-regenerates docs when code changes
- 📊 **Rich Documentation** - Comprehensive coverage including:
  - Project overview and architecture
  - Frontend components and pages
  - Backend APIs and services  
  - Database schema and queries
  - User flows with diagrams
  - Deployment guides
  - Troubleshooting sections
- 🎨 **Beautiful UI** - Modern, responsive web interface
- 🔄 **GitHub Integration** - Auto-update docs on push
- 📈 **Real-time Progress** - See what's being analyzed in real-time

## 🚀 Quick Start

### Installation

```bash
npm install -g ai-documentor
```

### Setup

1. **Get an OpenAI API key** from [OpenAI Platform](https://platform.openai.com/api-keys)

2. **Add your API key** to `.env` in your project root:
   ```bash
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Generate documentation**:
   ```bash
   ai-documentor
   ```

That's it! Your documentation will be generated and served at `http://localhost:3000` 🎉

## 📋 Requirements

- Node.js 16+ 
- OpenAI API key
- Internet connection for AI analysis

## 💡 How It Works

1. **Codebase Analysis** - Scans your entire project structure
2. **AI Processing** - Uses OpenAI GPT-4 to understand code patterns and purpose
3. **Documentation Generation** - Creates comprehensive docs in multiple sections
4. **Live Serving** - Hosts documentation on local server with live reload
5. **Auto-Updates** - Watches for file changes and regenerates automatically

## 📖 Generated Documentation Includes

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
