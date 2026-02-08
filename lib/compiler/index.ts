import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { SolidityCodegen } from "./codegen";
import { generateABI, type ABIEntry } from "./abiGenerator";

export interface CompileResult {
  success: boolean;
  solidity: string;
  abi: ABIEntry[];
  warnings: string[];
  error: string | null;
}

export function compile(source: string, contractName = "LuxbinContract"): CompileResult {
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();

    const parser = new Parser(tokens);
    const ast = parser.parse();

    const codegen = new SolidityCodegen(contractName);
    const { solidity, warnings } = codegen.generate(ast);

    const abi = generateABI(ast);

    return { success: true, solidity, abi, warnings, error: null };
  } catch (e: unknown) {
    return {
      success: false,
      solidity: "",
      abi: [],
      warnings: [],
      error: e instanceof Error ? e.message : "Unknown compilation error",
    };
  }
}

export { Lexer } from "./lexer";
export { Parser } from "./parser";
export { SolidityCodegen } from "./codegen";
export { generateABI } from "./abiGenerator";
export type { ABIEntry } from "./abiGenerator";
