import { BaseWorkflowGenerator, WorkflowGeneratorConfig, UserFlow } from './BaseWorkflowGenerator.js';
import { CLIWorkflowGenerator } from './CLIWorkflowGenerator.js';
import { WebAppWorkflowGenerator } from './WebAppWorkflowGenerator.js';
import { APIWorkflowGenerator } from './APIWorkflowGenerator.js';
import { PageBasedWorkflowGenerator } from './PageBasedWorkflowGenerator.js';
import { CodebaseAnalysis } from '../../analyzers/CodebaseAnalyzer.js';
import { ThoughtProcessLogger } from '../ThoughtProcessLogger.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

export class WorkflowGeneratorFactory {
  private generators: BaseWorkflowGenerator[];
  private config: WorkflowGeneratorConfig;

  constructor(config: WorkflowGeneratorConfig) {
    this.config = config;
    this.generators = [
      new CLIWorkflowGenerator(config),
      new APIWorkflowGenerator(config),
      new WebAppWorkflowGenerator(config)
    ];
  }

  async generateWorkflows(analysis: CodebaseAnalysis): Promise<UserFlow[]> {
    // Create thought process logger
    const thoughtLogger = new ThoughtProcessLogger(analysis.projectName);
    
    // Test each generator and log the decision process
    const applicableGenerators: BaseWorkflowGenerator[] = [];
    
    for (const generator of this.generators) {
      const generatorName = generator.constructor.name.replace('WorkflowGenerator', '');
      const reasons: string[] = [];
      const evidence: Record<string, any> = {};
      
      // Get detailed analysis from each generator
      let canHandle = false;
      if (generator instanceof CLIWorkflowGenerator) {
        const result = this.analyzeCLICapability(generator, analysis);
        canHandle = result.canHandle;
        reasons.push(...result.reasons);
        Object.assign(evidence, result.evidence);
      } else {
        canHandle = generator.canHandle(analysis);
        reasons.push(canHandle ? `${generatorName} patterns detected` : `No ${generatorName} patterns found`);
      }
      
      thoughtLogger.addThought(generatorName, canHandle, reasons, evidence);
      
      if (canHandle) {
        applicableGenerators.push(generator);
      }
    }

    // Save thought process to file for debugging
    try {
      const thoughtsPath = join(process.cwd(), 'docs', 'workflow-classification-thoughts.md');
      writeFileSync(thoughtsPath, thoughtLogger.generateReport());
      if (this.config.debug) {
        console.log(`💭 Thought process saved to: ${thoughtsPath}`);
      }
    } catch (error) {
      if (this.config.debug) {
        console.warn('Could not save thought process file:', error);
      }
    }

    if (applicableGenerators.length === 0) {
      if (this.config.debug) {
        console.log('No specific workflow generators found, using generic fallback');
      }
      return this.generateGenericWorkflows(analysis);
    }

    // Use the most appropriate generator (prioritize CLI > WebApp > API)
    const selectedGenerator = this.selectBestGenerator(applicableGenerators, analysis);
    
    if (this.config.debug) {
      console.log(`Selected workflow generator: ${selectedGenerator.constructor.name}`);
    }

    try {
      return await selectedGenerator.generateWorkflows(analysis);
    } catch (error) {
      console.error('Error generating workflows with selected generator:', error);
      return this.generateGenericWorkflows(analysis);
    }
  }

  private selectBestGenerator(generators: BaseWorkflowGenerator[], analysis: CodebaseAnalysis): BaseWorkflowGenerator {
    // Check if this looks like a web app with CLI scripts (common in Next.js/React projects)
    const hasWebApp = generators.some(g => g instanceof WebAppWorkflowGenerator);
    const hasCLI = generators.some(g => g instanceof CLIWorkflowGenerator);
    
    // If both CLI and WebApp are detected, prefer WebApp for modern web frameworks
    if (hasWebApp && hasCLI) {
      const isModernWebApp = analysis.framework.some(fw => 
        ['React', 'Vue', 'Angular', 'Next.js', 'Nuxt.js', 'Svelte'].includes(fw)
      ) || analysis.dependencies['react'] || analysis.dependencies['next'] || analysis.dependencies['vue'];
      
      if (isModernWebApp) {
        // Prioritize WebApp for modern web frameworks that happen to have CLI scripts
        const priorityOrder = [WebAppWorkflowGenerator, CLIWorkflowGenerator, APIWorkflowGenerator];
        for (const GeneratorClass of priorityOrder) {
          const generator = generators.find(g => g instanceof GeneratorClass);
          if (generator) {
            return generator;
          }
        }
      }
    }
    
    // Default priority order: CLI tools are most specific, then web apps, then APIs
    const priorityOrder = [CLIWorkflowGenerator, WebAppWorkflowGenerator, APIWorkflowGenerator];
    
    for (const GeneratorClass of priorityOrder) {
      const generator = generators.find(g => g instanceof GeneratorClass);
      if (generator) {
        return generator;
      }
    }

    // Fallback to first available generator
    return generators[0];
  }

  private generateGenericWorkflows(analysis: CodebaseAnalysis): UserFlow[] {
    // Generic fallback workflows when no specific generator matches
    return [
      {
        name: 'Getting Started',
        slug: 'getting-started',
        description: `Introduction to using ${analysis.projectName}`,
        steps: [
          {
            action: 'Install dependencies',
            component: 'Setup',
            event: 'install',
            apiEndpoint: 'npm install',
            serviceFunction: 'Package manager',
            result: 'Dependencies installed successfully'
          },
          {
            action: 'Start the application',
            component: 'Application',
            event: 'start',
            apiEndpoint: analysis.scripts.start || analysis.scripts.dev || 'npm start',
            serviceFunction: 'Application bootstrap',
            result: `${analysis.projectName} is running and ready to use`
          }
        ]
      },
      {
        name: 'Basic Usage',
        slug: 'basic-usage',
        description: `Common workflows when using ${analysis.projectName}`,
        steps: [
          {
            action: 'Access main functionality',
            component: 'Main Interface',
            event: 'interaction',
            apiEndpoint: 'Main entry point',
            serviceFunction: 'Core functionality',
            result: 'Application responds with expected behavior'
          }
        ]
      }
    ];
  }

  private analyzeCLICapability(generator: CLIWorkflowGenerator, analysis: CodebaseAnalysis): {
    canHandle: boolean;
    reasons: string[];
    evidence: Record<string, any>;
  } {
    const reasons: string[] = [];
    const evidence: Record<string, any> = {};

    // Check CLI dependencies
    const cliDeps = ['commander', 'yargs', '@oclif/core', 'minimist'];
    const hasCLIDependencies = cliDeps.some(dep => analysis.dependencies[dep]);
    const foundCLIDeps = cliDeps.filter(dep => analysis.dependencies[dep]);
    
    evidence['CLI Dependencies'] = foundCLIDeps;
    if (hasCLIDependencies) {
      reasons.push(`Found CLI dependencies: ${foundCLIDeps.join(', ')}`);
    }

    // Check bin field (currently not implemented in analyzer)
    const hasBinField = false; // TODO: Add bin field detection to CodebaseAnalyzer
    evidence['Bin Field'] = hasBinField;

    // Check CLI scripts - be more specific to avoid false positives
    const cliScripts = analysis.scripts ? Object.entries(analysis.scripts).filter(([key, script]) => {
      // Only count as CLI if it's clearly a CLI pattern, not just any Node.js script
      return (
        key.includes('cli') || 
        key.includes('bin') ||
        (script.includes('node ') && !script.includes('react-scripts') && !script.includes('next') && !script.includes('dev') && !script.includes('start'))
      );
    }) : [];
    
    const hasCliScripts = cliScripts.length > 0;
    evidence['CLI Scripts'] = cliScripts.map(([key, script]) => `${key}: ${script}`);
    if (hasCliScripts) {
      reasons.push(`Found CLI scripts: ${cliScripts.map(([key]) => key).join(', ')}`);
    }

    // Check for CLI files - be more specific
    const cliFiles = analysis.files.filter(file => {
      const path = file.path.toLowerCase();
      return (
        path.includes('cli.') ||
        path.includes('bin/') ||
        (path.includes('command') && !path.includes('components') && !path.includes('node_modules')) ||
        (file.content && file.content.includes('#!/usr/bin/env node') && !path.includes('node_modules'))
      );
    });
    
    const hasCliFiles = cliFiles.length > 0;
    evidence['CLI Files'] = cliFiles.map(f => f.relativePath);
    if (hasCliFiles) {
      reasons.push(`Found CLI files: ${cliFiles.map(f => f.relativePath).join(', ')}`);
    }

    // Check for web app patterns that would contradict CLI classification
    const webAppIndicators = [
      analysis.framework.some(fw => ['React', 'Vue', 'Angular', 'Next.js', 'Nuxt.js'].includes(fw)),
      analysis.files.some(f => f.components.length > 0),
      analysis.files.some(f => f.path.includes('components/') || f.path.includes('pages/') || f.path.includes('app/')),
      analysis.dependencies['react'] || analysis.dependencies['next'] || analysis.dependencies['vue']
    ];

    const isWebApp = webAppIndicators.some(indicator => indicator);
    evidence['Web App Indicators'] = webAppIndicators;
    
    if (isWebApp && (hasCLIDependencies || hasCliScripts || hasCliFiles)) {
      reasons.push('⚠️  WARNING: Project has both CLI and web app patterns - web app likely takes precedence');
    }

    const canHandle = hasCLIDependencies || hasBinField || hasCliScripts || hasCliFiles;
    
    if (!canHandle) {
      reasons.push('No CLI patterns detected');
    }

    return { canHandle, reasons, evidence };
  }

  /**
   * Get information about which generator would be used for this analysis
   */
  getGeneratorInfo(analysis: CodebaseAnalysis): { name: string; reason: string } {
    const applicableGenerators = this.generators.filter(generator => 
      generator.canHandle(analysis)
    );

    if (applicableGenerators.length === 0) {
      return { 
        name: 'Generic', 
        reason: 'No specific project type detected, using generic workflows' 
      };
    }

    const selected = this.selectBestGenerator(applicableGenerators, analysis);
    const name = selected.constructor.name.replace('WorkflowGenerator', '');
    
    let reason = '';
    if (selected instanceof CLIWorkflowGenerator) {
      reason = 'CLI tool detected (commander.js, bin field, or CLI patterns)';
    } else if (selected instanceof APIWorkflowGenerator) {
      reason = 'API service detected (Express, Fastify, or API routes)';
    } else if (selected instanceof WebAppWorkflowGenerator) {
      reason = 'Web application detected (React, Vue, Angular, or frontend components)';
    }

    return { name, reason };
  }
}