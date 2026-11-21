/** How an option button of a choice item looks, and whether it can be clicked. */

/** Open, toggled on but not yet checked (multi_select), green ✓, red ✗, or greyed out. */
export type OptionLook = "idle" | "selected" | "correct" | "wrong" | "dimmed";

export type OptionView = { look: OptionLook; disabled: boolean };
