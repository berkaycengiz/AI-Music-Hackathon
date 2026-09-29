import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/midi/ChordcatInput.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { ChordcatInput } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const storageKey = 'museum-sonic-explorer.chordcat-calibration.v1';
const padChords = [
  [53, 56, 60], [53, 56, 60, 63], [53, 57, 60], [53, 57, 60, 63],
  [53, 57, 60, 63, 67], [55, 58, 62], [55, 58, 62, 65], [56, 59, 63],
  [56, 60, 63], [56, 60, 63, 67], [57, 60, 63], [57, 60, 63, 67],
  [57, 60, 64], [58, 61, 65], [58, 62, 65], [59, 62, 66],
];

function setupBrowser() {
  const values = new Map();
  globalThis.window = {
    setTimeout,
    clearTimeout,
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  };
  return values;
}

async function pressChord(input, channel, notes) {
  for (const note of notes) {
    input.onmidimessage({ data: Uint8Array.of(0x90 | channel, note, 100) });
  }
  await new Promise((resolve) => setTimeout(resolve, 30));
  for (const note of notes) {
    input.onmidimessage({ data: Uint8Array.of(0x80 | channel, note, 0) });
  }
}

test('calibrates all sixteen triad and chord pads on MIDI Channel 6', async () => {
  const storage = setupBrowser();
  const bridge = new ChordcatInput();
  const input = { name: 'Chordcat 0', onmidimessage: null };
  bridge.connect(input);
  bridge.beginFullCalibration();

  for (const chord of padChords) await pressChord(input, 5, chord);

  assert.equal(bridge.state.status, 'ready-custom');
  assert.equal(bridge.state.inputChannel, 6);
  assert.equal(JSON.parse(storage.get(storageKey)).channel, 5);
  const selected = [];
  bridge.onCell = (cell) => selected.push(cell);
  await pressChord(input, 1, padChords[0]);
  assert.deepEqual(selected, []);
  await pressChord(input, 5, padChords[0]);
  assert.deepEqual(selected, [1]);

  const restored = new ChordcatInput();
  const restoredInput = { name: 'Chordcat 0', onmidimessage: null };
  restored.connect(restoredInput);
  assert.equal(restored.state.inputChannel, 6);
  let restoredCell = null;
  restored.onCell = (cell) => { restoredCell = cell; };
  await pressChord(restoredInput, 5, padChords[15]);
  assert.equal(restoredCell, 16);
});

test('loads the earlier Channel 2 calibration profile', async () => {
  const storage = setupBrowser();
  const earlierSignatures = padChords.map((notes, index) => notes.length < 4
    ? [...notes, 80 + index]
    : notes);
  storage.set(storageKey, JSON.stringify({ version: 1, signatures: earlierSignatures }));
  const bridge = new ChordcatInput();
  const input = { name: 'Chordcat 0', onmidimessage: null };
  bridge.connect(input);
  assert.equal(bridge.state.inputChannel, 2);

  let selected = null;
  bridge.onCell = (cell) => { selected = cell; };
  await pressChord(input, 5, earlierSignatures[0]);
  assert.equal(selected, null);
  await pressChord(input, 1, earlierSignatures[0]);
  assert.equal(selected, 1);
});
