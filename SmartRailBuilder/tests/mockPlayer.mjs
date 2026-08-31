/**
 * mockPlayer.mjs
 *
 * PURPOSE
 *   Added Project Prompt 19, alongside the new `node_modules/@minecraft/server`
 *   mock (see that package's own header) — together these unlock testing the
 *   EXECUTION-side classes that Project Prompt 18's harness couldn't reach
 *   (every class that reads/writes a live Player's inventory or game mode).
 *   A minimal, in-memory `Player` + inventory `Container` matching exactly
 *   the surface `inventory/InventoryManager.js` and
 *   `core/validation/HeldItemValidator.js` actually call — confirmed by
 *   reading both files directly, not guessed.
 */

class MockContainer {
  constructor(slotCount = 36) {
    this.size = slotCount;
    this._slots = new Array(slotCount).fill(undefined);
  }

  getItem(slot) {
    return this._slots[slot];
  }

  /** Real Container.setItem(slot) with no second argument clears the slot. */
  setItem(slot, item) {
    this._slots[slot] = item;
  }

  /** TEST-ONLY convenience, not part of the real API: put an item stack in the first empty slot. */
  addItem(typeId, amount) {
    const emptySlot = this._slots.findIndex((s) => s === undefined);
    if (emptySlot === -1) throw new Error("MockContainer: no empty slot (test setup error).");
    this._slots[emptySlot] = { typeId, amount };
  }
}

export function createMockPlayer({ id, name = id, gameMode = "Survival", heldItemTypeId, items = [] } = {}) {
  const container = new MockContainer();
  for (const { typeId, amount } of items) {
    container.addItem(typeId, amount);
  }

  let currentGameMode = gameMode;

  return {
    id,
    name,
    location: { x: 0, y: 64, z: 0 },
    getRotation() {
      return { x: 0, y: 0 };
    },
    getGameMode() {
      return currentGameMode;
    },
    /** TEST-ONLY convenience: simulate a mid-build Survival<->Creative switch. */
    setGameMode(mode) {
      currentGameMode = mode;
    },
    getComponent(componentId) {
      if (componentId === "minecraft:inventory") {
        return { container };
      }
      if (componentId === "minecraft:equippable") {
        return {
          getEquipment() {
            return heldItemTypeId ? { typeId: heldItemTypeId } : undefined;
          },
        };
      }
      return undefined;
    },
  };
}
