import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { getStackTransitionTypes } from "@/utils/stack-transition";

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export const router = createRouter({
  // Stack navigation through programs, see src/utils/stack-transition.ts.
  defaultViewTransition: {
    types: ({ fromLocation, toLocation }) =>
      getStackTransitionTypes(fromLocation?.pathname, toLocation.pathname),
  },
  history: createMemoryHistory({
    initialEntries: ["/"],
  }),
  routeTree,
});
