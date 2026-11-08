---
title: Effortlessly Manage MCP Configurations with Cross-Platform MCP Manager CLI
description: Managing MCP (Model Context Protocol) configurations across different environments like Cursor and Claude Desktop can be a real headache. Copying files…
publishedAt: '2025-08-24T20:06:30.730Z'
updatedAt: '2025-08-24T20:07:03.506Z'
tags:
  - mcp
  - opensource
  - claude
sourceUrl: 'https://blog.niradler.com/effortlessly-manage-mcp-configurations-with-cross-platform-mcp-manager-cli'
originalUrl: 'https://blog.niradler.com/effortlessly-manage-mcp-configurations-with-cross-platform-mcp-manager-cli'
sourceMarkdown: 'https://blog.niradler.com/effortlessly-manage-mcp-configurations-with-cross-platform-mcp-manager-cli.md'
series: Open source
seriesSlug: open-source
cover: /media/effortlessly-manage-mcp-configurations-with-cross-platform-mcp-manager-cli/cover.jpeg
coverAlt: Effortlessly Manage MCP Configurations with Cross-Platform MCP Manager CLI
---
# Effortlessly Manage MCP Configurations with Cross-Platform MCP Manager CLI

Managing **MCP (Model Context Protocol)** configurations across different environments like **Cursor** and **Claude Desktop** can be a real headache. Copying files, keeping track of updates, merging configs, or sharing them between machines often turns into a manual, error-prone process.

That’s why we built **Portable MCP Manager** - an open-source, cross-platform CLI tool that makes managing, sharing, and syncing MCP configurations simple and reliable.

---

## ✨ Why Portable MCP Manager?

Portable MCP Manager solves a common problem for developers and power users who rely on MCP-based tools. Instead of juggling files and paths across environments, you now have a single, streamlined way to:

* 🔄 **Replace** or **merge** configs from multiple sources
    
* 🔗 Fetch configs directly from **URLs** or **GitHub Gists** (even private ones)
    
* 📱 Manage configs for **Cursor** and **Claude Desktop**
    
* 🖥️ Run seamlessly on **Windows** and **macOS**
    
* 📤 Upload configs back to **GitHub Gists** with ease
    
* 🎯 Use an **interactive mode** if you prefer guided setup
    
* 🔀 Handle **multi-file gists** without hassle
    
* 🛠️ Take advantage of **GitHub CLI** if installed
    

---

## ⚡ Getting Started

Install it globally via npm:

```bash
npm install -g portable-mcp
```

Or just run it on-demand with npx:

```bash
npx portable-mcp --help
```

---

## 🚦 Quick Start

### 1\. Interactive Mode (Beginner-Friendly)

```bash
portable-mcp
```

### 2\. Replace a Configuration from Gist

```bash
portable-mcp replace --type cursor --gist 50007c6cd60db13cf8477b3b5caa96f0
```

### 3\. Merge Configurations

```bash
portable-mcp merge --type claude --gist abc123def456
```

### 4\. Upload Config to Gist

```bash
portable-mcp store --type cursor --private
```

---

## 🔍 Example Workflows

### Complete Sync Cycle

```bash
# Check default config path
portable-mcp path --type cursor  

# Replace with a config from Gist
portable-mcp replace --type cursor --gist abc123def456  

# Upload updated config back
portable-mcp store --type cursor --private  
```

### Multi-file Gist Example

```bash
portable-mcp replace --type claude --gist abc123def456/claude.json
```

---

## 🔗 GitHub Integration

* If you have **GitHub CLI** installed, the tool uses it automatically.
    
* Otherwise, set a `GITHUB_TOKEN` for direct API uploads.
    

```bash
export GITHUB_TOKEN=ghp_your_personal_access_token_here
```

---

## 📁 Supported Config Paths

* **Cursor**
    
    * Windows: `C:\Users\<username>\.cursor\mcp.json`
        
    * macOS: `~/Library/Application Support/Cursor/User/mcp.json`
        
* **Claude Desktop**
    
    * Windows: `C:\Users\<username>\AppData\Roaming\Claude\claude_desktop_config.json`
        
    * macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
        

---

Source code: [https://github.com/niradler/portable-mcp](https://github.com/niradler/portable-mcp)
