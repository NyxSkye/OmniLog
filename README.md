# OmniLog

An emergent, multi-genre 3D multiplayer deduction RPG (2–8 players). 

Players awaken as amnesiac blank slates thrust into dimensional breaches. To uncover the ultimate truth of the multiverse and reach the True Ending, teams must balance investigation, dynamic combat, and supply management while discerning factual clues from deceptive System guidance.

---

## Core Gameplay Systems

### 1. Hub Facilities & Safe Zones
Hostile territory is punctuated by fortified non-combat zones that serve as logistical and developmental anchors:

* **Sanctuaries:** Anchored dimensional pockets shielded from corruption.
  * **Rest & Recovery:** Fully restores Health, purges active debuffs, and resets Stamina/Mana pools.
  * **Training Facilities:** Combat ranges to test weapon handling, dial in combo windows, and invest earned Skill Points (SP) into unlocked trait trees.
* **Supply Refill Outposts:**
  * **Armory Outposts:** Restock munitions, patch/repair armor, and install weapon attachments.
  * **Apothecary Outposts:** Acquire health stimulants, stamina infusions, and anomaly cures.
  * **Nexus Terminals:** Purchase artifacts and specialized field equipment using mission currency.

### 2. The Locked Mystery & Magic System
* **Sealed Multiverse Truth:** The nature of the multiverse and the reality of magic are completely masked at game start.
* **Unlockable Arcana:**
  * Magic cannot be chosen during character setup.
  * Unlocked strictly through rare elite drops (**Skill Drops**) or high-tier **System Mission Rewards**.
  * Once acquired, spells consume dedicated mana resources and scale dynamically with a player's evolved Arcane affinity.

### 3. Combat Triad & Dynamic Breaches
Combat is real-time and fluid, combining three distinct disciplines alongside unpredictable environmental hazards:

* **Gunplay:** First/third-person mechanics featuring cover utilization, reload timing, recoil compensation, and ballistic falloff.
* **Melee Combat:** Light/heavy chains, parry windows, stamina-managed dodges, and physical interrupts.
* **Magic (Post-Unlock):** Area-of-effect spells, elemental strikes, defensive wards, and hotkey-bound utility abilities.
* **Monster Waves:**
  * Unscheduled dimensional breaches emerge outside Safe Zones.
  * Waves test resource management, team positioning, and threat prioritization.
  * Successful defenses yield rare crafting materials, gear drops, and arcane skill books.

### 4. Player Progression & Case Scoring
* **Blank Slate Evolution:** All players begin with identical foundational stats. Characters naturally diverge based on in-game actions:
  * **Dynamic Traits:** Frontline tanking, tactical overwatch, stealth reconnaissance, or aggressive gunplay passively unlocks tailored character perks over time.
  * **Contribution-Based SP:** Skill Points are earned through investigative rigor (locating anomalies, pressing NPCs, exposing deceptive System hints) as well as combat efficacy.
* **Specialization:** Allocate SP at Sanctuary Training Facilities across Physical, Tactical, and Arcane skill trees.

### 5. Memory Log, NPC Interaction & The True Ending
* **Observation & Memory Log:** Inspect environmental anomalies, document leads, and cross-reference entries against System directives (which may actively mislead the team).
* **Key NPC Interrogations:** Present concrete physical evidence to designated world NPCs to expose Definitive Clues.
* **Single True Ending:** Deductions must be verified via immutable Memory Log facts. Misinterpreting evidence or falling for corrupted System guidance triggers a False Ending and immediate case failure.

---

## System Architecture

| Component | Specification |
| :--- | :--- |
| **Platform** | Desktop 3D Multiplayer (2–8 players, Room Code matchmaking) |
| **Initial State** | Amnesiac Agent (Zero magic, base attributes, empty grid inventory) |
| **Safe Zones** | Sanctuaries (HP recovery, SP allocation) & Outpost vendors |
| **Combat Model** | Real-time FPS/TPS: Firearms + Melee + Unlockable Arcana + Wave Breaches |
| **Investigation** | 3D Environmental Inspection, Memory Log, Key NPC Evidence Exchanges |
| **Resolution** | Single True Ending via deduction; failure on false accusations |

---

## Project Roadmap

- [ ] **Phase 1: Foundations** — Core player controller (movement, weapon handling, melee traces) & network lobby (room code generation).
- [ ] **Phase 2: Environment & Hubs** — Safe Zone boundary logic, vendor menus, and practice dummy damage-calc targets.
- [ ] **Phase 3: The Triad & Breaches** — Wave spawning director, breach events, and magic unlock triggers.
- [ ] **Phase 4: Case Logic & Memory Log** — Interactive clue inspection, notebook data persistence, and deceptive System injection.
- [ ] **Phase 5: Case Resolution** — NPC evidence verification pipelines and True/False ending validation trees.
