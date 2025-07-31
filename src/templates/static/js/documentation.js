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
        // Clear all active states
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Set active section
        const activeNavItem = document.querySelector(`[onclick="loadSection('${activeSection}')"]`);
        
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }
    }

    updateSidebarTOC(section, markdown) {
        // Simplified - no longer using sidebar TOC with the new navigation structure
        return;
    }

    toggleNavGroup(section) {
        // Simplified - just load the section directly
        this.loadSection(section);
    }
    
    toggleNavSection(sectionName) {
        const subsections = document.getElementById(`${sectionName}-subsections`);
        const arrow = document.getElementById(`${sectionName}-arrow`);
        
        if (subsections && arrow) {
            if (subsections.classList.contains('hidden')) {
                // Show subsections
                subsections.classList.remove('hidden');
                arrow.classList.add('rotate-180');
                
                // If this is the frontend section, populate individual pages
                if (sectionName === 'frontend') {
                    this.populateIndividualPages();
                }
            } else {
                // Hide subsections
                subsections.classList.add('hidden');
                arrow.classList.remove('rotate-180');
            }
        }
    }
    
    toggleNavSubsection(subsectionName) {
        const subSubsections = document.getElementById(`${subsectionName}-subsections`);
        const arrow = document.getElementById(`${subsectionName}-arrow`);
        
        if (subSubsections && arrow) {
            if (subSubsections.classList.contains('hidden')) {
                // Show sub-subsections
                subSubsections.classList.remove('hidden');
                arrow.classList.add('rotate-180');
            } else {
                // Hide sub-subsections
                subSubsections.classList.add('hidden');
                arrow.classList.remove('rotate-180');
            }
        }
    }
    
    async populateIndividualPages() {
        // Check if already populated
        const pagesList = document.getElementById('individual-pages-list');
        if (!pagesList || pagesList.children.length > 0) return;
        
        try {
            const response = await fetch('/api/frontend-pages-list');
            const data = await response.json();
            
            if (data.pages && data.pages.length > 0) {
                data.pages.forEach(page => {
                    const pageButton = document.createElement('button');
                    pageButton.onclick = () => this.loadSection(`frontend-page-${page.slug}`);
                    pageButton.className = 'nav-sub-subitem w-full text-left px-12 py-1.5 hover:bg-blue-50 transition-colors flex items-center text-xs';
                    pageButton.innerHTML = `
                        <span class="text-sm mr-2">📄</span>
                        <span class="truncate">${page.name}</span>
                    `;
                    pagesList.appendChild(pageButton);
                });
            }
        } catch (error) {
            console.warn('Failed to load individual pages:', error);
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
        let html = marked.parse(markdown);
        
        // Add cross-references between sections BEFORE anchor links
        // This prevents cross-reference processing from interfering with headers
        html = this.addCrossReferences(html);
        
        // Add anchor links AFTER cross-references
        html = this.addAnchorLinks(html);
        
        // Return clean content with anchor links
        return `
            <div class="prose prose-lg max-w-none">
                ${html}
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
        // Completely rewrite anchor link processing to handle malformed headers
        return html.replace(/<h([1-3])([^>]*?)>(.*?)<\/h[1-3]>/gs, (match, level, attrs, content) => {
            // Clean up any existing malformed attributes in the content
            let cleanContent = content;
            
            // Remove any malformed id attributes that ended up in the content
            cleanContent = cleanContent.replace(/^[^"]*"[^>]*">\s*/, '');
            cleanContent = cleanContent.replace(/^[^"]*">\s*/, '');
            
            // Remove any existing anchor links
            cleanContent = cleanContent.replace(/<a[^>]*class="anchor-link"[^>]*>.*?<\/a>/g, '');
            
            // Extract pure text content for ID generation
            const textContent = cleanContent.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '').trim();
            
            // Skip if no meaningful text content
            if (!textContent || textContent.length < 2) {
                return match;
            }
            
            // Generate clean ID from text content
            const cleanId = this.generateId(textContent);
            
            // Clean up existing attributes - remove any malformed id attributes
            let cleanAttrs = attrs.replace(/\s*id="[^"]*"/g, '');
            
            // Build clean header with proper ID and anchor link
            return `<h${level} id="${cleanId}"${cleanAttrs}>${textContent}<a href="#${cleanId}" class="anchor-link text-gray-400 hover:text-blue-600 no-underline ml-2" aria-hidden="true">#</a></h${level}>`;
        });
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
                html = html.replace(pattern, (match, offset, string) => {
                    // Don't replace if already inside a link or header tag
                    const beforeMatch = string.substring(Math.max(0, offset - 50), offset);
                    const afterMatch = string.substring(offset + match.length, Math.min(string.length, offset + match.length + 50));
                    
                    // Skip if inside HTML tags, especially headers
                    if (beforeMatch.includes('<a') && !beforeMatch.includes('</a>')) return match;
                    if (beforeMatch.includes('<h') && !afterMatch.includes('</h')) return match;
                    if (match.includes('<a') || match.includes('</a>')) return match;
                    
                    return `<a href="#" onclick="toggleNavGroup('${section}')" class="section-link text-blue-600 hover:text-blue-800 underline transition-colors">${match}</a>`;
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
                            <a href="#" onclick="toggleNavGroup('${section.id}')" 
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
                <p>Page-by-page breakdown of user interactions, showing what actions users can take and how they connect to backend functionality.</p>
                
                <div class="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8">
                    <h3 class="text-lg font-semibold text-blue-900 mb-2">How to Navigate</h3>
                    <ul class="text-blue-800 space-y-1 text-sm">
                        <li><strong>Page Sections:</strong> Each section represents a user-facing page or view</li>
                        <li><strong>Action Items:</strong> Blue buttons/links show user interactions</li>
                        <li><strong>Backend Links:</strong> Click function names to see backend documentation</li>
                        <li><strong>Database Operations:</strong> See what data is created, read, updated, or deleted</li>
                    </ul>
                </div>
        `;
        
        flows.forEach((flow, index) => {
            html += `
                <div class="page-flow-card bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
                    <div class="flex items-center mb-4">
                        <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <span class="text-blue-600 font-semibold">${index + 1}</span>
                        </div>
                        <h2 class="text-2xl font-bold text-gray-900 m-0">${flow.name}</h2>
                    </div>
                    
                    <p class="text-gray-600 mb-6 text-lg">${flow.description}</p>
                    
                    ${flow.diagram ? `<div class="mermaid mb-6">${flow.diagram}</div>` : ''}
                    
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">User Actions Available:</h3>
                    
                    <div class="space-y-4">
                        ${flow.steps ? flow.steps.map(step => `
                            <div class="action-item bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <div class="flex items-start">
                                    <div class="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-3 mt-0.5">
                                        <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                        </svg>
                                    </div>
                                    <div class="flex-1">
                                        <h4 class="font-semibold text-gray-900 mb-2">${step.action}</h4>
                                        
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span class="font-medium text-gray-700">User Interaction:</span>
                                                <div class="text-gray-600 mt-1">
                                                    ${step.event ? `<span class="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs mr-2">${step.event}</span>` : ''}
                                                    ${step.result}
                                                </div>
                                            </div>
                                            
                                            ${step.serviceFunction ? `
                                            <div>
                                                <span class="font-medium text-gray-700">Backend Function:</span>
                                                <div class="text-gray-600 mt-1">
                                                    <a href="#" onclick="loadSection('backend')" 
                                                       class="inline-block bg-blue-100 text-blue-800 hover:bg-blue-200 px-2 py-1 rounded text-xs transition-colors">
                                                        ${step.serviceFunction}
                                                    </a>
                                                    ${step.apiEndpoint ? `<div class="text-xs text-gray-500 mt-1">Endpoint: <code>${step.apiEndpoint}</code></div>` : ''}
                                                </div>
                                            </div>
                                            ` : ''}
                                        </div>
                                        
                                        ${step.dbModel ? `
                                        <div class="mt-3 pt-3 border-t border-gray-200">
                                            <span class="font-medium text-gray-700 text-sm">Database Impact:</span>
                                            <div class="text-gray-600 mt-1">
                                                <a href="#" onclick="loadSection('database')" 
                                                   class="inline-block bg-purple-100 text-purple-800 hover:bg-purple-200 px-2 py-1 rounded text-xs transition-colors">
                                                    ${step.dbModel} table
                                                </a>
                                            </div>
                                        </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('') : '<div class="text-gray-500 text-center py-8">No user actions documented for this page</div>'}
                    </div>
                </div>
            `;
        });
        
        // Add cross-reference guide
        html += `
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 mt-8">
                <h3 class="text-lg font-semibold text-gray-800 mb-3">🔗 Cross-Reference Guide</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                        <h4 class="font-medium text-blue-600 mb-2">Backend Functions</h4>
                        <p class="text-gray-600">Click blue function badges to jump to the Backend section and see detailed implementation, parameters, and responses.</p>
                    </div>
                    <div>
                        <h4 class="font-medium text-purple-600 mb-2">Database Operations</h4>
                        <p class="text-gray-600">Click purple database badges to view the Database section for table schemas, relationships, and query details.</p>
                    </div>
                    <div>
                        <h4 class="font-medium text-green-600 mb-2">Navigation Flow</h4>
                        <p class="text-gray-600">Follow the numbered page flows to understand the complete user journey through your application.</p>
                    </div>
                </div>
            </div>
        `;
        
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

function toggleNavGroup(section) {
    docViewer.toggleNavGroup(section);
}

function toggleNavSection(sectionName) {
    docViewer.toggleNavSection(sectionName);
}

function toggleNavSubsection(subsectionName) {
    docViewer.toggleNavSubsection(subsectionName);
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
    const validSections = ['overview', 'architecture', 'frontend', 'frontend-pages', 'frontend-components', 'backend', 'database', 'userflows', 'deployment', 'troubleshooting'];
    
    if (hash && (validSections.includes(hash) || hash.startsWith('frontend-page-'))) {
        // Small delay to ensure server is ready
        setTimeout(() => {
            // If it's a frontend subsection, make sure the parent section is expanded
            if (hash.startsWith('frontend-')) {
                toggleNavSection('frontend');
                
                // If it's an individual page, also expand the pages subsection
                if (hash.startsWith('frontend-page-')) {
                    setTimeout(() => toggleNavSubsection('frontend-pages'), 50);
                }
            }
            loadSection(hash);
        }, 100);
    } else {
        // Small delay to ensure server is ready
        setTimeout(() => loadSection('overview'), 100);
    }
});