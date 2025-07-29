#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { DocumentationGenerator } from './generators/DocumentationGenerator.js';
import { CodebaseAnalyzer } from './analyzers/CodebaseAnalyzer.js';
import { Config } from './utils/Config.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('ai-documentor')
  .description('AI-powered documentation generator with live server')
  .version('1.0.0')
  .option('-f, --force', 'Overwrite existing documentation without prompting')
  .option('-o, --output <dir>', 'Output directory for documentation', './docs');

// Default action - no subcommands needed
program
  .action(async (options) => {
    console.log(chalk.blue('🚀 Starting Documentor...'));
    
    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      console.log(chalk.red('❌ OpenAI API key not found!'));
      console.log(chalk.yellow('Please add your OpenAI API key to the .env file:'));
      console.log(chalk.gray('OPENAI_API_KEY=your_actual_api_key_here'));
      process.exit(1);
    }

    try {
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
      
      console.log(chalk.blue('🤖 Generating AI-powered documentation...'));
      const config = { 
        openaiApiKey: process.env.OPENAI_API_KEY,
        outputDir: options.output,
        force: options.force
      };
      const generator = new DocumentationGenerator(config);
      
      // Create streaming progress callback for OpenAI generation
      const aiProgressCallback = (status: string) => {
        console.log(chalk.cyan(status));
      };
      
      await generator.generate(analysis, aiProgressCallback);
      
      console.log(chalk.green('✅ Documentation generated!'));
      console.log(chalk.blue(`📁 Files saved to: ${config.outputDir}`));
      console.log(chalk.gray('💡 Run again to update documentation'));
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();