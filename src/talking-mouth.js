// A temporary mouth layer. Restore before animation/expression updates, then
// apply after them; the authored expression and motion data are never changed.
const mouthAliases = [['aa', 'a'], ['ih', 'i'], ['ou', 'u'], ['ee', 'e'], ['oh', 'o']];
export function createTalkingMouth(manager, random = Math.random) {
  const available = manager?.expressions?.map(e => e.expressionName) || [];
  const names = mouthAliases.map(aliases => aliases.map(alias => available.find(name => name.toLowerCase() === alias)).find(Boolean)).filter(Boolean);
  const controlled=available.filter(name=>mouthAliases.flat().includes(name.toLowerCase()));
  if (!names.length) return null;
  let running = false, baseline = null, remaining = 0, pause = 0, phase = 0, amplitude = 0;
  let selected = 0, previous = -1, target = names.map(() => 0), values = names.map(() => 0);
  function restore() {
    manager?.setTalkingMouthWeights?.(null);
    if (!baseline) return;
    controlled.forEach((name, i) => manager.setValue(name, baseline[i])); baseline = null;
  }
  return {
    start() { restore(); running = true; remaining = 0; pause = 0; phase = 0; previous = -1; values.fill(0); },
    letter(char) {
      if (!running) return;
      const duration = /[。！？!?\n\r…]/u.test(char) ? 0.23 : /[，、；：,;:]/u.test(char) ? 0.12 : /\s/u.test(char) ? 0.045 : 0;
      if (duration) pause = Math.max(pause, duration);
    },
    restore,
    update(delta) {
      if (!running) return;
      restore();
      const dt = Math.max(0, Math.min(delta, 0.1));
      pause = Math.max(0, pause - dt); remaining -= dt;
      if (remaining <= 0) {
        selected = Math.min(names.length - 1, Math.floor(random() * names.length));
        if (names.length > 1 && selected === previous) selected = (selected + 1) % names.length;
        previous = selected; amplitude = random() < 0.18 ? 0 : 0.32 + random() * 0.34;
        remaining = 0.12 + random() * 0.12; phase = 0;
      }
      phase += dt;
      const pulse = Math.sin(Math.min(1, phase / 0.19) * Math.PI);
      target = names.map((_, i) => pause > 0 || i !== selected ? 0 : amplitude * Math.max(0.2, pulse));
      const blend = 1 - Math.exp(-24 * dt);
      values = values.map((value, i) => value + (target[i] - value) * blend);
      baseline = controlled.map(name => manager.getValue(name) || 0);
      controlled.forEach(name=>manager.setValue(name,0));
      names.forEach((name, i) => manager.setValue(name, values[i]));
      manager.setTalkingMouthWeights?.(Object.fromEntries(names.map((name,i)=>[name,values[i]])));
    },
    stop() { restore(); running = false; values.fill(0); pause = 0; },
    diagnostics() { return { running, names: [...names], values: [...values], pause }; }
  };
}
