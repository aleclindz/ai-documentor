#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { DocumentationGenerator } from './generators/DocumentationGenerator.js';
import { CodebaseAnalyzer } from './analyzers/CodebaseAnalyzer.js';
import { DocumentationServer } from './server/DocumentationServer.js';
import { Config } from './utils/Config.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { join } from 'path';
import { exec } from 'child_process';

const program = new Command();

program
  .name('ai-documentor')
  .description('AI-powered documentation generator')
  .version('1.0.0');

// Generate command (default) - generate documentation only
program
  .command('generate', { isDefault: true })
  .description('Generate documentation from codebase (default command)')
  .option('-f, --force', 'Overwrite existing documentation without prompting')
  .option('-o, --output <dir>', 'Output directory for documentation', './docs')
  .option('-d, --debug', 'Enable debug logging to show detailed progress')
  .action(async (options) => {
    // Load environment variables for commands that need API key
    dotenv.config();
    
    console.log(chalk.blue('🚀 Starting Documentation Generation...'));
    
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      console.log(chalk.red('❌ OpenAI API key not found!'));
      console.log(chalk.yellow('Please add your OpenAI API key to the .env file:'));
      console.log(chalk.gray('OPENAI_API_KEY=your_actual_api_key_here'));
      process.exit(1);
    }

    try {
      const config = { 
        openaiApiKey: process.env.OPENAI_API_KEY,
        outputDir: options.output,
        force: options.force,
        debug: options.debug
      };

      if (options.debug) {
        console.log(chalk.gray('🔍 Debug mode enabled'));
        console.log(chalk.gray(`📁 Output directory: ${config.outputDir}`));
        console.log(chalk.gray(`🔧 Force mode: ${config.force}`));
      }

      // Check if documentation already exists (unless force regeneration)
      const docsPath = join(config.outputDir, 'documentation.json');
      const docsExist = fs.existsSync(docsPath);
      
      if (docsExist && !options.force) {
        console.log(chalk.yellow('📖 Documentation already exists!'));
        console.log(chalk.blue(`📁 Location: ${config.outputDir}`));
        console.log(chalk.gray('💡 Use --force to regenerate, or run "ai-documentor view" to start the server'));
        return;
      }

      if (options.debug) {
        console.log(chalk.gray('⚡ Initializing codebase analyzer...'));
      }
      
      const analyzer = new CodebaseAnalyzer(process.cwd());
      
      // Create progress callback for real-time updates
      const progressCallback = (status: string, progress: number) => {
        const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
        // Clear the line and write new progress
        process.stdout.write('\r\x1b[K'); // Clear current line
        process.stdout.write(`${status} [${progressBar}] ${progress.toFixed(0)}%`);
        if (progress === 100) {
          process.stdout.write('\n');
        }
        
        if (options.debug) {
          console.log(chalk.gray(`  📊 ${status} - ${progress.toFixed(1)}%`));
        }
      };
      
      if (options.debug) {
        console.log(chalk.gray('🔍 Starting codebase analysis...'));
      }
      const startTime = Date.now();
      
      const analysis = await analyzer.analyze(progressCallback);
      
      if (options.debug) {
        const analysisTime = Date.now() - startTime;
        console.log(chalk.gray(`✅ Analysis completed in ${analysisTime}ms`));
        console.log(chalk.gray(`📁 Files analyzed: ${analysis.files.length}`));
        console.log(chalk.gray(`🏗️ Frameworks detected: ${analysis.framework.join(', ')}`));
      }
      
      console.log(chalk.blue('🤖 Generating AI-powered documentation...'));
      if (options.debug) {
        console.log(chalk.gray('🎯 Initializing DocumentationGenerator...'));
      }
      const generator = new DocumentationGenerator(config);
      
      // Create streaming progress callback for OpenAI generation
      const aiProgressCallback = (status: string) => {
        console.log(chalk.cyan(status));
        if (options.debug) {
          console.log(chalk.gray(`  🤖 ${status} - ${new Date().toLocaleTimeString()}`));
        }
      };
      
      if (options.debug) {
        console.log(chalk.gray('🚀 Starting AI documentation generation...'));
      }
      const genStartTime = Date.now();
      
      await generator.generate(analysis, aiProgressCallback);
      
      if (options.debug) {
        const genTime = Date.now() - genStartTime;
        console.log(chalk.gray(`✅ AI generation completed in ${genTime}ms`));
      }
      
      console.log(chalk.green('✅ Documentation generated!'));
      console.log(chalk.blue(`📁 Files saved to: ${config.outputDir}`));
      console.log(chalk.gray('💡 Run "ai-documentor view" to start the documentation server'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// View command - start server only
program
  .command('view')
  .description('Start the documentation server to view existing documentation')
  .option('-o, --output <dir>', 'Documentation directory', './docs')
  .option('-p, --port <port>', 'Port to run the server on', '3000')
  .action(async (options) => {
    console.log(chalk.blue('🌐 Starting documentation server...'));
    
    try {
      const config = { 
        outputDir: options.output,
        port: parseInt(options.port)
      };

      // Check if documentation exists
      const docsPath = join(config.outputDir, 'documentation.json');
      if (!fs.existsSync(docsPath)) {
        console.log(chalk.red('❌ No documentation found!'));
        console.log(chalk.yellow(`📁 Looking in: ${config.outputDir}`));
        console.log(chalk.gray('💡 Run "ai-documentor" first to generate documentation'));
        process.exit(1);
      }

      console.log(chalk.green('📖 Found existing documentation'));
      console.log(chalk.blue(`📁 Documentation location: ${config.outputDir}`));
      
      // Start the documentation server
      const server = new DocumentationServer();
      server.setConfig(config);
      await server.start(config.port);
      
      const url = `http://localhost:${config.port}`;
      console.log(chalk.green(`🎉 Documentation is live at ${url}`));
      
      // Auto-open browser
      console.log(chalk.blue('🚀 Opening browser...'));
      openBrowser(url);
      
      console.log(chalk.gray('💡 Press Ctrl+C to stop the server'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Update command - regenerate documentation only
program
  .command('update')
  .description('Update/regenerate the documentation by analyzing the latest codebase')
  .option('-o, --output <dir>', 'Output directory for documentation', './docs')
  .option('-d, --debug', 'Enable debug logging to show detailed progress')
  .action(async (options) => {
    // Load environment variables for commands that need API key
    dotenv.config();
    
    console.log(chalk.blue('🔄 Updating Documentation...'));
    
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      console.log(chalk.red('❌ OpenAI API key not found!'));
      console.log(chalk.yellow('Please add your OpenAI API key to the .env file:'));
      console.log(chalk.gray('OPENAI_API_KEY=your_actual_api_key_here'));
      process.exit(1);
    }

    try {
      const config = { 
        openaiApiKey: process.env.OPENAI_API_KEY,
        outputDir: options.output,
        force: true // Always force regeneration for update command
      };

      const analyzer = new CodebaseAnalyzer(process.cwd());
      
      // Create progress callback for real-time updates
      const progressCallback = (status: string, progress: number) => {
        const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
        // Clear the line and write new progress
        process.stdout.write('\r\x1b[K'); // Clear current line
        process.stdout.write(`${status} [${progressBar}] ${progress.toFixed(0)}%`);
        if (progress === 100) {
          process.stdout.write('\n');
        }
      };
      
      const analysis = await analyzer.analyze(progressCallback);
      
      console.log(chalk.blue('🤖 Regenerating AI-powered documentation...'));
      const generator = new DocumentationGenerator(config);
      
      // Create streaming progress callback for OpenAI generation
      const aiProgressCallback = (status: string) => {
        console.log(chalk.cyan(status));
      };
      
      await generator.generate(analysis, aiProgressCallback);
      
      console.log(chalk.green('✅ Documentation updated!'));
      console.log(chalk.blue(`📁 Files saved to: ${config.outputDir}`));
      console.log(chalk.gray('💡 Run "ai-documentor view" to start the documentation server'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Cross-platform browser opening function
function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;

  switch (platform) {
    case 'darwin': // macOS
      command = `open "${url}"`;
      break;
    case 'win32': // Windows
      command = `start "" "${url}"`;
      break;
    default: // Linux and others
      command = `xdg-open "${url}"`;
      break;
  }

  exec(command, (error) => {
    if (error) {
      console.log(chalk.yellow(`⚠️  Could not auto-open browser. Please visit: ${url}`));
    }
  });
}

program.parse();