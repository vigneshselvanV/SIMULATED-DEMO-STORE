/**
 * toolRegistry.js
 * Centralized registry for agent tools with JSON Schema definitions,
 * permission scopes, and risk classification.
 */

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  /**
   * Register a new tool.
   */
  registerTool({
    name,
    description,
    parameters = { type: 'object', properties: {} },
    permissionScope = 'customer', // 'customer' | 'admin' | 'internal'
    riskLevel = 'low',             // 'low' | 'medium' | 'high' | 'critical'
    handler
  }) {
    if (!name || typeof name !== 'string') {
      throw new Error('Tool registration requires a valid string name');
    }
    if (!description || typeof description !== 'string') {
      throw new Error(`Tool "${name}" requires a description`);
    }
    if (typeof handler !== 'function') {
      throw new Error(`Tool "${name}" requires a callable handler function`);
    }

    this.tools.set(name, {
      name,
      description,
      parameters,
      permissionScope,
      riskLevel,
      handler
    });
  }

  /**
   * Retrieve a tool by name.
   */
  getTool(name) {
    return this.tools.get(name) || null;
  }

  /**
   * Check if tool exists.
   */
  hasTool(name) {
    return this.tools.has(name);
  }

  /**
   * Get all registered tools matching an allowed list.
   */
  getToolsForAgent(allowedNames = []) {
    const list = [];
    for (const name of allowedNames) {
      const tool = this.tools.get(name);
      if (tool) {
        list.push(tool);
      }
    }
    return list;
  }

  /**
   * Format allowed tools for OpenRouter / OpenAI tools array payload.
   */
  formatForModel(allowedNames = []) {
    return this.getToolsForAgent(allowedNames).map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));
  }

  /**
   * List all registered tools with metadata.
   */
  listTools() {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      permissionScope: t.permissionScope,
      riskLevel: t.riskLevel,
      parameters: t.parameters
    }));
  }
}

export const toolRegistry = new ToolRegistry();
export default toolRegistry;
