// src/utils/typingEffect.js
/**
 * Simulates a typewriter effect.
 *
 * Accepts an optional `cancelRef` — a React ref ({ current: false }).
 * Set cancelRef.current = true before calling typeText again to abort
 * any in-flight interval, preventing multiple simultaneous typers
 * writing to the same state.
 *
 * @param {string}   text      - The full text to type out
 * @param {number}   speed     - Milliseconds per character
 * @param {function} onTick    - Called with partial text each tick
 * @param {function} onDone    - Called with full text when complete
 * @param {object}   cancelRef - Optional ref: { current: boolean }
 */
export function typeText({ text, speed = 30, onTick, onDone, cancelRef }) {
  return new Promise(resolve => {
    let i = 0;
    const interval = setInterval(() => {
      // If cancelled (e.g. a new response arrived), stop silently
      if (cancelRef?.current) {
        clearInterval(interval);
        resolve('');
        return;
      }

      i++;
      const partial = text.slice(0, i);
      onTick?.(partial);

      if (i >= text.length) {
        clearInterval(interval);
        onDone?.(text);
        resolve(text);
      }
    }, speed);
  });
}