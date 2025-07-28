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

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('documentor')
  .description('AI-powered documentation generator with live server')
  .version('1.0.0');

// Default action - no subcommands needed
program
  .action(async () => {
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
        process.stdout.write(`\r${status} [${progressBar}] ${progress.toFixed(0)}%`);
        if (progress === 100) process.stdout.write('\n');
      };
      
      const analysis = await analyzer.analyze(progressCallback);
      
      console.log(chalk.blue('🤖 Generating AI-powered documentation...'));
      const config = { 
        openaiApiKey: process.env.OPENAI_API_KEY,
        outputDir: './docs',
        port: parseInt(process.env.PORT || '3000')
      };
      const generator = new DocumentationGenerator(config);
      await generator.generate(analysis);
      
      console.log(chalk.green('✅ Documentation generated!'));
      console.log(chalk.blue('🌐 Starting local server...'));
      
      const server = new DocumentationServer();
      server.setConfig(config);
      await server.start(config.port);
      
      console.log(chalk.green(`🎉 Documentation is live at http://localhost:${config.port}`));
      console.log(chalk.yellow('👀 Watching for file changes...'));
      console.log(chalk.gray('💡 Press Ctrl+C to stop the server'));
      
      // Watch for changes and auto-regenerate
      analyzer.watch(async (changes) => {
        console.log(chalk.blue('🔄 Changes detected, regenerating...'));
        
        const updateProgressCallback = (status: string, progress: number) => {
          const progressBar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
          process.stdout.write(`\r  ${status} [${progressBar}] ${progress.toFixed(0)}%`);
          if (progress === 100) process.stdout.write('\n');
        };
        
        const newAnalysis = await analyzer.analyze(updateProgressCallback);
        await generator.generate(newAnalysis);
        server.refresh();
        console.log(chalk.green('🔄 Documentation updated!'));
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();