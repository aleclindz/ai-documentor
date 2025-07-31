import { BaseWorkflowGenerator, UserFlow } from './BaseWorkflowGenerator.js';
import { CodebaseAnalysis } from '../../analyzers/CodebaseAnalyzer.js';

export class CLIWorkflowGenerator extends BaseWorkflowGenerator {
  canHandle(analysis: CodebaseAnalysis): boolean {
    // Use more specific CLI detection to avoid false positives with web apps
    const hasCLIDependencies = !!(analysis.dependencies.commander || 
                              analysis.dependencies.yargs || 
                              analysis.dependencies['@oclif/core'] ||
                              analysis.dependencies.minimist);
    
    const hasBinField = false; // TODO: Add bin field detection to CodebaseAnalyzer
    
    // Be more specific with script detection to avoid Next.js/React false positives
    const hasCliScripts = analysis.scripts ? (
      Object.keys(analysis.scripts).some(script => script.includes('cli') || script.includes('bin')) ||
      Object.entries(analysis.scripts).some(([key, script]) => 
        script.includes('node ') && 
        !script.includes('react-scripts') && 
        !script.includes('next') && 
        !script.includes('dev') && 
        !script.includes('start')
      )
    ) : false;
    
    // Be more specific with file detection
    const hasCliFiles = analysis.files.some(file => {
      const path = file.path.toLowerCase();
      return (
        path.includes('cli.') || 
        path.includes('bin/') ||
        (path.includes('command') && !path.includes('components') && !path.includes('node_modules')) ||
        (file.content && file.content.includes('#!/usr/bin/env node') && !path.includes('node_modules'))
      );
    });

    // Check if this is primarily a web app (should take precedence)
    const isWebApp = analysis.framework.some(fw => 
      ['React', 'Vue', 'Angular', 'Next.js', 'Nuxt.js', 'Svelte'].includes(fw)
    ) || analysis.dependencies['react'] || analysis.dependencies['next'] || analysis.dependencies['vue'];

    const cliIndicators = hasCLIDependencies || hasBinField || hasCliScripts || hasCliFiles;
    
    // If it's clearly a web app with some CLI-like scripts, don't classify as CLI
    if (isWebApp && !hasCLIDependencies) {
      this.log(`CLI Detection: Skipping - detected web app with CLI-like scripts`);
      return false;
    }

    this.log(`CLI Detection: deps=${hasCLIDependencies}, bin=${hasBinField}, scripts=${hasCliScripts}, files=${hasCliFiles}, webApp=${isWebApp}`);
    
    return cliIndicators;
  }

  async generateWorkflows(analysis: CodebaseAnalysis): Promise<UserFlow[]> {
    this.log('Generating CLI-specific workflows...');

    const prompt = this.buildCLIPrompt(analysis);
    
    try {
      const response = await this.callOpenAI(prompt);
      const parsed = JSON.parse(response);
      
      // Convert to UserFlow format expected by the system
      return parsed.workflows?.map((workflow: any) => ({
        name: workflow.name,
        slug: workflow.slug || this.generateSlug(workflow.name),
        description: workflow.description,
        steps: workflow.steps?.map((step: any) => ({
          action: step.action,
          component: 'CLI',
          event: 'command',
          apiEndpoint: step.commands?.join(', ') || step.details || '',
          serviceFunction: 'CLI execution',
          dbModel: '',
          result: step.result
        })) || []
      })) || [];
    } catch (error) {
      console.error('Error generating CLI user workflows:', error);
      return this.generateFallbackWorkflows(analysis);
    }
  }

  private buildCLIPrompt(analysis: CodebaseAnalysis): string {
    const cliCommands = this.detectCLICommands(analysis);
    const configFiles = this.detectConfigurationFiles(analysis);
    const dependencies = Object.keys(analysis.dependencies).slice(0, 15).join(', ');

    return `
# CLI User Workflow Documentation Generation

Analyze this CLI tool and create structured user workflow documentation covering installation, setup, and usage patterns.

## Project Analysis:
**Package Name**: ${analysis.projectName}
**Technology**: ${analysis.framework.join(', ')}
**Dependencies**: ${dependencies}
**Scripts**: ${analysis.scripts ? Object.keys(analysis.scripts).join(', ') : 'No scripts detected'}
**Binary**: Standard Node.js CLI

## CLI Commands Detected:
${cliCommands.length > 0 ? cliCommands.join('\n') : 'Standard CLI patterns detected'}

## Configuration Files:
${configFiles.length > 0 ? configFiles.join(', ') : 'No specific config files detected'}

Create user workflow documentation as JSON with this structure:

{
  "workflows": [
    {
      "name": "Installation & Setup",
      "slug": "installation-setup",
      "description": "Getting started with the ${analysis.projectName} CLI tool",
      "steps": [
        {
          "action": "Check Node.js version",
          "details": "Ensure Node.js is installed (version requirements if any)",
          "commands": ["node --version"],
          "result": "Verify Node.js compatibility"
        },
        {
          "action": "Install the CLI tool",
          "details": "Install globally or locally based on the project setup",
          "commands": ["npm install -g ${analysis.projectName}", "npm install ${analysis.projectName}"],
          "result": "CLI tool available for use"
        }
      ]
    },
    {
      "name": "Basic Usage",
      "slug": "basic-usage", 
      "description": "Common commands and workflows for ${analysis.projectName}",
      "steps": [
        {
          "action": "View help documentation",
          "details": "Learn about available commands and options",
          "commands": ["${analysis.projectName} --help"],
          "result": "Display comprehensive command reference"
        },
        {
          "action": "Run primary command",
          "details": "Execute the main functionality of the tool",
          "commands": ["${analysis.projectName}"],
          "result": "Execute default behavior or show interactive prompts"
        }
      ]
    }
  ]
}

Based on the detected CLI patterns and dependencies, create 2-4 practical workflow sections that focus on:
1. Installation and prerequisites
2. Basic usage and common commands
3. Configuration (if config files detected)
4. Advanced usage (if complex commands detected)

Make the workflows specific to this tool's functionality. Avoid generic placeholders.
Return only the JSON structure.
`;
  }

  private detectCLICommands(analysis: CodebaseAnalysis): string[] {
    const commands: string[] = [];
    
    // Look for commander.js patterns
    analysis.files.forEach(file => {
      if (file.content.includes('.command(') || file.content.includes('program.')) {
        const commandMatches = file.content.match(/\.command\(['"`]([^'"`]+)['"`]\)/g);
        if (commandMatches) {
          commandMatches.forEach(match => {
            const cmd = match.match(/\.command\(['"`]([^'"`]+)['"`]\)/);
            if (cmd) commands.push(`- ${cmd[1]}: Found in ${file.path}`);
          });
        }
      }
      
      // Look for yargs patterns
      if (file.content.includes('yargs') || file.content.includes('.argv')) {
        commands.push(`- Yargs CLI detected in ${file.path}`);
      }
    });

    return commands;
  }

  private detectConfigurationFiles(analysis: CodebaseAnalysis): string[] {
    const configFiles: string[] = [];
    
    analysis.files.forEach(file => {
      const fileName = file.path.toLowerCase();
      if (fileName.includes('.env') || 
          fileName.includes('config') || 
          fileName.includes('.rc') ||
          fileName.includes('.yaml') ||
          fileName.includes('.yml') ||
          fileName.includes('.json') && fileName.includes('config')) {
        configFiles.push(file.path);
      }
    });

    return configFiles;
  }

  private generateFallbackWorkflows(analysis: CodebaseAnalysis): UserFlow[] {
    return [
      {
        name: 'Installation & Setup',
        slug: 'installation-setup',
        description: `Getting started with the ${analysis.projectName} CLI tool`,
        steps: [
          {
            action: 'Install Node.js',
            component: 'CLI',
            event: 'command',
            apiEndpoint: 'node --version',
            serviceFunction: 'CLI execution',
            result: 'Node.js runtime available'
          },
          {
            action: 'Install the CLI tool',
            component: 'CLI', 
            event: 'command',
            apiEndpoint: `npm install ${analysis.projectName}`,
            serviceFunction: 'CLI execution',
            result: 'CLI tool installed and ready'
          }
        ]
      },
      {
        name: 'Basic Usage',
        slug: 'basic-usage',
        description: `Common commands and workflows for ${analysis.projectName}`,
        steps: [
          {
            action: 'Run help command',
            component: 'CLI',
            event: 'command', 
            apiEndpoint: `${analysis.projectName} --help`,
            serviceFunction: 'CLI execution',
            result: 'Display available commands and options'
          }
        ]
      }
    ];
  }
}