/** How an input of an item (an option button, a gap) looks, and whether it can be used. */

/** Open, toggled on but not yet checked (multi_select), green ✓, red ✗, or greyed out. */
export type InputLook = "idle" | "selected" | "correct" | "wrong" | "dimmed";

export type InputView = { look: InputLook; disabled: boolean };
