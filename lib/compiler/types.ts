// ── Token Types ──────────────────────────────────────────────

export enum TokenType {
  NUMBER = "NUMBER",
  STRING = "STRING",
  IDENTIFIER = "IDENTIFIER",

  // Keywords
  LET = "LET",
  CONST = "CONST",
  FUNC = "FUNC",
  RETURN = "RETURN",
  IF = "IF",
  THEN = "THEN",
  ELSE = "ELSE",
  END = "END",
  WHILE = "WHILE",
  DO = "DO",
  FOR = "FOR",
  IN = "IN",
  BREAK = "BREAK",
  CONTINUE = "CONTINUE",
  IMPORT = "IMPORT",
  EXPORT = "EXPORT",
  TRUE = "TRUE",
  FALSE = "FALSE",
  NIL = "NIL",
  AND = "AND",
  OR = "OR",
  NOT = "NOT",

  // Operators
  PLUS = "PLUS",
  MINUS = "MINUS",
  STAR = "STAR",
  SLASH = "SLASH",
  PERCENT = "PERCENT",
  CARET = "CARET",
  EQUALS = "EQUALS",
  DOUBLE_EQUALS = "DOUBLE_EQUALS",
  NOT_EQUALS = "NOT_EQUALS",
  LESS_THAN = "LESS_THAN",
  GREATER_THAN = "GREATER_THAN",
  LESS_EQUALS = "LESS_EQUALS",
  GREATER_EQUALS = "GREATER_EQUALS",

  // Punctuation
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  LBRACKET = "LBRACKET",
  RBRACKET = "RBRACKET",
  COMMA = "COMMA",
  COLON = "COLON",

  // Special
  NEWLINE = "NEWLINE",
  EOF = "EOF",
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

// ── AST Node Types ───────────────────────────────────────────

export type Statement =
  | LetDeclaration
  | ConstDeclaration
  | Assignment
  | IndexAssignment
  | IfStatement
  | WhileStatement
  | ForStatement
  | FunctionDeclaration
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | ExpressionStatement;

export type Expression =
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | IndexExpression
  | ArrayLiteral
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | NilLiteral
  | Identifier;

export interface Program {
  type: "Program";
  body: Statement[];
}

export interface LetDeclaration {
  type: "LetDeclaration";
  name: string;
  typeAnnotation: string | null;
  value: Expression | null;
}

export interface ConstDeclaration {
  type: "ConstDeclaration";
  name: string;
  typeAnnotation: string | null;
  value: Expression;
}

export interface Assignment {
  type: "Assignment";
  name: string;
  value: Expression;
}

export interface IndexAssignment {
  type: "IndexAssignment";
  name: string;
  index: Expression;
  value: Expression;
}

export interface IfStatement {
  type: "IfStatement";
  condition: Expression;
  consequent: Statement[];
  alternateConditions: { condition: Expression; body: Statement[] }[];
  alternate: Statement[] | null;
}

export interface WhileStatement {
  type: "WhileStatement";
  condition: Expression;
  body: Statement[];
}

export interface ForStatement {
  type: "ForStatement";
  variable: string;
  iterable: Expression;
  body: Statement[];
}

export interface FunctionDeclaration {
  type: "FunctionDeclaration";
  name: string;
  params: { name: string; typeAnnotation: string | null }[];
  returnType: string | null;
  body: Statement[];
}

export interface ReturnStatement {
  type: "ReturnStatement";
  value: Expression | null;
}

export interface BreakStatement {
  type: "BreakStatement";
}

export interface ContinueStatement {
  type: "ContinueStatement";
}

export interface ExpressionStatement {
  type: "ExpressionStatement";
  expression: Expression;
}

export interface BinaryExpression {
  type: "BinaryExpression";
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpression {
  type: "UnaryExpression";
  operator: string;
  operand: Expression;
}

export interface CallExpression {
  type: "CallExpression";
  callee: string;
  arguments: Expression[];
}

export interface IndexExpression {
  type: "IndexExpression";
  object: Expression;
  index: Expression;
}

export interface ArrayLiteral {
  type: "ArrayLiteral";
  elements: Expression[];
}

export interface NumberLiteral {
  type: "NumberLiteral";
  value: number;
  isFloat: boolean;
}

export interface StringLiteral {
  type: "StringLiteral";
  value: string;
}

export interface BooleanLiteral {
  type: "BooleanLiteral";
  value: boolean;
}

export interface NilLiteral {
  type: "NilLiteral";
}

export interface Identifier {
  type: "Identifier";
  name: string;
}
