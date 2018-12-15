{
  // should cause ASCII whitespace to be ignored
  // NOTE: This literal is '^a\t\n\x0B\f\r b$'
  /^a(?:)b$/;
}
{
  // should cause Unicode whitespace to be ignored
  // NOTE: This literal is '^a\xA0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFFb$'
  /^a(?:)᠎(?:)b$/;
}
{
  // should cause line comments to be ignored until the next line break
  /^a(?:)b(?:)$/;
}
{
  // should cause line comments to be ignored until the end of the string if there is no following line break
  /^a/;
}
{
  // should allow mixing whitespace and line comments
  /^a(?:)b$/;
  /^(?:)a(?:)b(?:)$(?:)/;
}
{
  // should apply a following quantifier to the preceding atom
  /^a+$/;
  /^a+$/;
  /^a+$/;
  {// NOTE: we don't support (?#comment) syntax

    /*
    /^a  (?#comment) #comment
    +$/x;
    */
  }
}
{
  // should separate atoms
  /^(a)()()()()()()()()()\1(?:)0$/;
  /^(a)()()()()()()()()()\1(?:)0$/;
}
{
  // should not add atom separator (?:) at the beginning or end of capturing groups
  /(.)/;
  /(.)/;
}
{
  // should not add atom separator (?:) at the beginning or end of noncapturing groups
  /(?:.)/;
  /(?:.)/;
}
{
  // should not add atom separator (?:) at the beginning or end of lookahead
  /(?=.)/;
  /(?!.)/;
  /(?=.)/;
  /(?!.)/;
}
{
  // should not add atom separator (?:) at the beginning or end of the pattern
  /(.)/;
  /(.)/;
}
{
  // should not add atom separator (?:) around |
  /(a|b)/;
  /(a|b)/;
}
{
  // should allow whitespace between ( and ? for special groups
  /(?:)/;
  /(?=)/;
  /(?!)/;
}
{
  // should not apply within character classes
  /^(?:)[A #]+(?:)$/;
}
{// NOTE: JS doesn't support inline mode modifiers, so this proposal doesn't add them
  // /(?x)a b/;
  // (?x)^a b$;
}
