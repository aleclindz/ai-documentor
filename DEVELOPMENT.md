# Development Workflow

## Using Latest Development Version in Other Projects

When you make changes to ai-documentor and want to test them in another project, follow these steps:

### 1. Build and Link in ai-documentor Directory

```bash
# In /Users/aleclindsay/documentor/
npm run build
npm link
```

### 2. Use Linked Version in Your Project

```bash
# In your project directory (e.g., /Users/aleclindsay/seometrics-nextjs/)
npm link ai-documentor

# Verify you're using the linked version
npm ls ai-documentor
# Should show: ai-documentor@1.0.0 -> /Users/aleclindsay/documentor
```

### 3. Test Your Changes

```bash
# Run with debug mode to see detailed output
ai-documentor --debug
```

### 4. Update After Each Change

Every time you make changes to the ai-documentor source:

```bash
# In /Users/aleclindsay/documentor/
npm run build
# No need to re-link, the linked version will automatically use the new build
```

## Switching Back to Published Version

To stop using the development version:

```bash
# In your project directory
npm unlink ai-documentor
npm install ai-documentor  # Installs from npm registry
```

## Quick Development Script

Add this to your shell profile for faster iteration:

```bash
# Add to ~/.zshrc or ~/.bashrc
alias aid-dev="cd /Users/aleclindsay/documentor && npm run build && echo '✅ ai-documentor development build ready'"
```

Then just run `aid-dev` after making changes.

## Debugging Classification Issues

The tool now generates a thought process file to help debug classifier decisions:

1. Run `ai-documentor --debug` in your project
2. Check `/docs/workflow-classification-thoughts.md` for detailed reasoning
3. Look for warnings about conflicting patterns (CLI vs WebApp)

## Current Focus: Web App UI-to-Backend Tracing

The tool is being refocused to specialize in web applications, specifically tracing:
- Button clicks → API calls → Database operations
- Component rendering → Backend routes → Data models
- User flows through web application interfaces

CLI and generic documentation features are being de-prioritized in favor of this specialized use case.