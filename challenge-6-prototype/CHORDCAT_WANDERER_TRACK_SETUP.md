# CHORDCAT Hardware Setup Request - Wanderer Prototype

## Current result

The browser-to-CHORDCAT MIDI path is partially working:

| Browser test | Intended role | Current result |
|---|---|---|
| T5 | Geometry pluck / ostinato | **No sound** |
| T6 | Human / legato lead | **Working** |
| T7 | Nature / organic arpeggio | **Working** |
| T8 | Atmosphere / shimmer | **Working** |

The browser automatically disables its own oscillator audio whenever a MIDI output is connected. Therefore, a cell is silent if its assigned CHORDCAT receive track is muted, has volume 0, has no audible preset, or is listening to the wrong USB MIDI channel.

The immediate problem is T5. The browser is already sending geometry motifs on one-based MIDI channel 5.

---

## Required signal routing

Please configure and save the following layout. Track number and USB MIDI channel are separate settings; verify both explicitly.

| CHORDCAT track | USB MIDI channel | Purpose | Local state |
|---:|---:|---|---|
| T1 | 1 | Backing drums / percussion | Audible |
| T2 | 2 | Sixteen-key navigation controller | **Volume 0; MIDI output must remain active** |
| T3 | 3 | Backing bass | Audible |
| T4 | 4 | Backing pad / harmony | Audible |
| T5 | 5 | Geometry pluck / ostinato | Audible, unmuted, receives USB MIDI |
| T6 | 6 | Human / legato lead | Audible, unmuted, receives USB MIDI |
| T7 | 7 | Nature / organic arpeggio | Audible, unmuted, receives USB MIDI |
| T8 | 8 | Atmosphere / shimmer | Audible, unmuted, receives USB MIDI |

Non-negotiable behavior:

```text
T2 touch key chord -> USB MIDI channel 2 -> browser cell recognition
T2 internal chord -> inaudible
Browser motif -> USB MIDI channels 5-8 -> audible CHORDCAT tracks
```

Keep T2 selected during interaction. Keep Record and Overdub disabled so touch navigation and incoming live motifs cannot modify patterns.

---

## Immediate T5 repair

Before building the backing arrangement:

1. Preserve any existing CHORDCAT work.
2. Check the installed firmware; version 1.41 is preferred because it fixes external MIDI input sound behavior.
3. Select T5.
4. In the official Track MIDI Settings, set T5 MIDI IN to **USB channel 5**.
5. Assign an obviously audible melodic preset.
6. Set T5 volume above zero and make sure it is not muted.
7. Leave any T5 pattern empty and keep recording disabled.
8. Return to T2 after making the change.
9. Use the browser facilitator console's T5 button again.
10. Confirm that T6, T7, and T8 still work afterward.

Do not solve T5 by making T2 audible. T2 must remain the silent controller.

If T5 remains silent, record the exact Track MIDI Settings values for T5 and compare them side by side with the working T6 settings. The safest diagnostic is to copy the working T6 receive configuration to T5, changing only the receive channel from 6 to 5.

---

## Wanderer artwork project

Create a saved project for:

```text
Project name: MUSEUM_WANDERER
Artwork: Wanderer above the Sea of Fog
Tempo: 68 BPM
Musical world: B minor
Time signature: 4/4
```

### Backing arrangement

Prepare a restrained, spacious loop on T1, T3, and T4. Suggested four-bar harmony:

```text
| Bm(add9) | Gmaj7 | D/F# | Asus2 |
```

Suggested roles:

- **T1 drums:** sparse kick, soft low percussion, restrained pulse; avoid a busy dance groove.
- **T3 bass:** long B, G, F#, and A foundation notes following the progression.
- **T4 pad:** slow, wide, fog-like harmony with a gentle attack and long release.

The backing should remain coherent by itself. It must continue playing while the browser sends live motif notes to T5-T8.

### Live motif sounds

Do not record fixed melodies on T5-T8. The browser supplies their notes, timing, duration, and velocity live.

| Track | Sound direction | Important behavior |
|---:|---|---|
| T5 | Short, dry, precise pluck | Fast release; repeated notes remain clear |
| T6 | Warm, connected solo/lead | Medium attack; expressive but not overpowering |
| T7 | Organic mallet or soft pluck | Clear arpeggios; moderate release |
| T8 | Airy pad, bell, or shimmer | Long space; restrained high frequencies |

Expected incoming velocity is approximately 48-112. Choose presets that remain audible at lower velocities and do not become painfully loud near the top of that range.

Approximate incoming note areas are:

| Track | Approximate useful range |
|---:|---|
| T5 | G2-E4 |
| T6 | G3-F#5 |
| T7 | E3-D5 |
| T8 | B3-A5 |

These are guidance ranges, not filters. Do not transpose incoming notes unless required by the selected preset.

---

## Silent-controller confirmation

With T2 selected and its internal volume at 0:

1. Press several of the sixteen Chord Cruiser touch keys.
2. Confirm that the browser still recognizes different cells.
3. Confirm that the original multi-note T2 chord is not audible.
4. Confirm that only the generated motif on T5, T6, T7, or T8 is audible.
5. Confirm that the backing on T1, T3, and T4 does not stop or change.
6. Confirm that no track enters Record or Overdub.

Expected result:

```text
Touch input is silent locally
Browser receives the cell identity
One semantic motif track performs
Backing continues unchanged
```

---

## Important multi-artwork limitation

The web app stores a different key and tempo for each painting. CHORDCAT cannot automatically load a different saved hardware project when the artwork selector changes.

For the hackathon, use one of these approaches:

1. **Recommended:** present one hero artwork at a time and manually load its matching saved CHORDCAT project.
2. Prepare two hero projects, for example `MUSEUM_WANDERER` and `MUSEUM_THE_KISS`, and switch both the hardware project and the browser artwork between demonstrations.
3. If freely switching among all paintings, stop the hardware backing and use only the browser-generated T5-T8 motifs until a matching project is loaded.

Do not play a B-minor Wanderer motif over the E-flat-major backing prepared for The Kiss.

---

## Information to return

Please send back:

1. Firmware version.
2. Exact T5 MIDI IN menu path and selected value.
3. Why T5 was silent.
4. Confirmation that T5-T8 all respond to the browser test buttons.
5. T2 volume/mute state and whether USB MIDI still works.
6. Preset names for T5-T8.
7. T1/T3/T4 backing pattern and sound names.
8. Track volumes, pan, envelope, filter, and effect settings.
9. Saved project name.
10. A short repeatable startup procedure.

Use the current official CHORDCAT manual for exact menu names. If the manual and the physical device differ, report what the device actually displays rather than guessing.

