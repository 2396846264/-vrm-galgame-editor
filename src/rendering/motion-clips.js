import * as THREE from 'three';

export function motionFrameInfo(clip) {
  if (!clip) return { fps: 30, frames: 0 };
  const intervals = [];
  for (const track of clip.tracks) {
    const times = track.times;
    for (let index = 1; index < Math.min(times.length, 12); index++) {
      const interval = times[index] - times[index - 1];
      if (interval > 0.001 && interval < 0.2) intervals.push(interval);
    }
    if (intervals.length > 100) break;
  }
  intervals.sort((a, b) => a - b);
  const measured = intervals.length
    ? Math.round(1 / intervals[Math.floor(intervals.length / 2)])
    : 30;
  const fps = measured >= 12 && measured <= 120 ? measured : 30;
  return { fps, frames: Math.max(1, Math.round(clip.duration * fps) + 1) };
}

export function boundedMotionOffset(x, z, radius = 0.45) {
  const distance = Math.hypot(x, z);
  if (!Number.isFinite(distance) || distance <= radius) return [0, 0];
  const correction = 1 - radius / distance;
  return [-x * correction, -z * correction];
}

export function motionSegment(clip, settings, cache) {
  const { fps, frames } = motionFrameInfo(clip);
  const start = Math.min(settings.startFrame, frames);
  const end = Math.max(start, Math.min(settings.endFrame || frames, frames));
  if (start === 1 && end === frames) return { clip, start, end, fps, frames };
  const key = `${clip.uuid}:${start}:${end}:${fps}`;
  if (cache.has(key)) return { clip: cache.get(key), start, end, fps, frames };
  const startTime = Math.min(clip.duration, (start - 1) / fps);
  const singleFrame = start === end;
  const endTime = singleFrame ? startTime : Math.min(clip.duration, (end - 1) / fps);
  const duration = singleFrame ? 1 / fps : Math.max(1 / fps, endTime - startTime);
  const tracks = clip.tracks.map((track) => {
    const size = track.getValueSize();
    const interpolant = track.createInterpolant();
    const times = [0];
    const values = Array.from(interpolant.evaluate(startTime));
    for (let index = 0; index < track.times.length; index++) {
      const time = track.times[index];
      if (singleFrame || time <= startTime + 1e-7 || time >= endTime - 1e-7) continue;
      times.push(time - startTime);
      for (let component = 0; component < size; component++)
        values.push(track.values[index * size + component]);
    }
    times.push(duration);
    values.push(...interpolant.evaluate(endTime));
    const part = track.clone();
    part.times = new track.times.constructor(times);
    part.values = new track.values.constructor(values);
    return part;
  });
  const segment = new THREE.AnimationClip(`${clip.name} ${start}-${end}`, duration, tracks);
  cache.set(key, segment);
  return { clip: segment, start, end, fps, frames };
}
