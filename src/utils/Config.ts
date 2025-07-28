import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';

export interface DocumentorConfig {
  openaiApiKey: string;
  outputDirectory: string;
  watchMode: boolean;
  includePatterns: string[];
  excludePatterns: string[];
  frameworks: string[];
  deploymentPlatforms: string[];
  databaseType?: string;
  customPrompts?: {
    overview?: string;
    frontend?: string;
    backend?: string;
    database?: string;
  };
}

export class Config {
  private static CONFIG_FILE = '.documentor.json';
  private static DEFAULT_CONFIG: Partial<DocumentorConfig> = {
    outputDirectory: './docs',
    watchMode: false,
    includePatterns: ['**/*.{ts,tsx,js,jsx,py,go,rs,java}', '**/*.{json,md,yml,yaml}'],
    excludePatterns: ['node_modules/**', 'dist/**', 'build/**', '.git/**', '**/*.test.*', '**/*.spec.*']
  };

  static async initialize(): Promise<void> {
    const configPath = join(process.cwd(), this.CONFIG_FILE);
    
    if (existsSync(configPath)) {
      console.log(chalk.yellow('⚠️  Configuration already exists. Use "documentor config" to modify.'));
      return;
    }

    console.log(chalk.blue('🔧 Setting up Documentor configuration...\n'));

    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'openaiApiKey',
        message: 'Enter your OpenAI API key:',
        validate: (input: string) => input.length > 0 || 'API key is required'
      },
      {
        type: 'input',
        name: 'outputDirectory',
        message: 'Documentation output directory:',
        default: './docs'
      },
      {
        type: 'checkbox',
        name: 'frameworks',
        message: 'Select frameworks used in your project:',
        choices: [
          'React',
          'Vue',
          'Angular',
          'Svelte',
          'Next.js',
          'Nuxt.js',
          'Express',
          'Fastify',
          'NestJS',
          'Django',
          'Flask',
          'Go Gin',
          'Rust Actix'
        ]
      },
      {
        type: 'checkbox',
        name: 'deploymentPlatforms',
        message: 'Select deployment platforms:',
        choices: [
          'Vercel',
          'Netlify',
          'AWS',
          'Google Cloud',
          'Azure',
          'Railway',
          'Render',
          'Supabase',
          'Firebase'
        ]
      },
      {
        type: 'list',
        name: 'databaseType',
        message: 'Primary database type:',
        choices: [
          'PostgreSQL',
          'MySQL',
          'MongoDB',
          'SQLite',
          'Supabase',
          'Firebase Firestore',
          'Redis',
          'None'
        ]
      }
    ]);

    const config: DocumentorConfig = {
      ...this.DEFAULT_CONFIG,
      ...answers
    } as DocumentorConfig;

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(chalk.green(`✅ Configuration saved to ${this.CONFIG_FILE}`));
  }

  static async load(): Promise<DocumentorConfig> {
    const configPath = join(process.cwd(), this.CONFIG_FILE);
    
    if (!existsSync(configPath)) {
      throw new Error(`Configuration not found. Run "documentor init" first.`);
    }

    try {
      const configContent = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      return {
        ...this.DEFAULT_CONFIG,
        ...config
      } as DocumentorConfig;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error}`);
    }
  }

  static async configure(): Promise<void> {
    console.log(chalk.blue('🔧 Updating Documentor configuration...\n'));

    try {
      const currentConfig = await this.load();
      
      const answers = await inquirer.prompt([
        {
          type: 'password',
          name: 'openaiApiKey',
          message: 'OpenAI API key:',
          default: currentConfig.openaiApiKey ? '***hidden***' : undefined,
          filter: (input: string) => input === '***hidden***' ? currentConfig.openaiApiKey : input
        },
        {
          type: 'input',
          name: 'outputDirectory',
          message: 'Documentation output directory:',
          default: currentConfig.outputDirectory
        },
        {
          type: 'confirm',
          name: 'watchMode',
          message: 'Enable watch mode by default?',
          default: currentConfig.watchMode
        },
        {
          type: 'checkbox',
          name: 'frameworks',
          message: 'Update frameworks:',
          choices: [
            'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt.js',
            'Express', 'Fastify', 'NestJS', 'Django', 'Flask'
          ],
          default: currentConfig.frameworks
        }
      ]);

      const updatedConfig = {
        ...currentConfig,
        ...answers
      };

      const configPath = join(process.cwd(), this.CONFIG_FILE);
      writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
      
      console.log(chalk.green('✅ Configuration updated successfully!'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to update configuration:'), error);
    }
  }

  static async getApiKey(): Promise<string> {
    const config = await this.load();
    
    if (!config.openaiApiKey) {
      console.log(chalk.yellow('⚠️  OpenAI API key not found in configuration.'));
      const { apiKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'Enter your OpenAI API key:'
        }
      ]);
      
      // Update config with API key
      const configPath = join(process.cwd(), this.CONFIG_FILE);
      const updatedConfig = { ...config, openaiApiKey: apiKey };
      writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
      
      return apiKey;
    }
    
    return config.openaiApiKey;
  }
}