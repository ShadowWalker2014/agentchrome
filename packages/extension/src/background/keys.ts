// Key definitions for CDP Input.dispatchKeyEvent (subset of the US layout used by Puppeteer).

export interface KeyDef {
  key: string;
  code: string;
  keyCode: number;
  text?: string;
  location?: number;
}

const defs: Record<string, KeyDef> = {};
const add = (names: string[], d: KeyDef) => names.forEach((n) => (defs[n.toLowerCase()] = d));

add(["enter", "return"], { key: "Enter", code: "Enter", keyCode: 13, text: "\r" });
add(["tab"], { key: "Tab", code: "Tab", keyCode: 9 });
add(["backspace"], { key: "Backspace", code: "Backspace", keyCode: 8 });
add(["delete", "del"], { key: "Delete", code: "Delete", keyCode: 46 });
add(["escape", "esc"], { key: "Escape", code: "Escape", keyCode: 27 });
add(["space", " "], { key: " ", code: "Space", keyCode: 32, text: " " });
add(["arrowup", "up"], { key: "ArrowUp", code: "ArrowUp", keyCode: 38 });
add(["arrowdown", "down"], { key: "ArrowDown", code: "ArrowDown", keyCode: 40 });
add(["arrowleft", "left"], { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 });
add(["arrowright", "right"], { key: "ArrowRight", code: "ArrowRight", keyCode: 39 });
add(["home"], { key: "Home", code: "Home", keyCode: 36 });
add(["end"], { key: "End", code: "End", keyCode: 35 });
add(["pageup"], { key: "PageUp", code: "PageUp", keyCode: 33 });
add(["pagedown"], { key: "PageDown", code: "PageDown", keyCode: 34 });
add(["insert"], { key: "Insert", code: "Insert", keyCode: 45 });
add(["shift"], { key: "Shift", code: "ShiftLeft", keyCode: 16, location: 1 });
add(["control", "ctrl"], { key: "Control", code: "ControlLeft", keyCode: 17, location: 1 });
add(["alt", "option"], { key: "Alt", code: "AltLeft", keyCode: 18, location: 1 });
add(["meta", "cmd", "command", "super", "win"], { key: "Meta", code: "MetaLeft", keyCode: 91, location: 1 });
for (let i = 1; i <= 12; i++) add([`f${i}`], { key: `F${i}`, code: `F${i}`, keyCode: 111 + i });
for (let c = 0; c < 26; c++) {
  const lower = String.fromCharCode(97 + c);
  add([lower], { key: lower, code: `Key${lower.toUpperCase()}`, keyCode: 65 + c, text: lower });
}
for (let d = 0; d <= 9; d++) add([String(d)], { key: String(d), code: `Digit${d}`, keyCode: 48 + d, text: String(d) });
const punct: [string, string, number][] = [
  ["-", "Minus", 189], ["=", "Equal", 187], ["[", "BracketLeft", 219], ["]", "BracketRight", 221],
  ["\\", "Backslash", 220], [";", "Semicolon", 186], ["'", "Quote", 222], [",", "Comma", 188],
  [".", "Period", 190], ["/", "Slash", 191], ["`", "Backquote", 192],
];
for (const [k, code, kc] of punct) add([k], { key: k, code, keyCode: kc, text: k });

export const MOD = { alt: 1, ctrl: 2, meta: 4, shift: 8 } as const;

export function modifierBits(mods: string[]): number {
  let bits = 0;
  for (const m of mods.map((x) => x.toLowerCase())) {
    if (m === "alt" || m === "option") bits |= MOD.alt;
    else if (m === "ctrl" || m === "control") bits |= MOD.ctrl;
    else if (m === "cmd" || m === "meta" || m === "command" || m === "super" || m === "win") bits |= MOD.meta;
    else if (m === "shift") bits |= MOD.shift;
  }
  return bits;
}

const isModifier = (k: string) => ["shift", "ctrl", "control", "alt", "option", "cmd", "meta", "command", "super", "win"].includes(k.toLowerCase());

export interface ParsedCombo {
  modifiers: string[];
  key: KeyDef;
}

/** Parse "cmd+shift+t" or "Enter" or "a". */
export function parseCombo(combo: string): ParsedCombo {
  const parts = combo === "+" ? ["+"] : combo.split("+").filter(Boolean);
  const keyName = parts.pop() ?? "";
  const modifiers = parts.filter(isModifier);
  let key = defs[keyName.toLowerCase()];
  if (!key) {
    if (keyName.length === 1) key = { key: keyName, code: "", keyCode: keyName.toUpperCase().charCodeAt(0), text: keyName };
    else throw new Error(`Unknown key "${keyName}"`);
  }
  if (keyName.length === 1 && keyName !== keyName.toLowerCase() && key.text) {
    key = { ...key, key: keyName, text: keyName };
    if (!modifiers.includes("shift")) modifiers.push("shift");
  }
  return { modifiers, key };
}

/** Editing commands the renderer only performs when told explicitly (synthetic cmd/ctrl shortcuts). */
export function editingCommands(mods: number, key: string): string[] {
  const primary = (mods & MOD.meta) || (mods & MOD.ctrl);
  if (!primary) return [];
  const k = key.toLowerCase();
  const shift = mods & MOD.shift;
  if (k === "a") return ["selectAll"];
  if (k === "c") return ["copy"];
  if (k === "x") return ["cut"];
  if (k === "v") return ["paste"];
  if (k === "z") return [shift ? "redo" : "undo"];
  if (k === "y") return ["redo"];
  return [];
}
