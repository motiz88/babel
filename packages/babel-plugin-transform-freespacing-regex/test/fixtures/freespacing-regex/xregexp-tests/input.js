{ // should cause ASCII whitespace to be ignored
// NOTE: This literal is '^a\t\n\x0B\f\r b$'
/^a	

 b$/x;
}

{ // should cause Unicode whitespace to be ignored
// NOTE: This literal is '^a\xA0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFFb$'
/^a  ᠎               　﻿b$/x;
}

{ // should cause line comments to be ignored until the next line break
/^a#comment
b
$/x;
}

{ // should cause line comments to be ignored until the end of the string if there is no following line break
/^a#comment b$/x;
}

{ // should allow mixing whitespace and line comments
/^a#comment
b$/x;

/^ a 	
##comment
#
b $ # ignored/x;
}

{ // should apply a following quantifier to the preceding atom
/^a +$/x;
/^a#comment
+$/x;
/^a  #comment
+$/x;

{
// NOTE: we don't support (?#comment) syntax
/*
/^a  (?#comment) #comment
+$/x;
*/
}
}

{ // should separate atoms
/^(a)()()()()()()()()()\1 0$/x;
/^(a)()()()()()()()()()\1#
0$/x;
}

{ // should not add atom separator (?:) at the beginning or end of capturing groups
/( . )/x;
/(#
.#
)/x;
}

{ // should not add atom separator (?:) at the beginning or end of noncapturing groups
/(?: . )/x;
/(?:#
.#
)/x;
}

{ // should not add atom separator (?:) at the beginning or end of lookahead
/(?= . )/x;
/(?! . )/x;
/(?=#
.#
)/x;
/(?!#
.#
)/x;
}

{ // should not add atom separator (?:) at the beginning or end of the pattern
/ ( . ) /x;
/ (#
.#
) /x;
}

{ // should not add atom separator (?:) around |
/( a | b )/x;
/(#
a#
|#
b#
)/x;
}

{ // should allow whitespace between ( and ? for special groups
/( ?:)/x;
/( ?=)/x;
/( ?!)/x;
}

{ // should not apply within character classes
/^ [A #]+ $/x;
}

{
// NOTE: JS doesn't support inline mode modifiers, so this proposal doesn't add them
// /(?x)a b/;
// (?x)^a b$;
}