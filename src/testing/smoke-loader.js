// Each legacy scenario gets only its own test adapter. Production code never
// imports scenarios back or uses the adapter as application state.
export function createSmokeLoader(importScenario, adapter) {
  let loading;
  return () => loading ||= importScenario().then(module => module.install(adapter));
}

export function registerLazySmokeHook(name, load) {
  const lazy = async (...args) => {
    await load();
    const hook = window[name];
    if (hook === lazy) throw new Error(`Smoke hook was not installed: ${name}`);
    return hook(...args);
  };
  window[name] = lazy;
}
