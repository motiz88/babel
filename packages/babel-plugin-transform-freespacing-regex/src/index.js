import { declare } from "@babel/helper-plugin-utils";
import * as regex from "@babel/helper-regex";
import syntaxFreespacingRegex from "@babel/plugin-syntax-freespacing-regex";
import XRegExp from "xregexp";

function rewriteNewline(ch: string, escaped: boolean = false): string {
  const backslash = escaped ? "" : "\\";
  switch (ch) {
    case "\r":
      return backslash + "r";
    case "\n":
      return backslash + "n";
    case "\u2028":
      return backslash + "u2028";
    case "\u2029":
      return backslash + "u2029";
  }
  return ch;
}

function rewriteNewlines(pattern: string) {
  let result = "";
  let escaped, inClass;
  for (const ch of pattern) {
    result += rewriteNewline(ch, escaped);

    if (escaped) {
      escaped = false;
    } else {
      if (ch === "[") {
        inClass = true;
      } else if (ch === "]" && inClass) {
        inClass = false;
      }
      escaped = ch === "\\";
    }
  }
  return result;
}

function rewritePattern(pattern: string) {
  // FIXME: XRegExp also compiles inline (?#comments) - and possibly other
  // things? - which aren't in the current proposal.
  const compiled = XRegExp(pattern, "x").source;
  return rewriteNewlines(compiled);
}

export default declare(api => {
  api.assertVersion(7);

  return {
    name: "transform-freespacing-regex",
    inherits: syntaxFreespacingRegex,

    visitor: {
      RegExpLiteral(path) {
        const node = path.node;
        if (!regex.is(node, "x")) {
          return;
        }
        try {
          node.pattern = rewritePattern(node.pattern);
        } catch (e) {
          throw path.buildCodeFrameError(e.message);
        }
        regex.pullFlag(node, "x");
      },
    },
  };
});
