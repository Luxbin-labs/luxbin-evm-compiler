import type { Program, Statement, FunctionDeclaration, Expression } from "./types";

// ── ABI Types ────────────────────────────────────────────

export interface ABIParam {
  name: string;
  type: string;
}

export interface ABIEntry {
  type: "function" | "event" | "constructor";
  name?: string;
  inputs: ABIParam[];
  outputs?: ABIParam[];
  stateMutability?: "pure" | "view" | "nonpayable" | "payable";
  anonymous?: boolean;
}

// ── Type Mapping ─────────────────────────────────────────

const TYPE_MAP: Record<string, string> = {
  photon_int: "int256",
  photon_float: "int256",
  photon_string: "string",
  photon_bool: "bool",
  photon_array: "int256[]",
  qubit: "uint256",
};

function toSolType(luxbinType: string | null): string {
  if (!luxbinType) return "int256";
  return TYPE_MAP[luxbinType] || "int256";
}

// ── ABI Generation ───────────────────────────────────────

export function generateABI(program: Program): ABIEntry[] {
  const abi: ABIEntry[] = [];
  const usesLog = { str: false, int: false, bool: false };

  // Check which log events are used
  checkLogUsage(program.body, usesLog);

  // Add events
  if (usesLog.str) {
    abi.push({
      type: "event",
      name: "Log",
      inputs: [{ name: "message", type: "string" }],
      anonymous: false,
    });
  }
  if (usesLog.int) {
    abi.push({
      type: "event",
      name: "LogInt",
      inputs: [{ name: "value", type: "int256" }],
      anonymous: false,
    });
  }
  if (usesLog.bool) {
    abi.push({
      type: "event",
      name: "LogBool",
      inputs: [{ name: "value", type: "bool" }],
      anonymous: false,
    });
  }

  // Check if we need a constructor (top-level non-declaration, non-function statements)
  const hasConstructor = program.body.some(
    (s) =>
      s.type !== "LetDeclaration" &&
      s.type !== "ConstDeclaration" &&
      s.type !== "FunctionDeclaration"
  );
  // Also check for array state vars that need constructor init
  const hasArrayState = program.body.some(
    (s) => s.type === "LetDeclaration" && s.value?.type === "ArrayLiteral"
  );

  if (hasConstructor || hasArrayState) {
    abi.push({
      type: "constructor",
      inputs: [],
      stateMutability: "nonpayable",
    });
  }

  // State variable getters (public state vars get auto-generated getters)
  for (const stmt of program.body) {
    if (stmt.type === "LetDeclaration" || stmt.type === "ConstDeclaration") {
      const outputType = stmt.value?.type === "ArrayLiteral"
        ? "int256[]"
        : toSolType(stmt.typeAnnotation);

      // Arrays have an indexed getter in Solidity
      if (stmt.value?.type === "ArrayLiteral") {
        abi.push({
          type: "function",
          name: stmt.name,
          inputs: [{ name: "", type: "uint256" }],
          outputs: [{ name: "", type: "int256" }],
          stateMutability: "view",
        });
      } else {
        abi.push({
          type: "function",
          name: stmt.name,
          inputs: [],
          outputs: [{ name: "", type: outputType }],
          stateMutability: "view",
        });
      }
    }
  }

  // Functions
  for (const stmt of program.body) {
    if (stmt.type === "FunctionDeclaration") {
      abi.push(generateFunctionABI(stmt));
    }
  }

  return abi;
}

function generateFunctionABI(func: FunctionDeclaration): ABIEntry {
  const inputs: ABIParam[] = func.params.map((p) => ({
    name: p.name,
    type: toSolType(p.typeAnnotation),
  }));

  const hasReturn = functionHasReturn(func.body);
  const entry: ABIEntry = {
    type: "function",
    name: func.name,
    inputs,
    stateMutability: "nonpayable",
  };

  if (hasReturn) {
    const returnType = func.returnType
      ? toSolType(func.returnType)
      : inferReturnType(func.body);
    entry.outputs = [{ name: "", type: returnType }];
  } else {
    entry.outputs = [];
  }

  // If function doesn't modify state (no assignments to state vars), mark as view
  // For simplicity, only mark as view if there are no assignments at all and it has a return
  if (hasReturn && !functionModifiesState(func.body)) {
    entry.stateMutability = "view";
  }

  return entry;
}

function functionHasReturn(body: Statement[]): boolean {
  for (const stmt of body) {
    if (stmt.type === "ReturnStatement" && stmt.value) return true;
    if (stmt.type === "IfStatement") {
      if (functionHasReturn(stmt.consequent)) return true;
      if (stmt.alternate && functionHasReturn(stmt.alternate)) return true;
      for (const ac of stmt.alternateConditions) {
        if (functionHasReturn(ac.body)) return true;
      }
    }
    if (stmt.type === "WhileStatement" && functionHasReturn(stmt.body)) return true;
    if (stmt.type === "ForStatement" && functionHasReturn(stmt.body)) return true;
  }
  return false;
}

function functionModifiesState(body: Statement[]): boolean {
  for (const stmt of body) {
    if (stmt.type === "Assignment" || stmt.type === "IndexAssignment") return true;
    if (stmt.type === "ExpressionStatement" && stmt.expression.type === "CallExpression") {
      // Calls to photon_print emit events (modify state)
      if (stmt.expression.callee === "photon_print") return true;
    }
    if (stmt.type === "IfStatement") {
      if (functionModifiesState(stmt.consequent)) return true;
      if (stmt.alternate && functionModifiesState(stmt.alternate)) return true;
      for (const ac of stmt.alternateConditions) {
        if (functionModifiesState(ac.body)) return true;
      }
    }
    if (stmt.type === "WhileStatement" && functionModifiesState(stmt.body)) return true;
    if (stmt.type === "ForStatement" && functionModifiesState(stmt.body)) return true;
  }
  return false;
}

function inferReturnType(body: Statement[]): string {
  for (const stmt of body) {
    if (stmt.type === "ReturnStatement" && stmt.value) {
      return inferExprType(stmt.value);
    }
  }
  return "int256";
}

function inferExprType(expr: Expression): string {
  switch (expr.type) {
    case "StringLiteral": return "string";
    case "BooleanLiteral": return "bool";
    case "ArrayLiteral": return "int256[]";
    case "NumberLiteral": return "int256";
    case "BinaryExpression":
      if (expr.operator === "==" || expr.operator === "!=" ||
          expr.operator === "<" || expr.operator === ">" ||
          expr.operator === "<=" || expr.operator === ">=" ||
          expr.operator === "and" || expr.operator === "or") {
        return "bool";
      }
      return "int256";
    case "UnaryExpression":
      if (expr.operator === "not") return "bool";
      return "int256";
    default: return "int256";
  }
}

function checkLogUsage(body: Statement[], usesLog: { str: boolean; int: boolean; bool: boolean }) {
  for (const stmt of body) {
    if (stmt.type === "ExpressionStatement" && stmt.expression.type === "CallExpression") {
      if (stmt.expression.callee === "photon_print" && stmt.expression.arguments.length > 0) {
        const arg = stmt.expression.arguments[0];
        if (arg.type === "StringLiteral") usesLog.str = true;
        else if (arg.type === "BooleanLiteral") usesLog.bool = true;
        else usesLog.int = true;
      }
    }
    if (stmt.type === "FunctionDeclaration") checkLogUsage(stmt.body, usesLog);
    if (stmt.type === "IfStatement") {
      checkLogUsage(stmt.consequent, usesLog);
      if (stmt.alternate) checkLogUsage(stmt.alternate, usesLog);
      for (const ac of stmt.alternateConditions) checkLogUsage(ac.body, usesLog);
    }
    if (stmt.type === "WhileStatement") checkLogUsage(stmt.body, usesLog);
    if (stmt.type === "ForStatement") checkLogUsage(stmt.body, usesLog);
  }
}
