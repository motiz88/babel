import Module from "module";
import path from "path";
import validateNpmName from "validate-npm-package-name";
import startsWith from "lodash/startsWith";

let relativeModules = {};

export default function resolve (loc: string, relative: string = process.cwd()): ?string {
  // we're in the browser, probably
  if (typeof Module === "object") return null;

  let relativeMod = relativeModules[relative];

  if (!relativeMod) {
    relativeMod = new Module;

    // We need to define an id and filename on our "fake" relative` module so that
    // Node knows what "." means in the case of us trying to resolve a plugin
    // such as "./myPlugins/somePlugin.js". If we don't specify id and filename here,
    // Node presumes "." is process.cwd(), not our relative path.
    // Since this fake module is never "loaded", we don't have to worry about mutating
    // any global Node module cache state here.
    let filename = path.join(relative, ".babelrc");
    relativeMod.id = filename;
    relativeMod.filename = filename;

    relativeMod.paths = Module._nodeModulePaths(relative);
    relativeModules[relative] = relativeMod;
  }

  try {
    return Module._resolveFilename(loc, relativeMod);
  } catch (err) {
    return null;
  }
}

export function resolveAll (loc: string, prefix: string, relative: string = process.cwd()): ?string {
  let resolved;

  let expanded = expandShorthand(loc, prefix);
  if (expanded !== loc) {
    resolved = resolve(expanded, relative);
  }

  resolved = resolved || resolve(loc, relative);

  if (!resolved) {
    expanded = expandOrg(loc, prefix);
    if (expanded !== loc) {
      resolved = resolve(expanded, relative);
    }
  }
  return resolved;
}

export function expandAll (loc: string, prefix: string): string {
  let expanded = expandShorthand(loc, prefix);
  if (expanded !== loc) return expanded;
  return expandOrg(loc, prefix) || loc;
}

function expandShorthand (loc: string, prefix: string): string {
  const prefix_ = prefix + "-";
  if (!startsWith(loc, prefix_)) {
    const expandedShortLoc = prefix_ + loc;
    if (validateNpmName(expandedShortLoc).validForOldPackages) {
      return expandedShortLoc;
    }
  }
  return loc;
}

function expandOrg (loc: string, prefix: string): string {
  // try to resolve @organization shortcut
  // @foo/es2015 -> @foo/babel-preset-es2015
  const prefix_ = prefix + "-";
  if (loc[0] === "@") {
    const matches = loc.match(/^(@[^/]+)\/(.+)$/);
    if (matches) {
      const [, orgName, subPath] = matches;
      if (!startsWith(subPath, prefix_)) {
        loc = `${orgName}/${prefix_}${subPath}`;
      }
    }
  }
  return loc;
}
