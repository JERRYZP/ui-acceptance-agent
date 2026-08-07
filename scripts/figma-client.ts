// figma-client.ts
// Figma API Client for UI Acceptance Agent
// Extracts design schema from Figma files for comparison with runtime frontend

import axios from 'axios';

// ==================== Configuration ====================

interface FigmaConfig {
  token: string;
  fileKey: string;
  nodeIds?: string[]; // Specific nodes to extract, empty = entire file
  version?: string; // File version hash
}

// ==================== Type Definitions ====================

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  primaryAxisSizing?: 'FIXED' | 'AUTO' | 'HUG';
  counterAxisSizing?: 'FIXED' | 'AUTO' | 'HUG';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';
  componentProperties?: Record<string, { type: string; value: string }>;
  parent?: FigmaNode; // Added during traversal
  styles?: { text?: string; fill?: string; grid?: string };
  characters?: string;
  style?: FigmaTextStyle;
}

interface FigmaFill {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE';
  color?: { r: number; g: number; b: number; a: number };
  gradientHandlePositions?: { x: number; y: number }[];
  gradientStops?: { position: number; color: { r: number; g: number; b: number; a: number } }[];
  opacity?: number;
  blendMode?: string;
}

interface FigmaStroke {
  type: 'SOLID';
  color: { r: number; g: number; b: number; a: number };
  weight: number;
}

interface FigmaTextStyle {
  fontFamily: string;
  fontPostScriptName: string;
  fontWeight: number;
  fontSize: number;
  lineHeightPx: number;
  lineHeightPercent: number;
  letterSpacing: number;
  textAlignHorizontal: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textAlignVertical: 'TOP' | 'CENTER' | 'BOTTOM';
  textDecoration: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
  textCase: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
}

interface ExtractedComponent {
  id: string;
  name: string;
  type: string;
  componentSet?: boolean;
  variants?: Record<string, string[]>;
  layout?: LayoutData | null;
  typography?: TypographyData | null;
  colors?: ColorData | null;
  children?: ExtractedComponent[];
  source: 'figma' | 'screenshot' | 'design.md';
  confidence: number;
}

interface LayoutData {
  width: number;
  height: number;
  x: number;
  y: number;
  flexDirection?: 'row' | 'column';
  gap?: number;
  padding?: { top: number; bottom: number; left: number; right: number };
  alignItems?: string;
  justifyContent?: string;
  borderRadius?: number | { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
}

interface TypographyData {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textAlign: string;
  textDecoration: string;
  textCase: string;
  characters?: string;
}

interface ColorData {
  background?: string;
  backgroundOpacity?: number;
  border?: string;
  borderWeight?: number;
  gradient?: { type: 'linear' | 'radial'; stops: { color: string; position: number }[] };
}

interface DesignTokens {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  typography: Record<string, string>;
  radius: Record<string, string>;
}

interface DesignSchema {
  version: string;
  source: 'figma' | 'screenshot' | 'design.md' | 'mixed';
  source_priority: string[];
  fileKey?: string;
  fileName?: string;
  lastModified?: string;
  components: ExtractedComponent[];
  tokens: DesignTokens;
  textStyles: Record<string, any>;
  colorStyles: Record<string, any>;
  totalComponents: number;
  extractedAt: string;
}

// ==================== Figma Client ====================

class FigmaClient {
  private token: string;
  private fileKey: string;
  private baseURL = 'https://api.figma.com/v1';
  private axiosInstance;

  constructor(config: FigmaConfig) {
    this.token = config.token;
    this.fileKey = config.fileKey;
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-Figma-Token': this.token,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  // ==================== Core Methods ====================

  /**
   * Main entry point: Extract full design schema from Figma
   */
  async extractDesignSchema(): Promise<DesignSchema> {
    console.log(`Extracting design from Figma file: ${this.fileKey}`);

    // Step 1: Get file metadata and document tree
    const fileData = await this.getFile();
    const document = fileData.document;

    // Step 2: Get local variables (design tokens)
    const variables = await this.getLocalVariables();

    // Step 3: Get styles (text/color/grid)
    const styles = await this.getStyles();

    // Step 4: Traverse document tree and extract components
    const components = await this.traverseAndExtract(document);

    // Step 5: Build design schema
    const schema = this.buildDesignSchema({
      components,
      variables,
      styles,
      fileData,
    });

    console.log(`Extracted ${components.length} components from Figma`);
    return schema;
  }

  // ==================== API Calls ====================

  /**
   * GET /v1/files/{file_key}
   */
  private async getFile(): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/files/${this.fileKey}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('Figma API: Invalid or expired token. Please check FIGMA_TOKEN.');
        }
        if (error.response?.status === 404) {
          throw new Error(`Figma API: File not found. Check file key: ${this.fileKey}`);
        }
        if (error.response?.status === 429) {
          throw new Error('Figma API: Rate limit exceeded. Wait 60 seconds and retry.');
        }
      }
      throw error;
    }
  }

  /**
   * GET /v1/files/{file_key}/nodes?ids={node_ids}
   */
  private async getNodes(nodeIds: string[]): Promise<any> {
    if (nodeIds.length === 0) return { nodes: {} };

    // Batch requests (max 100 nodes per request)
    const chunks = this.chunkArray(nodeIds, 100);
    const results: any = { nodes: {} };

    for (const chunk of chunks) {
      const ids = chunk.join(',');
      const response = await this.axiosInstance.get(
        `/files/${this.fileKey}/nodes`,
        { params: { ids } }
      );
      Object.assign(results.nodes, response.data.nodes);
    }

    return results;
  }

  /**
   * GET /v1/files/{file_key}/variables/local
   */
  private async getLocalVariables(): Promise<any> {
    try {
      const response = await this.axiosInstance.get(
        `/files/${this.fileKey}/variables/local`
      );
      return response.data;
    } catch (error) {
      // Variables API may not be available (Figma Enterprise feature)
      console.warn('Local Variables not available (Figma Enterprise required)');
      return { variables: {} };
    }
  }

  /**
   * GET /v1/files/{file_key}/styles
   */
  private async getStyles(): Promise<any> {
    try {
      const response = await this.axiosInstance.get(
        `/files/${this.fileKey}/styles`
      );
      return response.data;
    } catch (error) {
      console.warn('Styles API returned error, using inline styles instead');
      return { meta: { styles: [] } };
    }
  }

  /**
   * GET /v1/images/{file_key}?ids={node_ids}&format=png&scale=2
   * Export nodes as PNG for visual comparison
   */
  private async exportNodesAsImages(nodeIds: string[]): Promise<Record<string, string>> {
    if (nodeIds.length === 0) return {};

    const chunks = this.chunkArray(nodeIds, 50);
    const results: Record<string, string> = {};

    for (const chunk of chunks) {
      const ids = chunk.join(',');
      const response = await this.axiosInstance.get(
        `/images/${this.fileKey}`,
        {
          params: {
            ids,
            format: 'png',
            scale: 2,
          },
        }
      );

      for (const [id, url] of Object.entries(response.data.images)) {
        if (url) {
          results[id] = url as string;
        }
      }
    }

    return results;
  }

  // ==================== Document Traversal ====================

  /**
   * Recursively traverse Figma document tree to extract components
   */
  private async traverseAndExtract(
    node: FigmaNode,
    parent?: FigmaNode
  ): Promise<ExtractedComponent[]> {
    const components: ExtractedComponent[] = [];

    // Skip non-relevant nodes
    const relevantTypes = [
      'FRAME', 'GROUP', 'COMPONENT', 'COMPONENT_SET',
      'INSTANCE', 'TEXT', 'RECTANGLE', 'ELLIPSE', 'VECTOR'
    ];
    if (!relevantTypes.includes(node.type)) {
      if (node.children) {
        for (const child of node.children) {
          const childComponents = await this.traverseAndExtract(child, node);
          components.push(...childComponents);
        }
      }
      return components;
    }

    // Attach parent reference
    (node as any).parent = parent;

    // Check if this is a component or component set
    const isComponent = node.type === 'COMPONENT' || node.type === 'COMPONENT_SET';
    const isInstance = node.type === 'INSTANCE';

    if (isComponent || isInstance) {
      const extracted = this.extractComponent(node);
      components.push(extracted);
    } else {
      // For non-component frames/groups, check if they contain components
      if (node.type === 'FRAME' || node.type === 'GROUP') {
        const layout = this.extractLayout(node);
        if (layout) {
          components.push({
            id: node.id,
            name: node.name,
            type: 'CONTAINER',
            layout,
            children: [],
            source: 'figma',
            confidence: 1.0,
          });
        }
      }
    }

    // Recurse into children
    if (node.children) {
      for (const child of node.children) {
        const childComponents = await this.traverseAndExtract(child, node);
        if (components.length > 0 && childComponents.length > 0) {
          const parentComp = components[components.length - 1];
          if (parentComp.children) {
            parentComp.children.push(...childComponents);
          }
        } else {
          components.push(...childComponents);
        }
      }
    }

    return components;
  }

  // ==================== Component Extraction ====================

  /**
   * Extract a single component's full data
   */
  private extractComponent(node: FigmaNode): ExtractedComponent {
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      componentSet: node.type === 'COMPONENT_SET',
      variants: this.extractVariants(node),
      layout: this.extractLayout(node),
      typography: this.extractTypography(node),
      colors: this.extractColors(node),
      children: this.extractChildrenNodes(node),
      source: 'figma',
      confidence: 1.0,
    };
  }

  /**
   * Extract layout properties (Auto Layout)
   */
  private extractLayout(node: FigmaNode): LayoutData | null {
    const box = node.absoluteBoundingBox;
    if (!box) return null;

    const layout: LayoutData = {
      width: box.width,
      height: box.height,
      x: box.x,
      y: box.y,
    };

    // Auto Layout properties
    if (node.layoutMode && node.layoutMode !== 'NONE') {
      layout.flexDirection = node.layoutMode === 'HORIZONTAL' ? 'row' : 'column';
      layout.gap = node.itemSpacing || 0;
      layout.padding = {
        top: node.paddingTop || 0,
        bottom: node.paddingBottom || 0,
        left: node.paddingLeft || 0,
        right: node.paddingRight || 0,
      };
      layout.alignItems = this.mapAlignment(node.counterAxisAlignItems);
      layout.justifyContent = this.mapJustification(node.primaryAxisAlignItems);
    }

    // Corner radius (single value or array)
    if (typeof node.cornerRadius === 'number') {
      layout.borderRadius = node.cornerRadius;
    } else if (node.rectangleCornerRadii) {
      const [tl, tr, br, bl] = node.rectangleCornerRadii;
      layout.borderRadius = { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl };
    }

    return layout;
  }

  /**
   * Extract typography from TEXT nodes
   */
  private extractTypography(node: FigmaNode): TypographyData | null {
    if (node.type !== 'TEXT') {
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'TEXT') {
            return this.extractTypography(child);
          }
        }
      }
      return null;
    }

    const style = node.style as FigmaTextStyle;
    if (!style) return null;

    return {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeightPx || (style.lineHeightPercent * style.fontSize / 100),
      letterSpacing: style.letterSpacing || 0,
      textAlign: style.textAlignHorizontal?.toLowerCase() || 'left',
      textDecoration: style.textDecoration?.toLowerCase() || 'none',
      textCase: style.textCase?.toLowerCase() || 'original',
      characters: node.characters,
    };
  }

  /**
   * Extract color fills and strokes
   */
  private extractColors(node: FigmaNode): ColorData | null {
    const colors: ColorData = {};

    // Fills
    if (node.fills && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID' && fill.color) {
        colors.background = this.rgbaToHex(fill.color);
        if (fill.opacity !== undefined && fill.opacity < 1) {
          colors.backgroundOpacity = fill.opacity;
        }
      } else if (fill.type === 'GRADIENT_LINEAR' && fill.gradientStops) {
        colors.gradient = {
          type: 'linear',
          stops: fill.gradientStops.map(stop => ({
            color: this.rgbaToHex(stop.color),
            position: stop.position,
          })),
        };
      }
    }

    // Strokes (border)
    if (node.strokes && node.strokes.length > 0) {
      const stroke = node.strokes[0] as FigmaStroke;
      if (stroke.color) {
        colors.border = this.rgbaToHex(stroke.color);
        colors.borderWeight = stroke.weight || 1;
      }
    }

    return Object.keys(colors).length > 0 ? colors : null;
  }

  /**
   * Extract component variants (Component Properties)
   */
  private extractVariants(node: FigmaNode): Record<string, string[]> | null {
    if (!node.componentProperties) return null;

    const variants: Record<string, string[]> = {};
    for (const [key, prop] of Object.entries(node.componentProperties)) {
      // Property format: "State#1234:0" -> "State"
      const name = key.split('#')[0];
      if (!variants[name]) {
        variants[name] = [];
      }
      if (!variants[name].includes(prop.value)) {
        variants[name].push(prop.value);
      }
    }
    return variants;
  }

  /**
   * Extract children node IDs and references
   */
  private extractChildrenNodes(node: FigmaNode): ExtractedComponent[] {
    if (!node.children) return [];
    const children: ExtractedComponent[] = [];
    for (const child of node.children) {
      if (child.absoluteBoundingBox) {
        children.push({
          id: child.id,
          name: child.name,
          type: child.type,
          layout: this.extractLayout(child),
          typography: this.extractTypography(child),
          colors: this.extractColors(child),
          source: 'figma',
          confidence: 1.0,
        });
      }
    }
    return children;
  }

  // ==================== Helper Methods ====================

  /**
   * Convert Figma RGBA (0-1) to HEX string
   */
  private rgbaToHex(color: { r: number; g: number; b: number; a?: number }): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    const a = color.a !== undefined ? Math.round(color.a * 255) : 255;

    if (a === 255) {
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${a.toString(16).padStart(2, '0')}`;
  }

  /**
   * Map Figma alignment to CSS
   */
  private mapAlignment(figmaAlign?: string): string {
    const map: Record<string, string> = {
      MIN: 'flex-start',
      CENTER: 'center',
      MAX: 'flex-end',
      SPACE_BETWEEN: 'space-between',
    };
    return map[figmaAlign || 'MIN'] || 'flex-start';
  }

  /**
   * Map Figma justification to CSS
   */
  private mapJustification(figmaJustify?: string): string {
    const map: Record<string, string> = {
      MIN: 'flex-start',
      CENTER: 'center',
      MAX: 'flex-end',
      SPACE_BETWEEN: 'space-between',
    };
    return map[figmaJustify || 'MIN'] || 'flex-start';
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  // ==================== Schema Building ====================

  /**
   * Build the final Design Schema
   */
  private buildDesignSchema(data: {
    components: ExtractedComponent[];
    variables: any;
    styles: any;
    fileData: any;
  }): DesignSchema {
    return {
      version: '1.0',
      source: 'figma',
      source_priority: ['figma'],
      fileKey: this.fileKey,
      fileName: data.fileData.name || 'Unknown',
      lastModified: data.fileData.lastModified || new Date().toISOString(),
      components: data.components,
      tokens: this.extractTokensFromVariables(data.variables),
      textStyles: this.extractTextStyles(data.styles),
      colorStyles: this.extractColorStyles(data.styles),
      totalComponents: data.components.length,
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract design tokens from Figma Local Variables
   */
  private extractTokensFromVariables(variablesData: any): DesignTokens {
    const tokens: DesignTokens = { colors: {}, spacing: {}, typography: {}, radius: {} };

    if (!variablesData.variables) return tokens;

    for (const [, variable] of Object.entries(variablesData.variables)) {
      const v = variable as any;
      const name = v.name;
      const value = v.resolvedType === 'COLOR' ? this.rgbaToHex(v.value) : v.value;

      if (name.startsWith('color/')) {
        tokens.colors[name.replace('color/', '')] = value;
      } else if (name.startsWith('spacing/')) {
        tokens.spacing[name.replace('spacing/', '')] = `${value}px`;
      } else if (name.startsWith('typography/')) {
        tokens.typography[name.replace('typography/', '')] = `${value}px`;
      } else if (name.startsWith('radius/')) {
        tokens.radius[name.replace('radius/', '')] = `${value}px`;
      }
    }

    return tokens;
  }

  /**
   * Extract text styles from Figma Styles
   */
  private extractTextStyles(stylesData: any): Record<string, any> {
    const textStyles: Record<string, any> = {};
    if (!stylesData.meta?.styles) return textStyles;

    for (const style of stylesData.meta.styles) {
      if (style.styleType === 'TEXT') {
        textStyles[style.name] = {
          id: style.id,
          key: style.key,
          description: style.description,
        };
      }
    }
    return textStyles;
  }

  /**
   * Extract color styles from Figma Styles
   */
  private extractColorStyles(stylesData: any): Record<string, any> {
    const colorStyles: Record<string, any> = {};
    if (!stylesData.meta?.styles) return colorStyles;

    for (const style of stylesData.meta.styles) {
      if (style.styleType === 'FILL') {
        colorStyles[style.name] = {
          id: style.id,
          key: style.key,
          description: style.description,
        };
      }
    }
    return colorStyles;
  }
}

// ==================== Usage Example ====================

/**
 * Example: Extract design schema from Figma
 */
async function extractFigmaDesign() {
  const client = new FigmaClient({
    token: process.env.FIGMA_TOKEN!,
    fileKey: process.env.FIGMA_FILE_ID!,
  });

  try {
    const schema = await client.extractDesignSchema();
    console.log('Design schema extracted successfully');
    console.log(`Total components: ${schema.totalComponents}`);
    console.log(`Tokens: ${Object.keys(schema.tokens).length} categories`);

    // Save to file for later use
    const fs = await import('fs');
    fs.writeFileSync(
      'design-schema-figma.json',
      JSON.stringify(schema, null, 2)
    );

    return schema;
  } catch (error: any) {
    console.error('Figma extraction failed:', error.message);
    // Fallback to screenshot mode
    console.log('Falling back to screenshot + design.md mode');
    return null;
  }
}

/**
 * Export specific components as images for visual comparison
 */
async function exportComponentImages(
  client: FigmaClient,
  componentIds: string[]
): Promise<Record<string, Buffer>> {
  // Note: exportNodesAsImages is private, expose via a public wrapper in production
  const imageUrls: Record<string, string> = {};

  const chunks: string[][] = [];
  for (let i = 0; i < componentIds.length; i += 50) {
    chunks.push(componentIds.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    const ids = chunk.join(',');
    const response = await (client as any).axiosInstance.get(
      `/images/${(client as any).fileKey}`,
      { params: { ids, format: 'png', scale: 2 } }
    );
    for (const [id, url] of Object.entries(response.data.images)) {
      if (url) imageUrls[id] = url as string;
    }
  }

  const images: Record<string, Buffer> = {};
  for (const [id, url] of Object.entries(imageUrls)) {
    if (url) {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      images[id] = Buffer.from(response.data);
    }
  }

  return images;
}

export { FigmaClient, extractFigmaDesign, exportComponentImages };
export type { FigmaConfig, DesignSchema, ExtractedComponent, DesignTokens };
