export interface ClassificationThought {
  generator: string;
  canHandle: boolean;
  reasons: string[];
  evidence: Record<string, any>;
}

export class ThoughtProcessLogger {
  private thoughts: ClassificationThought[] = [];
  private projectName: string;

  constructor(projectName: string) {
    this.projectName = projectName;
  }

  addThought(generator: string, canHandle: boolean, reasons: string[], evidence: Record<string, any> = {}) {
    this.thoughts.push({
      generator,
      canHandle,
      reasons,
      evidence
    });
  }

  generateReport(): string {
    const selectedGenerator = this.thoughts.find(t => t.canHandle)?.generator || 'None';
    
    return `# Workflow Generator Classification Thoughts

**Project**: ${this.projectName}
**Selected Generator**: ${selectedGenerator}

## Decision Process:

${this.thoughts.map(thought => `
### ${thought.generator}
**Can Handle**: ${thought.canHandle ? '✅ YES' : '❌ NO'}

**Reasoning**:
${thought.reasons.map(reason => `- ${reason}`).join('\n')}

**Evidence**:
${Object.entries(thought.evidence).map(([key, value]) => 
  `- **${key}**: ${Array.isArray(value) ? value.join(', ') || 'None' : value}`
).join('\n')}
`).join('\n---\n')}

## Final Decision:
${selectedGenerator !== 'None' 
  ? `Selected **${selectedGenerator}** because it was the first generator that could handle this project type based on the priority order: CLI → WebApp → API.`
  : 'No specific generator could handle this project, falling back to generic workflows.'
}

## Recommendations:
${this.getRecommendations()}
`;
  }

  private getRecommendations(): string {
    const webAppThought = this.thoughts.find(t => t.generator === 'WebAppWorkflowGenerator');
    const cliThought = this.thoughts.find(t => t.generator === 'CLIWorkflowGenerator');
    
    if (cliThought?.canHandle && webAppThought?.canHandle) {
      return '- This project was detected as both CLI and WebApp. Consider refining CLI detection to be more specific.';
    }
    
    if (cliThought?.canHandle && !webAppThought?.canHandle) {
      return '- Detected as CLI tool. If this is incorrect, check for frontend components, pages, or web frameworks.';
    }
    
    if (!cliThought?.canHandle && webAppThought?.canHandle) {
      return '- Correctly detected as web application based on frontend patterns.';
    }
    
    return '- No specific patterns detected. Consider adding more detection criteria for your project type.';
  }

  getThoughts(): ClassificationThought[] {
    return this.thoughts;
  }
}