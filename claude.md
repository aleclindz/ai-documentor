<!-- claude.md — Claude.code manifest
     Purpose: keep documentation generation consistent, hyper-linked, and user-friendly
-->

# 📝 Claude Manifest — Documentation Rules of the Road
This file is the single source of truth for how **Claude.code** analyses a repository and writes docs.  
Most projects will work out-of-the-box; tweak only if you need special behaviour.

```jsonc
{
  "manifestVersion": "1.0",

  /* ===== OUTPUT TARGETS ===== */
  "outputDir": "docs",                  // Where Markdown files land
  "defaultCommand": "ai-documentor",    // CLI to generate docs
  "viewCommand": "ai-documentor view",  // CLI to preview docs locally

  /* ===== AUDIENCE & STYLE ===== */
  "audience": ["engineering", "sales", "success", "support"],
  "tone": "friendly-professional",
  "avoidJargon": true,
  "maxParagraph": 2,                    // Add a sub-header after this length
  "markdownFlavor": "GitHub",
  "diagram": { "tool": "mermaid", "inline": true },

  /* ===== SECTION PRIORITY (top → bottom in README) ===== */
  "sections": [
    "userFlows",    // Primary entry-point for non-technical readers
    "frontend",
    "backend",
    "database",
    "api",
    "deployment",
    "troubleshooting"
  ],

  /* ===== LINKING RULES ===== */
  "crossLinking": true,                 // Build deep links via slugs
  "slugCase": "kebab",                  // login-button, post-api-login, etc.

  /* ===== USER FLOW RULES ===== */
  "userFlow": {
    "min": 3,
    "max": 7,
    "fields": [
      "name",
      "slug",
      "description",
      "steps[action,componentSlug,event,apiSlug,dbModel,result]"
    ]
  },

  /* ===== COMPONENT / API DETAIL ===== */
  "componentDetail": {
    "includeProps": true,
    "includeEvents": true,
    "mapEventToApi": true
  },
  "apiDetail": {
    "includeAuth": true,
    "includeExamples": true,
    "linkCallingComponents": true
  },

  /* ===== REPO TYPE HINTS (optional, Claude autodetects most) ===== */
  "repoHints": {
    "react":   ["*.jsx", "*.tsx"],
    "nextjs":  ["next.config.js", "app/**"],
    "vue":     ["*.vue"],
    "django":  ["manage.py"],
    "express": ["app.js", "server.js"]
  },

  /* ===== EXCLUSIONS ===== */
  "ignore": ["node_modules", "dist", "coverage", "*.test.*", ".git"]
}