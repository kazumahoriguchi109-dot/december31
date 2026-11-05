# Evolution rebuild contract (working, independent prototype)
Preserve: December 31, two elementary-school childhood friends, no combat/death/time pressure/precision jumps, six puzzle purposes, both return home. Latest user supersedes old fixed-anchor/command-list defaults. No main/push/deploy.

Direct control: WASD/arrows walk, Shift run after first evolution, E/Space context action, T partner command after E1, Q quarter-turn camera after E2, R resonance after E3 (visual proximity/connection cue; never auto-solve), Esc pause. Dialogue stops simulation. DOM alternatives remain available for context and accessibility but no destination menu.

World goes north (-Z), x bounds[-12,12], z[-65,8]. Ground height shared heightAt. Areas: entrance/P01 z0..-10; waterworks z-10..-24; cooperative gate z-24..-40; white wall/stair z-43..-49; observatory upper plateau z-49..-65. World has scenery-defined boundaries and walkable floors. Water band z[-24,-22] blocked except bridge x[-2,2] after P02. P01 gate across z-10 until solved. P03 fence across z-35 except central opening when player/Toto plate occupancy or latched. Upper cliff at z-49 can only traverse broad x[6.5,10.5] stair after wallSeen. Return follows the existing stair, gate and bridge route; there is no shortcut in this build.

P01: approach tile E rotates. Reach connected state1 => E1, colours/flow/partner instruction; Shift run and T cooperate become available. Teach by world feedback, no answer in title/objective.
P02: physically approach drain/stopper E toggles; drain closed and stopper released lowers bridge. P03: physically stand on gate plate to see gate open; T at plate places Toto there. Walk gate, E latch, T call; meet beyond gate => E2 and Q rotates actual camera. Calling before latch on far side cannot strand player.
P04: approach white wall, Q side view reveals depth. E observes (wallSeen) then walk broad stair; reaching top solves. No teleport, no precision jumps. Controls/label don't reveal stair before observation.
P05: physical A/B levers cycle three discrete stops via E. Observation station E enters exact optical camera. Correct ringA1/ringB2 observed => E3. 3D arc geometry must preserve original ratios and real depth. E exits observe, controls explain how. E3 resonance reveals paired signs, not answer sequence.
P06: return to original frame; back area unlocks after E3. T hold one plate, walk around frame and occupy other -> permanently open. T reunite then E frame -> both return to room, ending + credits.

Model owns movement, collision, events, puzzle logic and availability, mutating state only through its functions. UI owns dialogue queues, pause/settings/title/persistence/audio. Renderer is non-authoritative and must derive all plates/gates/rings from state. Default moving inputs are camera-relative handled by model based on quarter. State save uses new version2 and separate key, never loads legacy saves. No old save migration yet. All conclusions about feel/fun require actual user play.

## Cycle 002 — first instrument readability
The visible P01 plinth is a 3.2m square with a collision footprint of ±1.8m. Its crank is operated only from the east standing point `MAP.tileControl` (2.6, -5.5), within1.1m. The route visibly curves around the plinth. Nearby early-era Toto walks to the player's east side rather than standing behind their sprite. The game names the handle in the objective and interaction text. Returning in3D, the camera gently raises near the instrument to keep its circuit visible at every quarter turn. No extra puzzle unlock, location, or progression requirement was added.

The reduced-motion preference now updates UI styling immediately as well as renderer behavior and storage. Cycle001 preview4195 remains immutable. Cycle002 uses its own clone, development5196 and frozen candidate4196. Because origins differ, their saves are independent; no automatic save migration occurs.

## Cycle 003 — readable acting and conversation
Two original actor presentations now share wardrobe cues across pixel and3D eras. Conversation passes an explicit speaker and expression to the renderer/UI; only the speaker gestures, while the listener remains calm. Presentation facing turns toward the other child or the device without changing collision/movement state.

Physical device actions use a transient750ms gesture, committing the model once at450ms. Movement/new actions remain locked until the gesture ends. Reduced motion uses180/100ms and meaningful static poses. Escape before commit cancels the pending operation; after commit it preserves the changed state. These presentation cues are not saved. Returning home clears old world notifications.

P02 uses foreground controls `drainControl=(-6,-14)` and `stopperControl=(-3,-14)`, linked visibly to the original mechanisms. Interaction radius is.8m and the approach stays south of z=-14.5. The mill, channel and handle supports have occupied footprints. The marked approach crosses at z=-13 and branches toward the controls. P02 solution conditions are unchanged. Nearby floating markers retreat to keep faces/gestures visible.

Conversation typography and portraits are larger; paper and wardrobe colors identify the speaker. Reduced height and text enlargement were checked, but this does not replace real-device browser zoom or first-time human playtesting. Exact finger/handle contact, spoken audio and human listening quality are not claimed.

## Cycle 004 — reveal, discovery and companion movement
The first world uses a grayscale CSS filter on the game canvas; the room and UI retain color. E1 restores color over700ms (immediately for reduced motion). The underlying game mechanics also evolve: running and partner instructions become available at E1. On evolution the compact upper notification appears while the world is visible for1400ms (300ms reduced motion), then queued dialogue is shown. Inputs cannot skip an unseen line.

Toto walks toward the requested footprint. Physical occupancy determines whether a gate opens; `waiting` becomes true only at the footprint centre. If the player occupies the centre, Toto waits short of it and the UI asks for space. A second T cancels the request; a save while walking retains the destination and reconstructs a safe path. Version3 has separate localStorage keys and deliberately neither reads nor migrates prior version2 saves/settings.

P01/P02 handles and allowed approach regions are offset to reduce sprite overlap. Objectives describe destinations rather than giving the device solution. Contextual interaction labels remain available near objects. These changes do not establish human first-time usability or listening quality.
