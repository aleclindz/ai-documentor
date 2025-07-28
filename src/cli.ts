#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { DocumentationGenerator } from './generators/DocumentationGenerator.js';
import { CodebaseAnalyzer } from './analyzers/CodebaseAnalyzer.js';
import { DocumentationServer } from './server/DocumentationServer.js';
import { Config } from './utils/Config.js';

const program = new Command();

program
  .name('documentor')
  .description('Generate comprehensive documentation for any codebase using LLMs')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize documentor in your project')
  .action(async () => {
    console.log(chalk.blue('🔧 Initializing Documentor...'));
    await Config.initialize();
    console.log(chalk.green('✅ Documentor initialized successfully!'));
  });

program
  .command('generate')
  .description('Generate documentation for the current project')
  .option('-w, --watch', 'Watch for file changes and regenerate')
  .option('-o, --output <dir>', 'Output directory', './docs')
  .action(async (options) => {
    console.log(chalk.blue('📝 Generating documentation...'));
    
    const config = await Config.load();
    const analyzer = new CodebaseAnalyzer(process.cwd());
    const generator = new DocumentationGenerator(config);
    
    try {
      const analysis = await analyzer.analyze();
      const documentation = await generator.generate(analysis);
      
      console.log(chalk.green('✅ Documentation generated successfully!'));
      
      if (options.watch) {
        console.log(chalk.yellow('👀 Watching for changes...'));
        analyzer.watch((changes) => {
          console.log(chalk.blue('🔄 Changes detected, regenerating...'));
          generator.generate(analysis).catch(console.error);
        });
      }
    } catch (error) {
      console.error(chalk.red('❌ Error generating documentation:'), error);
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Start local documentation server')
  .option('-p, --port <port>', 'Port to serve on', '3000')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Starting documentation server...'));
    
    const server = new DocumentationServer();
    await server.start(parseInt(options.port));
    
    console.log(chalk.green(`📖 Documentation available at http://localhost:${options.port}`));
  });

program
  .command('config')
  .description('Configure documentor settings')
  .action(async () => {
    await Config.configure();
  });

program.parse();