import * as fs from 'fs';
import * as path from 'path';

// Cache for template contents
const templateCache: Map<string, string> = new Map();

// Read and cache styles
let stylesContent: string | null = null;

function getStyles(): string {
  if (!stylesContent) {
    const stylesPath = path.join(__dirname, 'templates', 'styles.css');
    stylesContent = fs.readFileSync(stylesPath, 'utf-8');
  }
  return stylesContent;
}

/**
 * Renders a template with the given variables
 * @param templateName - Name of the template file (without .html extension)
 * @param variables - Object containing variables to replace in template
 * @returns Rendered HTML string
 */
export function renderTemplate(templateName: string, variables: Record<string, string> = {}): string {
  // Get template content
  let template: string;
  
  if (templateCache.has(templateName)) {
    template = templateCache.get(templateName)!;
  } else {
    const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);
    template = fs.readFileSync(templatePath, 'utf-8');
    templateCache.set(templateName, template);
  }

  // Note: Styles are now served via external CSS file, no longer injected inline

  // Replace all variables in the template
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    template = template.replace(regex, value);
  }

  return template;
}

/**
 * Utility function to create token address row for confirmation page
 */
export function createTokenAddressRow(tokenAddress: string | null): string {
  if (!tokenAddress) return '';
  
  return `
    <div class="detail-row">
        <span class="detail-label">Token Address:</span>
        <span class="detail-value">${tokenAddress}</span>
    </div>
  `;
}

/**
 * Utility function to create transaction hash display
 */
export function createTransactionHashDisplay(txHash: string | null): string {
  if (!txHash) return '';
  
  return `
    <p><strong>Transaction Hash:</strong></p>
    <div class="tx-hash">${txHash}</div>
  `;
}

/**
 * Helper to get native token symbol for different chains
 */
export function getNativeTokenSymbol(chain: string): string {
  switch (chain) {
    case 'Base':
      return 'ETH';
    case 'BSC':
      return 'BNB';
    case 'xLayer':
      return 'ETH';
    default:
      return 'ETH';
  }
}

/**
 * Clear template cache (useful for development)
 */
export function clearTemplateCache(): void {
  templateCache.clear();
  stylesContent = null;
}
