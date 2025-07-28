// Documentation Viewer JavaScript

class DocumentationViewer {
    constructor() {
        this.currentSection = 'overview';
        this.cache = new Map();
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'r':
                        e.preventDefault();
                        this.regenerateDocumentation();
                        break;
                    case 'p':
                        e.preventDefault();
                        window.print();
                        break;
                }
            }
        });

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.section) {
                this.loadSection(e.state.section, false);
            }
        });
    }

    async loadSection(section, updateHistory = true) {
        // Update navigation
        this.updateNavigation(section);
        
        // Show loading state
        this.showLoading();
        
        try {
            let content;
            
            // Check cache first
            if (this.cache.has(section)) {
                content = this.cache.get(section);
            } else {
                // Fetch from API
                const response = await fetch(`/api/${section}`);
                const data = await response.json();
                
                if (section === 'architecture') {
                    content = this.renderArchitecture(data.diagram);
                } else if (section === 'userflows') {
                    content = this.renderUserFlows(data.content);
                } else {
                    content = this.renderMarkdown(data.content);
                }
                
                // Cache the content
                this.cache.set(section, content);
            }
            
            this.renderContent(content);
            this.currentSection = section;
            
            // Update browser history
            if (updateHistory) {
                history.pushState({ section }, '', `#${section}`);
            }
            
        } catch (error) {
            this.renderError(error.message);
        } finally {
            this.hideLoading();
        }
    }

    updateNavigation(activeSection) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`[onclick="loadSection('${activeSection}')"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('content').style.opacity = '0.5';
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('content').style.opacity = '1';
    }

    renderContent(html) {
        const contentEl = document.getElementById('content');
        contentEl.innerHTML = html;
        contentEl.classList.add('fade-in');
        
        // Re-initialize syntax highlighting
        if (window.Prism) {
            Prism.highlightAll();
        }
        
        // Re-initialize Mermaid diagrams
        if (window.mermaid) {
            mermaid.init();
        }
        
        // Scroll to top
        contentEl.scrollTop = 0;
    }

    renderMarkdown(markdown) {
        if (!markdown) {
            return '<div class="text-center py-12"><p class="text-gray-500">No content available for this section.</p></div>';
        }
        
        // Use marked.js to convert markdown to HTML
        const html = marked.parse(markdown);
        return `<div class="prose prose-lg max-w-none">${html}</div>`;
    }

    renderArchitecture(diagram) {
        if (!diagram) {
            return '<div class="text-center py-12"><p class="text-gray-500">No architecture diagram available.</p></div>';
        }
        
        return `
            <div class="prose prose-lg max-w-none">
                <h1>🏗️ System Architecture</h1>
                <p>This diagram shows the high-level architecture of the system, including the relationships between different components.</p>
                <div class="mermaid">
                    ${diagram}
                </div>
                <div class="mt-8 bg-blue-50 border-l-4 border-blue-400 p-6">
                    <h3 class="text-lg font-semibold text-blue-900 mb-2">Understanding the Diagram</h3>
                    <ul class="text-blue-800 space-y-1">
                        <li><strong>Frontend Layer:</strong> User interface components and client-side logic</li>
                        <li><strong>Backend Layer:</strong> Server-side APIs and business logic</li>
                        <li><strong>Database Layer:</strong> Data storage and persistence</li>
                        <li><strong>External Services:</strong> Third-party integrations and APIs</li>
                    </ul>
                </div>
            </div>
        `;
    }

    renderUserFlows(flows) {
        if (!flows || !Array.isArray(flows) || flows.length === 0) {
            return '<div class="text-center py-12"><p class="text-gray-500">No user flows available.</p></div>';
        }
        
        let html = `
            <div class="prose prose-lg max-w-none">
                <h1>🔄 User Flows</h1>
                <p>These flows describe how users interact with the application and what happens behind the scenes.</p>
        `;
        
        flows.forEach((flow, index) => {
            html += `
                <div class="component-card">
                    <h2>${flow.name}</h2>
                    <p class="component-meta">${flow.description}</p>
                    
                    ${flow.diagram ? `<div class="mermaid">${flow.diagram}</div>` : ''}
                    
                    <h3>Steps:</h3>
                    <ol class="space-y-2">
                        ${flow.steps ? flow.steps.map(step => `
                            <li>
                                <strong>${step.action}</strong>
                                <div class="text-sm text-gray-600 mt-1">
                                    Component: <code class="file-path">${step.component}</code>
                                    ${step.backendCall ? `<br>API: <code>${step.backendCall}</code>` : ''}
                                    ${step.databaseQuery ? `<br>Database: <code>${step.databaseQuery}</code>` : ''}
                                    <br>Result: ${step.result}
                                </div>
                            </li>
                        `).join('') : '<li>No detailed steps available</li>'}
                    </ol>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    renderError(message) {
        const html = `
            <div class="prose prose-lg max-w-none">
                <div class="bg-red-50 border-l-4 border-red-400 p-6">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                            </svg>
                        </div>
                        <div class="ml-3">
                            <h3 class="text-sm font-medium text-red-800">Error Loading Content</h3>
                            <p class="mt-2 text-sm text-red-700">${message}</p>
                            <p class="mt-2 text-sm text-red-700">
                                <button onclick="loadSection('${this.currentSection}')" 
                                        class="underline hover:no-underline">
                                    Try again
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.renderContent(html);
    }

    async regenerateDocumentation() {
        // Show confirmation
        if (!confirm('This will regenerate all documentation using the latest codebase. This may take a few minutes. Continue?')) {
            return;
        }
        
        // Clear cache
        this.cache.clear();
        
        // Show loading for regeneration
        const loadingHtml = `
            <div class="prose prose-lg max-w-none">
                <div class="bg-blue-50 border-l-4 border-blue-400 p-6">
                    <div class="flex items-center">
                        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                        <div>
                            <h3 class="text-sm font-medium text-blue-800">Regenerating Documentation</h3>
                            <p class="mt-1 text-sm text-blue-700">
                                Analyzing codebase and generating fresh documentation...
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.renderContent(loadingHtml);
        
        try {
            const response = await fetch('/api/regenerate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Update last updated time
                document.getElementById('lastUpdated').textContent = `Last updated: ${new Date().toLocaleString()}`;
                
                // Reload current section
                await this.loadSection(this.currentSection, false);
                
                // Show success message
                this.showNotification('Documentation regenerated successfully!', 'success');
            } else {
                throw new Error(result.error || 'Failed to regenerate documentation');
            }
        } catch (error) {
            this.renderError(`Failed to regenerate documentation: ${error.message}`);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white fade-in`;
        
        switch (type) {
            case 'success':
                notification.classList.add('bg-green-600');
                break;
            case 'error':
                notification.classList.add('bg-red-600');
                break;
            default:
                notification.classList.add('bg-blue-600');
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Utility method to handle file path clicks
    openFile(filePath) {
        // This could be extended to integrate with IDEs
        console.log('Opening file:', filePath);
        this.showNotification(`File path copied: ${filePath}`, 'info');
        
        // Copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(filePath);
        }
    }
}

// Initialize the documentation viewer
const docViewer = new DocumentationViewer();

// Global functions for HTML onclick handlers
function loadSection(section) {
    docViewer.loadSection(section);
}

function regenerateDocumentation() {
    docViewer.regenerateDocumentation();
}

function openFile(filePath) {
    docViewer.openFile(filePath);
}

// Initialize from URL hash on page load
document.addEventListener('DOMContentLoaded', function() {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['overview', 'architecture', 'frontend', 'backend', 'database', 'userflows', 'deployment', 'troubleshooting'].includes(hash)) {
        loadSection(hash);
    } else {
        loadSection('overview');
    }
});