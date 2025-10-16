import * as fs from 'fs';
import * as path from 'path';

// Cache for template contents
const templateCache: Map<string, string> = new Map();

// Read and cache styles
let stylesContent: string | null = null;

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// List of variables that contain safe HTML and should NOT be escaped
const SAFE_HTML_VARIABLES = ['TRANSACTION_HASH', 'TOKEN_ADDRESS_ROW'];

// Update renderTemplate to escape values
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

  // Replace all variables in the template
  for (const [key, value] of Object.entries(variables)) {
    // Don't escape variables that contain safe HTML
    const processedValue = SAFE_HTML_VARIABLES.includes(key) ? value : escapeHtml(value);
    const regex = new RegExp(`{{${key}}}`, 'g');
    template = template.replace(regex, processedValue);
  }

  return template;
}

/**
 * Utility function to create token address row for confirmation page
 */
export function createTokenAddressRow(tokenAddress: string | null): string {
  if (!tokenAddress) return '';
  
  const escapedAddress = escapeHtml(tokenAddress);
  return `
    <div class="detail-row">
        <span class="detail-label">Token Address:</span>
        <span class="detail-value">${escapedAddress}</span>
    </div>
  `;
}

/**
 * Utility function to create transaction hash display
 */
export function createTransactionHashDisplay(txHash: string | null): string {
  if (!txHash) return '';
  
  const escapedHash = escapeHtml(txHash);
  return `
    <p><strong>Transaction Hash:</strong></p>
    <div class="tx-hash">${escapedHash}</div>
  `;
}

/**
 * Helper to get native token symbol for different chains
 */
export function getNativeTokenSymbol(chain: string): string {
  switch (chain) {
    case 'Base':
      return 'ETH';
    case 'BNB_Chain':
      return 'BNB';
    case 'xLayer':
      return 'OKB';
    default:
      return 'ETH';
  }
}

export function clearTemplateCache(): void {
  templateCache.clear();
  stylesContent = null;
}
