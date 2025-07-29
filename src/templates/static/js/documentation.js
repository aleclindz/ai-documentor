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
                    // Handle different content structures
                    let markdownContent;
                    if (typeof data.content === 'string') {
                        // Overview section returns string directly
                        markdownContent = data.content;
                    } else if (data.content && typeof data.content === 'object') {
                        if (section === 'frontend' && data.content.featuresAndFunctionality) {
                            // Frontend section: combine features and technical overview
                            markdownContent = `${data.content.featuresAndFunctionality}\n\n---\n\n## Technical Architecture\n\n${data.content.overview || ''}`;
                        } else if (data.content.overview) {
                            // Backend/Database sections return object with overview
                            markdownContent = data.content.overview;
                        } else {
                            markdownContent = 'No content available for this section.';
                        }
                    } else {
                        markdownContent = 'No content available for this section.';
                    }
                    content = this.renderMarkdown(markdownContent);
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
        
        const activeItem = document.querySelector(`[onclick="toggleSection('${activeSection}')"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    updateSidebarTOC(section, markdown) {
        const tocContainer = document.getElementById(`${section}-toc`);
        if (!tocContainer) return;

        const headers = markdown.match(/^#{1,3}\s+(.+)$/gm);
        if (!headers || headers.length < 2) {
            tocContainer.innerHTML = '<div class="text-xs text-gray-500 px-3 py-1">No sections found</div>';
            return;
        }
        
        let tocHtml = '';
        headers.forEach(header => {
            const level = header.match(/^#+/)[0].length;
            const text = header.replace(/^#+\s+/, '').replace(/[#*`]/g, '');
            const id = this.generateId(text);
            const indent = level === 1 ? '' : level === 2 ? 'ml-4' : 'ml-8';
            
            tocHtml += `<a href="#${id}" class="${indent} toc-link" onclick="scrollToSection('${id}')">${text}</a>`;
        });
        
        tocContainer.innerHTML = tocHtml;
    }

    toggleSection(section) {
        const tocContainer = document.getElementById(`${section}-toc`);
        const navButton = document.querySelector(`[onclick="toggleSection('${section}')"]`);
        
        if (!tocContainer || !navButton) return;

        // Load the section content if not already loaded
        this.loadSection(section);

        // Toggle the TOC visibility
        if (tocContainer.classList.contains('hidden')) {
            // Close all other sections first
            document.querySelectorAll('.nav-toc').forEach(toc => {
                toc.classList.add('hidden');
            });
            document.querySelectorAll('.nav-item').forEach(btn => {
                btn.classList.remove('expanded');
            });

            // Open this section
            tocContainer.classList.remove('hidden');
            navButton.classList.add('expanded');
        } else {
            // Close this section
            tocContainer.classList.add('hidden');
            navButton.classList.remove('expanded');
        }
    }

    scrollToSection(id) {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Update active TOC link
            document.querySelectorAll('.toc-link').forEach(link => {
                link.classList.remove('active');
            });
            document.querySelector(`[onclick="scrollToSection('${id}')"]`)?.classList.add('active');
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
        
        // Generate sidebar TOC for the current section
        this.updateSidebarTOC(this.currentSection, markdown);
        
        // Use marked.js to convert markdown to HTML
        const html = marked.parse(markdown);
        
        // Just return the content with anchor links (no inline TOC)
        return `
            <div class="prose prose-lg max-w-none">
                <div class="content-with-anchors">
                    ${this.addAnchorLinks(html)}
                </div>
            </div>`;
    }

    generateTableOfContents(markdown) {
        const headers = markdown.match(/^#{1,3}\s+(.+)$/gm);
        if (!headers || headers.length < 2) return null;
        
        let toc = '<ul class="toc-list space-y-1 text-sm">';
        headers.forEach(header => {
            const level = header.match(/^#+/)[0].length;
            const text = header.replace(/^#+\s+/, '').replace(/[#*`]/g, '');
            const id = this.generateId(text);
            const indent = level === 1 ? '' : level === 2 ? 'ml-4' : 'ml-8';
            
            toc += `<li class="${indent}"><a href="#${id}" class="text-blue-600 hover:text-blue-800 hover:underline transition-colors">${text}</a></li>`;
        });
        toc += '</ul>';
        
        return toc;
    }

    addAnchorLinks(html) {
        // Add anchor links to headers
        html = html.replace(/<h([1-3])([^>]*)>([^<]+)<\/h[1-3]>/g, (match, level, attrs, text) => {
            const id = this.generateId(text);
            return `<h${level}${attrs} id="${id}">
                <a href="#${id}" class="anchor-link text-gray-400 hover:text-blue-600 no-underline" aria-hidden="true">#</a>
                ${text}
            </h${level}>`;
        });

        // Add cross-references between sections
        html = this.addCrossReferences(html);

        return html;
    }

    addCrossReferences(html) {
        const sectionLinks = {
            'frontend': '🎨 Frontend',
            'backend': '⚙️ Backend', 
            'database': '🗄️ Database',
            'architecture': '🏗️ Architecture',
            'userflows': '🔄 User Flows',
            'deployment': '🚀 Deployment',
            'troubleshooting': '🔧 Troubleshooting',
            'overview': '🏠 Overview'
        };

        // Replace section references with clickable links
        Object.entries(sectionLinks).forEach(([section, label]) => {
            const patterns = [
                new RegExp(`\\b${section}\\b`, 'gi'),
                new RegExp(`\\b${section} section\\b`, 'gi'),
                new RegExp(`\\bsee ${section}\\b`, 'gi'),
                new RegExp(`\\brefer to ${section}\\b`, 'gi')
            ];

            patterns.forEach(pattern => {
                html = html.replace(pattern, (match) => {
                    // Don't replace if already inside a link
                    if (match.includes('<a') || match.includes('</a>')) return match;
                    
                    return `<a href="#" onclick="toggleSection('${section}')" class="section-link text-blue-600 hover:text-blue-800 underline transition-colors">${match}</a>`;
                });
            });
        });

        // Add "See also" sections at the end of content
        html = this.addSeeAlsoSections(html);

        return html;
    }

    addSeeAlsoSections(html) {
        const currentSection = this.currentSection;
        const relatedSections = this.getRelatedSections(currentSection);
        
        if (relatedSections.length > 0) {
            const seeAlsoHtml = `
                <div class="see-also mt-12 pt-8 border-t border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">📎 See Also</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${relatedSections.map(section => `
                            <a href="#" onclick="toggleSection('${section.id}')" 
                               class="block p-4 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                                <div class="font-medium text-gray-900">${section.label}</div>
                                <div class="text-sm text-gray-600 mt-1">${section.description}</div>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
            
            html += seeAlsoHtml;
        }

        return html;
    }

    getRelatedSections(currentSection) {
        const relationships = {
            'overview': [
                { id: 'architecture', label: '🏗️ Architecture', description: 'System design and component relationships' },
                { id: 'frontend', label: '🎨 Frontend', description: 'User interface and client-side functionality' }
            ],
            'frontend': [
                { id: 'backend', label: '⚙️ Backend', description: 'Server-side APIs and business logic' },
                { id: 'userflows', label: '🔄 User Flows', description: 'How users interact with the application' }
            ],
            'backend': [
                { id: 'frontend', label: '🎨 Frontend', description: 'Client-side interface that calls these APIs' },
                { id: 'database', label: '🗄️ Database', description: 'Data storage and persistence layer' }
            ],
            'database': [
                { id: 'backend', label: '⚙️ Backend', description: 'Server-side logic that queries the database' },
                { id: 'architecture', label: '🏗️ Architecture', description: 'Overall system design including data flow' }
            ],
            'architecture': [
                { id: 'frontend', label: '🎨 Frontend', description: 'Client-side architecture details' },
                { id: 'backend', label: '⚙️ Backend', description: 'Server-side architecture components' }
            ],
            'userflows': [
                { id: 'frontend', label: '🎨 Frontend', description: 'UI components used in these workflows' },
                { id: 'backend', label: '⚙️ Backend', description: 'APIs called during user interactions' }
            ],
            'deployment': [
                { id: 'troubleshooting', label: '🔧 Troubleshooting', description: 'Common deployment issues and solutions' },
                { id: 'architecture', label: '🏗️ Architecture', description: 'System components being deployed' }
            ],
            'troubleshooting': [
                { id: 'deployment', label: '🚀 Deployment', description: 'Deployment procedures and requirements' },
                { id: 'architecture', label: '🏗️ Architecture', description: 'System design for debugging context' }
            ]
        };

        return relationships[currentSection] || [];
    }

    generateId(text) {
        return text.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
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

function toggleSection(section) {
    docViewer.toggleSection(section);
}

function scrollToSection(id) {
    docViewer.scrollToSection(id);
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
        // Small delay to ensure server is ready
        setTimeout(() => toggleSection(hash), 100);
    } else {
        // Small delay to ensure server is ready
        setTimeout(() => toggleSection('overview'), 100);
    }
});