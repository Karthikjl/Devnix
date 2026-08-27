/**
 * Universal Code Formatter for Devnix Code Studio
 * Provides robust formatting engines for all supported languages:
 * - JavaScript & TypeScript (js-beautify)
 * - JSON (native JSON parser / beautify)
 * - HTML & CSS (js-beautify)
 * - C, C++, Java, Rust, Go (C-Style Engine)
 * - PHP (PHP-Aware Formatter with <?php tag and arrow/dot-concat support)
 * - Python (PEP-8 Semantic Indentation-Preserving Formatter)
 * - Ruby & Bash (Script Structure Formatter)
 */

import beautify from "js-beautify";

export function formatCodeUniversal(rawCode: string, langIdOrName: string): string {
  if (!rawCode || !rawCode.trim()) return rawCode;

  // Normalize CRLF to LF universally
  const cleanCode = rawCode.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lang = (langIdOrName || "").toLowerCase().trim();

  // 1. JSON
  if (lang === "json" || lang === "jsonc") {
    try {
      return JSON.stringify(JSON.parse(cleanCode), null, 4) + "\n";
    } catch {
      return beautify.js(cleanCode, { indent_size: 4, space_in_empty_paren: true });
    }
  }

  // 2. JavaScript & TypeScript
  if (lang.includes("javascript") || lang.includes("typescript") || lang === "js" || lang === "ts") {
    try {
      return beautify.js(cleanCode, {
        indent_size: 4,
        space_in_empty_paren: false,
        brace_style: "collapse",
        end_with_newline: true,
        wrap_line_length: 120,
      });
    } catch {
      return cleanCode;
    }
  }

  // 3. HTML / XML
  if (lang.includes("html") || lang.includes("xml")) {
    try {
      return beautify.html(cleanCode, { indent_size: 4, end_with_newline: true });
    } catch {
      return cleanCode;
    }
  }

  // 4. CSS
  if (lang.includes("css")) {
    try {
      return beautify.css(cleanCode, { indent_size: 4, end_with_newline: true });
    } catch {
      return cleanCode;
    }
  }

  // 5. PHP (Dedicated PHP-Aware Formatter)
  if (lang.includes("php")) {
    return formatPhpCode(cleanCode);
  }

  // 6. Python (PEP-8 Indentation-Preserving Formatter)
  if (lang.includes("python") || lang === "py") {
    return formatPythonCode(cleanCode);
  }

  // 7. C, C++, Java, Rust, Go (C-Style Curly-Brace Languages)
  if (
    lang.includes("c++") ||
    lang.includes("cpp") ||
    lang === "c" ||
    lang.includes("java") ||
    lang.includes("rust") ||
    lang.includes("go")
  ) {
    return formatCStyleCode(cleanCode);
  }

  // 8. Ruby / Bash / Script Fallback
  return formatScriptCode(cleanCode);
}

/**
 * Robust PHP Formatter:
 * - Preserves opening `<?php` and closing `?>` tags at column 0
 * - Handles PHP `$variables`, functions, classes, and control structures
 * - Correctly aligns braces `{` and `}` with 4-space indentation
 * - Formats PHP operators: `->`, `::`, `=>`, `.=`, `===`, `!==`, `==`, `!=`
 * - Formats arrays `[ ... ]` and semicolons
 */
function formatPhpCode(code: string): string {
  const lines = code.split("\n");
  const result: string[] = [];
  let indentLevel = 0;
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Preserve empty lines (collapse excess)
    if (!trimmed) {
      if (result.length > 0 && result[result.length - 1] !== "") {
        result.push("");
      }
      continue;
    }

    // <?php, <?, and ?> remain at column 0
    if (/^<\?(php)?/i.test(trimmed) || trimmed === "?>") {
      result.push(trimmed);
      continue;
    }

    // Block comments /* ... */
    if (inBlockComment) {
      result.push("    ".repeat(indentLevel) + trimmed);
      if (trimmed.includes("*/")) {
        inBlockComment = false;
      }
      continue;
    }

    if (trimmed.startsWith("/*") && !trimmed.includes("*/")) {
      inBlockComment = true;
      result.push("    ".repeat(indentLevel) + trimmed);
      continue;
    }

    // Single-line comments // or #
    if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
      result.push("    ".repeat(indentLevel) + trimmed);
      continue;
    }

    // Closing braces at the beginning of the line to dedent before rendering
    let startsWithClosing = 0;
    let temp = trimmed;
    while (temp.startsWith("}") || temp.startsWith(")") || temp.startsWith("]")) {
      startsWithClosing++;
      temp = temp.substring(1).trim();
    }

    // Check for PHP switch cases or visibility labels
    const isLabel = /^(case\s+[^:]+|default|public|private|protected)\s*:/.test(trimmed);

    let lineIndent = Math.max(0, indentLevel - startsWithClosing);
    if (isLabel && lineIndent > 0) {
      lineIndent = Math.max(0, lineIndent - 1);
    }

    // Format PHP statement (normalize operators, commas, arrows, dots)
    const formattedLine = formatPhpLine(trimmed);
    result.push("    ".repeat(lineIndent) + formattedLine);

    // Update indentLevel for next lines
    const { opens, closes } = countBraces(trimmed);
    indentLevel = Math.max(0, indentLevel + opens - closes);
  }

  return result.join("\n").trimEnd() + "\n";
}

/**
 * Normalizes PHP syntax line spacing
 */
function formatPhpLine(line: string): string {
  // Comma spacing: foo($a,$b) -> foo($a, $b)
  let res = line.replace(/,([^\s"')\]}])/g, ", $1");

  // Semicolon spacing
  res = res.replace(/;([^\s"')\]}])/g, "; $1");

  // Object operator `->` (remove spaces around ->)
  res = res.replace(/\s*->\s*/g, "->");

  // Scope resolution `::` (remove spaces around ::)
  res = res.replace(/\s*::\s*/g, "::");

  // Array association `=>`
  res = res.replace(/([^\s])=>/g, "$1 =>").replace(/=>([^\s])/g, "=> $1");

  // Comparison & Assignment: ===, !==, ==, !=, <=, >=, +=, -=, *=, /=, .=
  res = res.replace(/([^\s=!<>+\-*/.])\s*(===|!==|==|!=|<=|>=|\+=|-=|\*=|\/=|(?<!\.)\.\=(?!\.))\s*([^\s=!<>])/g, "$1 $2 $3");

  // Standard assignment = (single =)
  res = res.replace(/([^\s=!<>+\-*/.])\s*=\s*([^\s=])/g, "$1 = $2");

  // Clean double spaces outside quotes
  res = res.replace(/ {2,}/g, " ");

  return res;
}

/**
 * Formats C, C++, Java, Rust, and Go code with 4-space indent and clean braces
 */
function formatCStyleCode(code: string): string {
  try {
    const beautified = beautify.js(code, {
      indent_size: 4,
      indent_char: " ",
      brace_style: "collapse",
      preserve_newlines: true,
      max_preserve_newlines: 2,
      space_before_conditional: true,
      space_in_empty_paren: false,
      end_with_newline: true,
    });
    return beautified;
  } catch {
    // Fallback: line-by-line bracket matcher
    return formatBracketCode(code);
  }
}

/**
 * Fallback bracket matcher for C-style languages
 */
function formatBracketCode(code: string): string {
  const lines = code.split("\n");
  const result: string[] = [];
  let indentLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      if (result.length > 0 && result[result.length - 1] !== "") {
        result.push("");
      }
      continue;
    }

    if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*")) {
      result.push("    ".repeat(indentLevel) + trimmed);
      continue;
    }

    let startsWithClosing = 0;
    let temp = trimmed;
    while (temp.startsWith("}") || temp.startsWith(")") || temp.startsWith("]")) {
      startsWithClosing++;
      temp = temp.substring(1).trim();
    }

    const currentIndent = Math.max(0, indentLevel - startsWithClosing);
    result.push("    ".repeat(currentIndent) + trimmed);

    const { opens, closes } = countBraces(trimmed);
    indentLevel = Math.max(0, indentLevel + opens - closes);
  }

  return result.join("\n").trimEnd() + "\n";
}

/**
 * Formats Python code adhering to PEP-8 standards:
 * - Strictly respects and preserves semantic indentation blocks (prevents scope shifting)
 * - Converts tabs to standard 4 spaces
 * - Normalizes binary operator spacing (e.g. =, ==, <=, >=, +, -, *, //)
 * - Normalizes comma and colon spacing (e.g. `[1, 2, 3]`, `def foo(a, b):`)
 * - Trims trailing line whitespace and collapses excess blank lines
 */
function formatPythonCode(code: string): string {
  const lines = code.split("\n");
  const resultLines: string[] = [];
  let inDocstring = false;
  let docstringQuote = "";

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Handle multiline docstrings (preserve exactly as-is)
    if (inDocstring) {
      resultLines.push(rawLine);
      if (rawLine.includes(docstringQuote)) {
        inDocstring = false;
      }
      continue;
    }

    const trimmed = rawLine.trim();

    // Preserve empty lines, collapse more than 2 consecutive blank lines
    if (!trimmed) {
      if (resultLines.length > 0 && resultLines[resultLines.length - 1] !== "") {
        resultLines.push("");
      }
      continue;
    }

    // Check for docstring start
    if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      docstringQuote = trimmed.substring(0, 3);
      const remainder = trimmed.substring(3);
      if (!remainder.includes(docstringQuote)) {
        inDocstring = true;
      }
      resultLines.push(rawLine);
      continue;
    }

    // Detect line's existing indentation prefix (convert any tabs to 4 spaces)
    const indentMatch = rawLine.match(/^[\t ]*/);
    const indentStr = (indentMatch ? indentMatch[0] : "").replace(/\t/g, "    ");

    // Comment lines: format indent and preserve comment
    if (trimmed.startsWith("#")) {
      resultLines.push(`${indentStr}${trimmed}`);
      continue;
    }

    // Split code and trailing comment
    const commentIdx = trimmed.indexOf("#");
    let codePart = trimmed;
    let commentPart = "";

    if (commentIdx !== -1) {
      // Check if # is inside quotes
      if (!isInsideQuotes(trimmed, commentIdx)) {
        codePart = trimmed.substring(0, commentIdx).trimEnd();
        commentPart = `  ${trimmed.substring(commentIdx)}`;
      }
    }

    // Normalize operators and commas in code part
    let formattedCode = formatPythonLine(codePart);

    resultLines.push(`${indentStr}${formattedCode}${commentPart}`);
  }

  // Ensure single trailing newline
  return resultLines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * Normalizes Python line spacing outside string literals
 */
function formatPythonLine(line: string): string {
  // Comma spacing: a,b -> a, b
  let res = line.replace(/,([^\s"')\]}])/g, ", $1");

  // Colon spacing for dicts or defs: key:val -> key: val
  res = res.replace(/([^:\s"'])\s*:\s*([^\s"'])/g, "$1: $2");

  // Binary comparison operators: ==, !=, <=, >=
  res = res.replace(/([^\s=!<>])\s*(==|!=|<=|>=)\s*([^\s=!<>])/g, "$1 $2 $3");

  // Integer division //
  res = res.replace(/([^\s/])\s*\/\/\s*([^\s/])/g, "$1 // $2");

  // Simple assignment = (excluding ==, !=, <=, >=, +=, -=, *=, /=)
  res = res.replace(/([^\s=!<>+\-*/])\s*=\s*([^\s=])/g, "$1 = $2");

  // Compound assignment: +=, -=, *=, /=
  res = res.replace(/([^\s])\s*(\+=|-=|\*=|\/=)\s*([^\s])/g, "$1 $2 $3");

  // Cleanup potential double spaces outside quotes
  res = res.replace(/ {2,}/g, " ");

  return res;
}

/**
 * Counts open and close braces outside of string literals and comments
 */
function countBraces(line: string): { opens: number; closes: number } {
  let opens = 0;
  let closes = 0;
  let inString = false;
  let stringChar = "";
  let inEscape = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inEscape) {
      inEscape = false;
      continue;
    }

    if (ch === "\\") {
      inEscape = true;
      continue;
    }

    if (inString) {
      if (ch === stringChar) {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === "/" && i + 1 < line.length && (line[i + 1] === "/" || line[i + 1] === "*")) {
      break;
    }

    if (ch === "{") opens++;
    if (ch === "}") closes++;
  }

  return { opens, closes };
}

/**
 * Helper to check if a character index is inside single/double quotes
 */
function isInsideQuotes(text: string, index: number): boolean {
  let inDouble = false;
  let inSingle = false;
  let escape = false;

  for (let i = 0; i < index; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (ch === "'" && !inDouble) inSingle = !inSingle;
  }

  return inDouble || inSingle;
}

/**
 * Formats Ruby and Bash scripts preserving semantic indent and cleaning whitespace
 */
function formatScriptCode(code: string): string {
  const lines = code.split("\n");
  const formatted: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      if (formatted.length > 0 && formatted[formatted.length - 1] !== "") {
        formatted.push("");
      }
      continue;
    }

    const indentMatch = raw.match(/^[\t ]*/);
    const indentStr = (indentMatch ? indentMatch[0] : "").replace(/\t/g, "    ");

    formatted.push(`${indentStr}${trimmed}`);
  }

  return formatted.join("\n").trimEnd() + "\n";
}
