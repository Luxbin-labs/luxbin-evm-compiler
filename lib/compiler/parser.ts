import {
  Token,
  TokenType,
  Program,
  Statement,
  Expression,
  LetDeclaration,
  ConstDeclaration,
  Assignment,
  IndexAssignment,
  IfStatement,
  WhileStatement,
  ForStatement,
  FunctionDeclaration,
  ReturnStatement,
  ExpressionStatement,
} from "./types";

export class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Program {
    const body: Statement[] = [];
    this.skipNewlines();
    while (!this.isAtEnd()) {
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    return { type: "Program", body };
  }

  // ── Helpers ────────────────────────────────────────────

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private peekAt(offset: number): Token {
    const idx = this.pos + offset;
    if (idx >= this.tokens.length) return this.tokens[this.tokens.length - 1];
    return this.tokens[idx];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  private expect(type: TokenType, msg?: string): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new Error(
        msg || `Expected ${type} but got ${token.type} ("${token.value}") at line ${token.line}:${token.column}`
      );
    }
    return this.advance();
  }

  private match(type: TokenType): boolean {
    if (this.peek().type === type) {
      this.advance();
      return true;
    }
    return false;
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private skipNewlines() {
    while (this.peek().type === TokenType.NEWLINE) {
      this.advance();
    }
  }

  private expectNewline() {
    if (this.peek().type === TokenType.NEWLINE || this.peek().type === TokenType.EOF) {
      if (this.peek().type === TokenType.NEWLINE) this.advance();
    }
    // Be lenient — don't throw if newline is missing
  }

  // ── Statements ─────────────────────────────────────────

  private parseStatement(): Statement {
    const token = this.peek();

    switch (token.type) {
      case TokenType.LET:
        return this.parseLetDeclaration();
      case TokenType.CONST:
        return this.parseConstDeclaration();
      case TokenType.FUNC:
        return this.parseFunctionDeclaration();
      case TokenType.IF:
        return this.parseIfStatement();
      case TokenType.WHILE:
        return this.parseWhileStatement();
      case TokenType.FOR:
        return this.parseForStatement();
      case TokenType.RETURN:
        return this.parseReturnStatement();
      case TokenType.BREAK:
        this.advance();
        this.expectNewline();
        return { type: "BreakStatement" };
      case TokenType.CONTINUE:
        this.advance();
        this.expectNewline();
        return { type: "ContinueStatement" };
      case TokenType.IDENTIFIER: {
        // Assignment: name = expr  or  name[idx] = expr
        const next = this.peekAt(1);
        if (next.type === TokenType.EQUALS) {
          return this.parseAssignment();
        }
        if (next.type === TokenType.LBRACKET) {
          return this.parseIndexAssignmentOrExpression();
        }
        return this.parseExpressionStatement();
      }
      default:
        return this.parseExpressionStatement();
    }
  }

  private parseLetDeclaration(): LetDeclaration {
    this.expect(TokenType.LET);
    const name = this.expect(TokenType.IDENTIFIER).value;
    let typeAnnotation: string | null = null;
    if (this.match(TokenType.COLON)) {
      typeAnnotation = this.expect(TokenType.IDENTIFIER).value;
    }
    let value: Expression | null = null;
    if (this.match(TokenType.EQUALS)) {
      value = this.parseExpression();
    }
    this.expectNewline();
    return { type: "LetDeclaration", name, typeAnnotation, value };
  }

  private parseConstDeclaration(): ConstDeclaration {
    this.expect(TokenType.CONST);
    const name = this.expect(TokenType.IDENTIFIER).value;
    let typeAnnotation: string | null = null;
    if (this.match(TokenType.COLON)) {
      typeAnnotation = this.expect(TokenType.IDENTIFIER).value;
    }
    this.expect(TokenType.EQUALS);
    const value = this.parseExpression();
    this.expectNewline();
    return { type: "ConstDeclaration", name, typeAnnotation, value };
  }

  private parseAssignment(): Assignment {
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.EQUALS);
    const value = this.parseExpression();
    this.expectNewline();
    return { type: "Assignment", name, value };
  }

  private parseIndexAssignmentOrExpression(): Statement {
    // We see: identifier [ ...
    // Could be: a[i] = expr (index assignment)
    // or: a[i] (expression statement, e.g. a function call result)
    const savedPos = this.pos;
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LBRACKET);
    const index = this.parseExpression();
    this.expect(TokenType.RBRACKET);

    if (this.peek().type === TokenType.EQUALS) {
      this.advance();
      const value = this.parseExpression();
      this.expectNewline();
      return { type: "IndexAssignment", name, index, value } as IndexAssignment;
    }

    // It was actually an expression (index access), backtrack
    this.pos = savedPos;
    return this.parseExpressionStatement();
  }

  private parseFunctionDeclaration(): FunctionDeclaration {
    this.expect(TokenType.FUNC);
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LPAREN);

    const params: { name: string; typeAnnotation: string | null }[] = [];
    if (this.peek().type !== TokenType.RPAREN) {
      do {
        const pName = this.expect(TokenType.IDENTIFIER).value;
        let pType: string | null = null;
        if (this.match(TokenType.COLON)) {
          pType = this.expect(TokenType.IDENTIFIER).value;
        }
        params.push({ name: pName, typeAnnotation: pType });
      } while (this.match(TokenType.COMMA));
    }
    this.expect(TokenType.RPAREN);

    let returnType: string | null = null;
    if (this.match(TokenType.COLON)) {
      returnType = this.expect(TokenType.IDENTIFIER).value;
    }
    this.expectNewline();
    this.skipNewlines();

    const body: Statement[] = [];
    while (this.peek().type !== TokenType.END && !this.isAtEnd()) {
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    this.expect(TokenType.END);
    this.expectNewline();

    return { type: "FunctionDeclaration", name, params, returnType, body };
  }

  private parseIfStatement(): IfStatement {
    this.expect(TokenType.IF);
    const condition = this.parseExpression();
    this.expect(TokenType.THEN);
    this.expectNewline();
    this.skipNewlines();

    const consequent: Statement[] = [];
    while (
      this.peek().type !== TokenType.ELSE &&
      this.peek().type !== TokenType.END &&
      !this.isAtEnd()
    ) {
      consequent.push(this.parseStatement());
      this.skipNewlines();
    }

    const alternateConditions: { condition: Expression; body: Statement[] }[] = [];
    let alternate: Statement[] | null = null;

    while (this.peek().type === TokenType.ELSE) {
      this.advance(); // consume 'else'
      if (this.peek().type === TokenType.IF) {
        // else if
        this.advance(); // consume 'if'
        const elifCondition = this.parseExpression();
        this.expect(TokenType.THEN);
        this.expectNewline();
        this.skipNewlines();

        const elifBody: Statement[] = [];
        while (
          this.peek().type !== TokenType.ELSE &&
          this.peek().type !== TokenType.END &&
          !this.isAtEnd()
        ) {
          elifBody.push(this.parseStatement());
          this.skipNewlines();
        }
        alternateConditions.push({ condition: elifCondition, body: elifBody });
      } else {
        // else block
        this.expectNewline();
        this.skipNewlines();
        alternate = [];
        while (this.peek().type !== TokenType.END && !this.isAtEnd()) {
          alternate.push(this.parseStatement());
          this.skipNewlines();
        }
        break;
      }
    }

    this.expect(TokenType.END);
    this.expectNewline();

    return { type: "IfStatement", condition, consequent, alternateConditions, alternate };
  }

  private parseWhileStatement(): WhileStatement {
    this.expect(TokenType.WHILE);
    const condition = this.parseExpression();
    this.expect(TokenType.DO);
    this.expectNewline();
    this.skipNewlines();

    const body: Statement[] = [];
    while (this.peek().type !== TokenType.END && !this.isAtEnd()) {
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    this.expect(TokenType.END);
    this.expectNewline();

    return { type: "WhileStatement", condition, body };
  }

  private parseForStatement(): ForStatement {
    this.expect(TokenType.FOR);
    const variable = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.IN);
    const iterable = this.parseExpression();
    this.expect(TokenType.DO);
    this.expectNewline();
    this.skipNewlines();

    const body: Statement[] = [];
    while (this.peek().type !== TokenType.END && !this.isAtEnd()) {
      body.push(this.parseStatement());
      this.skipNewlines();
    }
    this.expect(TokenType.END);
    this.expectNewline();

    return { type: "ForStatement", variable, iterable, body };
  }

  private parseReturnStatement(): ReturnStatement {
    this.expect(TokenType.RETURN);
    let value: Expression | null = null;
    if (this.peek().type !== TokenType.NEWLINE && this.peek().type !== TokenType.EOF) {
      value = this.parseExpression();
    }
    this.expectNewline();
    return { type: "ReturnStatement", value };
  }

  private parseExpressionStatement(): ExpressionStatement {
    const expression = this.parseExpression();
    this.expectNewline();
    return { type: "ExpressionStatement", expression };
  }

  // ── Expressions (precedence climbing) ──────────────────

  private parseExpression(): Expression {
    return this.parseOr();
  }

  private parseOr(): Expression {
    let left = this.parseAnd();
    while (this.peek().type === TokenType.OR) {
      this.advance();
      const right = this.parseAnd();
      left = { type: "BinaryExpression", operator: "or", left, right };
    }
    return left;
  }

  private parseAnd(): Expression {
    let left = this.parseEquality();
    while (this.peek().type === TokenType.AND) {
      this.advance();
      const right = this.parseEquality();
      left = { type: "BinaryExpression", operator: "and", left, right };
    }
    return left;
  }

  private parseEquality(): Expression {
    let left = this.parseComparison();
    while (
      this.peek().type === TokenType.DOUBLE_EQUALS ||
      this.peek().type === TokenType.NOT_EQUALS
    ) {
      const op = this.advance().value;
      const right = this.parseComparison();
      left = { type: "BinaryExpression", operator: op, left, right };
    }
    return left;
  }

  private parseComparison(): Expression {
    let left = this.parseAddition();
    while (
      this.peek().type === TokenType.LESS_THAN ||
      this.peek().type === TokenType.GREATER_THAN ||
      this.peek().type === TokenType.LESS_EQUALS ||
      this.peek().type === TokenType.GREATER_EQUALS
    ) {
      const op = this.advance().value;
      const right = this.parseAddition();
      left = { type: "BinaryExpression", operator: op, left, right };
    }
    return left;
  }

  private parseAddition(): Expression {
    let left = this.parseMultiplication();
    while (
      this.peek().type === TokenType.PLUS ||
      this.peek().type === TokenType.MINUS
    ) {
      const op = this.advance().value;
      const right = this.parseMultiplication();
      left = { type: "BinaryExpression", operator: op, left, right };
    }
    return left;
  }

  private parseMultiplication(): Expression {
    let left = this.parseExponent();
    while (
      this.peek().type === TokenType.STAR ||
      this.peek().type === TokenType.SLASH ||
      this.peek().type === TokenType.PERCENT
    ) {
      const op = this.advance().value;
      const right = this.parseExponent();
      left = { type: "BinaryExpression", operator: op, left, right };
    }
    return left;
  }

  private parseExponent(): Expression {
    const left = this.parseUnary();
    if (this.peek().type === TokenType.CARET) {
      this.advance();
      const right = this.parseExponent(); // right-associative
      return { type: "BinaryExpression", operator: "^", left, right };
    }
    return left;
  }

  private parseUnary(): Expression {
    if (this.peek().type === TokenType.NOT) {
      this.advance();
      const operand = this.parseUnary();
      return { type: "UnaryExpression", operator: "not", operand };
    }
    if (this.peek().type === TokenType.MINUS) {
      this.advance();
      const operand = this.parseUnary();
      return { type: "UnaryExpression", operator: "-", operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expression {
    const token = this.peek();

    // Number literal
    if (token.type === TokenType.NUMBER) {
      this.advance();
      const isFloat = token.value.includes(".");
      return { type: "NumberLiteral", value: Number(token.value), isFloat };
    }

    // String literal
    if (token.type === TokenType.STRING) {
      this.advance();
      return { type: "StringLiteral", value: token.value };
    }

    // Boolean literals
    if (token.type === TokenType.TRUE) {
      this.advance();
      return { type: "BooleanLiteral", value: true };
    }
    if (token.type === TokenType.FALSE) {
      this.advance();
      return { type: "BooleanLiteral", value: false };
    }

    // Nil
    if (token.type === TokenType.NIL) {
      this.advance();
      return { type: "NilLiteral" };
    }

    // Parenthesized expression
    if (token.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN);
      return expr;
    }

    // Array literal
    if (token.type === TokenType.LBRACKET) {
      this.advance();
      const elements: Expression[] = [];
      if (this.peek().type !== TokenType.RBRACKET) {
        elements.push(this.parseExpression());
        while (this.match(TokenType.COMMA)) {
          elements.push(this.parseExpression());
        }
      }
      this.expect(TokenType.RBRACKET);
      return { type: "ArrayLiteral", elements };
    }

    // Identifier, function call, or index expression
    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      const name = token.value;

      // Function call: name(args)
      if (this.peek().type === TokenType.LPAREN) {
        this.advance();
        const args: Expression[] = [];
        if (this.peek().type !== TokenType.RPAREN) {
          args.push(this.parseExpression());
          while (this.match(TokenType.COMMA)) {
            args.push(this.parseExpression());
          }
        }
        this.expect(TokenType.RPAREN);
        let expr: Expression = { type: "CallExpression", callee: name, arguments: args };

        // Handle chained index: func()[i]
        while (this.peek().type === TokenType.LBRACKET) {
          this.advance();
          const index = this.parseExpression();
          this.expect(TokenType.RBRACKET);
          expr = { type: "IndexExpression", object: expr, index };
        }
        return expr;
      }

      // Index expression: name[idx]
      if (this.peek().type === TokenType.LBRACKET) {
        this.advance();
        const index = this.parseExpression();
        this.expect(TokenType.RBRACKET);
        return { type: "IndexExpression", object: { type: "Identifier", name }, index };
      }

      return { type: "Identifier", name };
    }

    throw new Error(`Unexpected token ${token.type} ("${token.value}") at line ${token.line}:${token.column}`);
  }
}
