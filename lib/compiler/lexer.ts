import { Token, TokenType } from "./types";

const KEYWORDS: Record<string, TokenType> = {
  let: TokenType.LET,
  const: TokenType.CONST,
  func: TokenType.FUNC,
  return: TokenType.RETURN,
  if: TokenType.IF,
  then: TokenType.THEN,
  else: TokenType.ELSE,
  end: TokenType.END,
  while: TokenType.WHILE,
  do: TokenType.DO,
  for: TokenType.FOR,
  in: TokenType.IN,
  break: TokenType.BREAK,
  continue: TokenType.CONTINUE,
  import: TokenType.IMPORT,
  export: TokenType.EXPORT,
  true: TokenType.TRUE,
  false: TokenType.FALSE,
  nil: TokenType.NIL,
  and: TokenType.AND,
  or: TokenType.OR,
  not: TokenType.NOT,
};

export class Lexer {
  private source: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];

      if (ch === " " || ch === "\t" || ch === "\r") {
        this.advance();
        continue;
      }

      // Comments: # to end of line
      if (ch === "#") {
        while (this.pos < this.source.length && this.source[this.pos] !== "\n") {
          this.advance();
        }
        continue;
      }

      // Newlines
      if (ch === "\n") {
        if (this.tokens.length > 0 && this.tokens[this.tokens.length - 1].type !== TokenType.NEWLINE) {
          this.tokens.push({ type: TokenType.NEWLINE, value: "\\n", line: this.line, column: this.column });
        }
        this.line++;
        this.column = 1;
        this.pos++;
        continue;
      }

      // Numbers
      if (this.isDigit(ch)) {
        this.readNumber();
        continue;
      }

      // Strings
      if (ch === '"') {
        this.readString();
        continue;
      }

      // Identifiers and keywords
      if (this.isAlpha(ch)) {
        this.readIdentifier();
        continue;
      }

      // Two-character operators
      if (this.pos + 1 < this.source.length) {
        const two = ch + this.source[this.pos + 1];
        if (two === "==") { this.addToken(TokenType.DOUBLE_EQUALS, "=="); this.advance(); this.advance(); continue; }
        if (two === "!=") { this.addToken(TokenType.NOT_EQUALS, "!="); this.advance(); this.advance(); continue; }
        if (two === "<=") { this.addToken(TokenType.LESS_EQUALS, "<="); this.advance(); this.advance(); continue; }
        if (two === ">=") { this.addToken(TokenType.GREATER_EQUALS, ">="); this.advance(); this.advance(); continue; }
      }

      // Single-character operators and punctuation
      switch (ch) {
        case "+": this.addToken(TokenType.PLUS, "+"); this.advance(); continue;
        case "-": this.addToken(TokenType.MINUS, "-"); this.advance(); continue;
        case "*": this.addToken(TokenType.STAR, "*"); this.advance(); continue;
        case "/": this.addToken(TokenType.SLASH, "/"); this.advance(); continue;
        case "%": this.addToken(TokenType.PERCENT, "%"); this.advance(); continue;
        case "^": this.addToken(TokenType.CARET, "^"); this.advance(); continue;
        case "=": this.addToken(TokenType.EQUALS, "="); this.advance(); continue;
        case "<": this.addToken(TokenType.LESS_THAN, "<"); this.advance(); continue;
        case ">": this.addToken(TokenType.GREATER_THAN, ">"); this.advance(); continue;
        case "(": this.addToken(TokenType.LPAREN, "("); this.advance(); continue;
        case ")": this.addToken(TokenType.RPAREN, ")"); this.advance(); continue;
        case "[": this.addToken(TokenType.LBRACKET, "["); this.advance(); continue;
        case "]": this.addToken(TokenType.RBRACKET, "]"); this.advance(); continue;
        case ",": this.addToken(TokenType.COMMA, ","); this.advance(); continue;
        case ":": this.addToken(TokenType.COLON, ":"); this.advance(); continue;
      }

      throw new Error(`Unexpected character '${ch}' at line ${this.line}, column ${this.column}`);
    }

    // Ensure final newline
    if (this.tokens.length > 0 && this.tokens[this.tokens.length - 1].type !== TokenType.NEWLINE) {
      this.tokens.push({ type: TokenType.NEWLINE, value: "\\n", line: this.line, column: this.column });
    }

    this.tokens.push({ type: TokenType.EOF, value: "", line: this.line, column: this.column });
    return this.tokens;
  }

  private advance() {
    this.pos++;
    this.column++;
  }

  private addToken(type: TokenType, value: string) {
    this.tokens.push({ type, value, line: this.line, column: this.column });
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isAlpha(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
  }

  private isAlphaNumeric(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }

  private readNumber() {
    const startCol = this.column;
    const start = this.pos;
    while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
      this.advance();
    }
    if (
      this.pos < this.source.length &&
      this.source[this.pos] === "." &&
      this.pos + 1 < this.source.length &&
      this.isDigit(this.source[this.pos + 1])
    ) {
      this.advance();
      while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
        this.advance();
      }
    }
    this.tokens.push({ type: TokenType.NUMBER, value: this.source.slice(start, this.pos), line: this.line, column: startCol });
  }

  private readString() {
    const startCol = this.column;
    this.advance(); // skip opening "
    let value = "";
    while (this.pos < this.source.length && this.source[this.pos] !== '"') {
      if (this.source[this.pos] === "\\") {
        this.advance();
        switch (this.source[this.pos]) {
          case "n": value += "\\n"; break;
          case "t": value += "\\t"; break;
          case '"': value += '\\"'; break;
          case "\\": value += "\\\\"; break;
          case "0": value += "\\0"; break;
          default: value += this.source[this.pos];
        }
      } else {
        value += this.source[this.pos];
      }
      this.advance();
    }
    if (this.pos >= this.source.length) {
      throw new Error(`Unterminated string at line ${this.line}`);
    }
    this.advance(); // skip closing "
    this.tokens.push({ type: TokenType.STRING, value, line: this.line, column: startCol });
  }

  private readIdentifier() {
    const startCol = this.column;
    const start = this.pos;
    while (this.pos < this.source.length && this.isAlphaNumeric(this.source[this.pos])) {
      this.advance();
    }
    const value = this.source.slice(start, this.pos);
    const type = KEYWORDS[value] || TokenType.IDENTIFIER;
    this.tokens.push({ type, value, line: this.line, column: startCol });
  }
}
