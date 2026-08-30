import { EquipmentSlot } from "@minecraft/server";
import { LocalizationKeys } from "../../localization/LocalizationKeys.js";

/**
 * HeldItemValidator.js
 *
 * PURPOSE
 *   Confirms the player still holds the exact rail item their BuildRequest
 *   was created for. Re-reads the live held item via the current,
 *   non-deprecated `minecraft:equippable` component rather than trusting
 *   whatever was true when the menu opened — necessary because the
 *   ModalFormData round trip is async and the player can swap items while
 *   it's open.
 *
 * DEPENDENCIES
 *   - @minecraft/server (EquipmentSlot)
 *   - localization/LocalizationKeys.js
 */

export class HeldItemValidator {
  constructor() {
    this.name = "HeldItemValidator";
  }

  /**
   * @param {import("../BuildRequest.js").BuildRequest} request
   * @returns {import("./ValidationManager.js").ValidationResult}
   */
  validate(request) {
    const equippable = request.player.getComponent("minecraft:equippable");
    const heldItem = equippable?.getEquipment(EquipmentSlot.Mainhand);
    if (!heldItem || heldItem.typeId !== request.railTypeId) {
      return {
        valid: false,
        reason: "ITEM_CHANGED",
        localizationKey: LocalizationKeys.VALIDATION_ITEM_CHANGED,
      };
    }
    return { valid: true };
  }
}
