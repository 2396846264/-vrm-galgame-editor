// A temporary eyelid layer. Restore before the mixer/expressions, apply after.
// Each actor owns a clock, so a cast does not blink in unison.
const key = name => name.normalize('NFKC').toLowerCase().replace(/[\s_-]/g, '');
export function createAutoBlink(manager, random = Math.random) {
  const available = manager?.expressions?.map(e => e.expressionName) || [];
  const find = aliases => aliases.map(alias => available.find(name => key(name) === key(alias))).find(Boolean);
  const both = find(['blink', 'まばたき', '瞬き', '眨眼', '闭眼', '閉眼']);
  const left = find(['blinkLeft', 'ウィンク', 'ウィンク2']);
  const right = find(['blinkRight', 'ウィンク右', 'ウィンク2右']);
  const names = both ? [both] : left && right ? [left, right] : [];
  if (!names.length) return null;
  const nextInterval = () => 6 + random() * 6;
  let remaining = nextInterval(), phase = -1, baseline = null, applied = null, weight = 0, count = 0;
  function restore() {
    manager.setAutoBlinkWeight?.(0);
    if (baseline) names.forEach((name, i) => {
      // A new expression may have arrived between rendered frames.
      if (Math.abs(manager.getValue(name) - applied[i]) < 1e-7) manager.setValue(name, baseline[i]);
    });
    baseline = applied = null;
  }
  return {
    restore,
    reset() { restore(); phase=-1; weight=0; remaining=nextInterval(); },
    update(delta, permit = () => true) {
      restore();
      const dt = Number.isFinite(delta) ? Math.max(0, Math.min(delta, .1)) : 0;
      weight = 0;
      const authored = manager.getAuthoredBlinkWeight ? manager.getAuthoredBlinkWeight() > .02 : available.some(name => /blink|まばたき|瞬き|ウィンク|眨眼|闭眼|閉眼/i.test(name) && manager.getValue(name) > .02);
      if (authored) { phase = -1; remaining = nextInterval(); return; }
      if (phase < 0) {
        remaining -= dt;
        if (remaining <= 0) {
          if (!permit()) { remaining = .2 + random() * .8; return; }
          phase = 0; count++;
        }
      }
      if (phase >= 0) {
        phase += dt;
        // Close quickly, briefly hold shut, then open a little more slowly.
        const smooth = t => t * t * (3 - 2 * t);
        weight = phase < .07 ? smooth(phase / .07) : phase < .10 ? 1 : phase < .22 ? 1 - smooth((phase - .10) / .12) : 0;
        if (phase >= .22) { phase = -1; remaining = nextInterval(); }
      }
      if (manager.setAutoBlinkWeight) { manager.setAutoBlinkWeight(weight); return; }
      // Authored blinks/winks take priority; never reset a deliberate closed eye.
      if (!weight) return;
      baseline = names.map(name => manager.getValue(name) || 0);
      applied = names.map(() => weight);
      names.forEach((name, i) => manager.setValue(name, applied[i]));
    },
    diagnostics() { return { names: [...names], weight, count, remaining }; }
  };
}
