"use client";

import { useSyncExternalStore } from "react";

// Never fires: "has this hydrated yet" changes exactly once, and React
// already re-renders at that moment.
const subscribe = () => () => {};

/**
 * False during the server render and the first client render, true after
 * hydration. Use it to gate anything that reads browser-only state
 * (localStorage-backed stores, `window`) so the server and client agree on
 * the first paint.
 *
 * The usual way to write this is `useState(false)` plus a `useEffect` that
 * sets it to true, but that sets state synchronously inside an effect, which
 * schedules a second render pass before the browser paints — the cascading
 * render `react-hooks/set-state-in-effect` warns about. useSyncExternalStore
 * says the same thing declaratively: one snapshot on the server, another on
 * the client, and React reconciles them itself.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
