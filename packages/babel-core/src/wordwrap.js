export default function wrap (text, limit) {
  if (text.length > limit) {
    // find the last space within limit
    const edge = text.slice(0, limit).lastIndexOf(" ");
    if (edge > 0) {
      const line = text.slice(0, edge);
      const remainder = text.slice(edge + 1);
      return line + "\n" + wrap(remainder, limit);
    }
  }
  return text;
}
