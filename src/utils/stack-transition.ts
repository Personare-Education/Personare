/**
 * React Navigation's stack, on the web: going a level deeper in the
 * programs stack (Programs -> Program -> Module) is a push, going back up
 * is a pop. The calendar opens a program as a push too. Anything else
 * (sidebar jumps, settings, same level) does not animate. The types drive
 * the CSS in src/styles/global.css through `:active-view-transition-type()`.
 */
export type StackTransitionType = "stack-push" | "stack-pop";

const STACK_ROUTES: [RegExp, number][] = [
  [/^\/$/, 0],
  [/^\/programs\/[^/]+\/?$/, 1],
  [/^\/programs\/[^/]+\/modules\/[^/]+\/?$/, 2],
];

function getStackDepth(pathname: string): number | undefined {
  return STACK_ROUTES.find(([pattern]) => pattern.test(pathname))?.[1];
}

export function getStackTransitionTypes(
  fromPathname: string | undefined,
  toPathname: string
): StackTransitionType[] | false {
  if (fromPathname === undefined) {
    return false;
  }

  const toDepth = getStackDepth(toPathname);
  if (toDepth === undefined) {
    return false;
  }

  const fromDepth = getStackDepth(fromPathname);
  if (fromDepth === undefined) {
    return fromPathname === "/calendar" && toDepth > 0 ? ["stack-push"] : false;
  }

  if (toDepth > fromDepth) {
    return ["stack-push"];
  }
  if (toDepth < fromDepth) {
    return ["stack-pop"];
  }
  return false;
}
