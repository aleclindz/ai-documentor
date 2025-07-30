import { BaseWorkflowGenerator, WorkflowGeneratorConfig, UserFlow } from './BaseWorkflowGenerator.js';
import { CLIWorkflowGenerator } from './CLIWorkflowGenerator.js';
import { WebAppWorkflowGenerator } from './WebAppWorkflowGenerator.js';
import { APIWorkflowGenerator } from './APIWorkflowGenerator.js';
import { CodebaseAnalysis } from '../../analyzers/CodebaseAnalyzer.js';

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
    // Find all generators that can handle this codebase
    const applicableGenerators = this.generators.filter(generator => 
      generator.canHandle(analysis)
    );

    if (applicableGenerators.length === 0) {
      if (this.config.debug) {
        console.log('No specific workflow generators found, using generic fallback');
      }
      return this.generateGenericWorkflows(analysis);
    }

    // Use the most appropriate generator (prioritize CLI > API > WebApp)
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
    // Priority order: CLI tools are most specific, then APIs, then web apps
    const priorityOrder = [CLIWorkflowGenerator, APIWorkflowGenerator, WebAppWorkflowGenerator];
    
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