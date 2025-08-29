import { SimpleMerkleTree } from "@openzeppelin/merkle-tree";
import { keccak } from "ethereumjs-util";

export class IntentTree {
  private tree: SimpleMerkleTree;

  constructor(values: string[]) {
    this.tree = SimpleMerkleTree.of(values);
  }

  public getRoot(): string {
    return this.tree.root;
  }

  public getProof(target: string): number[][] {
    for (const [i, v] of this.tree.entries()) {
      if (v === target) {
        const proof = this.tree.getProof(i);
        const proofBytes = proof.map((hash) => hexToBytes(hash));
        return proofBytes;
      }
    }
  }
}

// Helper function to format as [u8; 32] style
// Helper function to convert hex to byte array
function hexToBytes(hex) {
  const bytes = [];
  for (let i = 2; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}
// Helper function to format as Rust const array with decimal values
function formatAsRustConst(bytes, name) {
  const formatted = bytes.map((b) => b.toString()).join(", ");
  return ` ${name} = [\n    ${formatted}\n];`;
}
