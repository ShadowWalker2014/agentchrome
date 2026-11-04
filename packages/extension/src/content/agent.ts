// Injected on demand into the isolated world of a tab. Globals persist for the lifetime of the page,
// so element refs stay stable between calls until the page navigates.

type Rect = { x: number; y: number; width: number; height: number };

interface AcmApi {
  run(name: string, args: any): any;
}

declare global {
  interface Window {
    __acm?: AcmApi;
  }
}

(() => {
  if (window.__acm) return;

  // ---------------- refs ----------------
  let nextRef = 1;
  const refToEl = new Map<string, WeakRef<Element>>();
  const elToRef = new WeakMap<Element, string>();
  const refOf = (el: Element) => {
    let r = elToRef.get(el);
    if (!r) {
      r = `ref_${nextRef++}`;
      elToRef.set(el, r);
      refToEl.set(r, new WeakRef(el));
    }
    return r;
  };
  const elOf = (ref: string): Element => {
    const el = refToEl.get(ref)?.deref();
    if (!el || !el.isConnected) throw new Error(`Element ${ref} is gone (the page changed). Call read_page or find again.`);
    return el;
  };

  // ---------------- roles and names ----------------
  const INPUT_ROLES: Record<string, string> = {
    button: "button", submit: "button", reset: "button", image: "button", checkbox: "checkbox", radio: "radio",
    range: "slider", number: "spinbutton", search: "searchbox", email: "textbox", tel: "textbox", text: "textbox",
    url: "textbox", password: "textbox", date: "textbox", "datetime-local": "textbox", month: "textbox", time: "textbox",
    week: "textbox", color: "button", file: "button",
  };
  const TAG_ROLES: Record<string, string> = {
    button: "button", select: "combobox", textarea: "textbox", img: "img", svg: "img", h1: "heading", h2: "heading",
    h3: "heading", h4: "heading", h5: "heading", h6: "heading", nav: "navigation", main: "main", header: "banner",
    footer: "contentinfo", aside: "complementary", form: "form", table: "table", tr: "row", td: "cell", th: "columnheader",
    ul: "list", ol: "list", li: "listitem", dialog: "dialog", summary: "button", details: "group", option: "option",
    iframe: "iframe", label: "label", fieldset: "group", legend: "legend", article: "article", section: "region",
    p: "paragraph", video: "video", audio: "audio", canvas: "canvas", hr: "separator", progress: "progressbar",
    meter: "meter", menu: "list", dl: "list", dt: "term", dd: "definition", code: "code", pre: "code", blockquote: "blockquote",
  };
  const INTERACTIVE = new Set([
    "button", "link", "textbox", "searchbox", "checkbox", "radio", "combobox", "listbox", "slider", "spinbutton", "switch",
    "tab", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "treeitem",
  ]);

  function roleOf(el: Element): string {
    const explicit = el.getAttribute("role");
    if (explicit) return explicit.split(" ")[0]!;
    const tag = el.tagName.toLowerCase();
    if (tag === "a") return (el as HTMLAnchorElement).hasAttribute("href") ? "link" : "generic";
    if (tag === "input") return INPUT_ROLES[(el as HTMLInputElement).type] ?? "textbox";
    if (tag === "section" && !(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby"))) return "generic";
    if ((el as HTMLElement).isContentEditable && el.getAttribute("contenteditable") !== null) return "textbox";
    return TAG_ROLES[tag] ?? "generic";
  }

  const clean = (s: string | null | undefined, max = 100) => {
    const t = (s ?? "").replace(/\s+/g, " ").trim();
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
  };

  function nameOf(el: Element, role: string): string {
    const aria = el.getAttribute("aria-label");
    if (aria) return clean(aria);
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const t = by.split(/\s+/).map((id) => el.ownerDocument.getElementById(id)?.textContent ?? "").join(" ");
      if (t.trim()) return clean(t);
    }
    const tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") {
      const id = el.id;
      if (id) {
        const lab = el.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (lab?.textContent?.trim()) return clean(lab.textContent);
      }
      const wrap = el.closest("label");
      if (wrap?.textContent?.trim()) return clean(wrap.textContent);
      const inp = el as HTMLInputElement;
      if (["button", "submit", "reset"].includes(inp.type) && inp.value) return clean(inp.value);
      return clean(el.getAttribute("placeholder") || el.getAttribute("title") || el.getAttribute("name") || "");
    }
    if (tag === "img") return clean(el.getAttribute("alt") || el.getAttribute("title") || "");
    if (tag === "svg") return clean(el.querySelector("title")?.textContent || "");
    if (tag === "iframe") return clean(el.getAttribute("title") || el.getAttribute("src") || "");
    if (["button", "link", "heading", "tab", "menuitem", "option", "listitem", "cell", "columnheader", "label", "legend", "paragraph", "term", "definition", "code", "blockquote", "checkbox", "radio", "switch", "treeitem"].includes(role)) {
      return clean((el as HTMLElement).innerText ?? el.textContent, role === "paragraph" ? 300 : 100) || clean(el.getAttribute("title"));
    }
    return clean(el.getAttribute("title") || "");
  }

  function isHidden(el: Element): boolean {
    if (el.getAttribute("aria-hidden") === "true") return true;
    const he = el as HTMLElement;
    if (he.hidden) return true;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") return true;
    if (cs.opacity === "0" && !INTERACTIVE.has(roleOf(el))) return true;
    return false;
  }

  function rectOf(el: Element): Rect {
    const r = el.getBoundingClientRect();
    let x = r.left;
    let y = r.top;
    // Map same-origin iframe coordinates to the top viewport.
    let w: Window | null = el.ownerDocument.defaultView;
    while (w && w !== window && w.frameElement) {
      const fr = w.frameElement.getBoundingClientRect();
      x += fr.left;
      y += fr.top;
      w = w.parent;
    }
    return { x, y, width: r.width, height: r.height };
  }

  const inViewport = (r: Rect) => r.width > 0 && r.height > 0 && r.x + r.width > 0 && r.y + r.height > 0 && r.x < innerWidth && r.y < innerHeight;

  function describe(el: Element, role: string, name: string): string {
    const bits: string[] = [role];
    if (name) bits.push(JSON.stringify(name));
    bits.push(`[${refOf(el)}]`);
    const tag = el.tagName.toLowerCase();
    if (role === "heading") bits.push(`level=${tag.match(/h(\d)/)?.[1] ?? el.getAttribute("aria-level") ?? ""}`);
    if (tag === "a" && (el as HTMLAnchorElement).href) {
      const href = el.getAttribute("href")!;
      bits.push(`href=${JSON.stringify(href.length > 120 ? `${href.slice(0, 119)}…` : href)}`);
    }
    if (tag === "input" || tag === "textarea") {
      const inp = el as HTMLInputElement;
      if (inp.type === "checkbox" || inp.type === "radio") bits.push(inp.checked ? "checked" : "unchecked");
      else if (inp.type === "password") bits.push(inp.value ? 'value="••••"' : "empty");
      else if (inp.type !== "button" && inp.type !== "submit") bits.push(`value=${JSON.stringify(clean(inp.value, 200))}`);
      if (inp.placeholder && !name.includes(inp.placeholder)) bits.push(`placeholder=${JSON.stringify(clean(inp.placeholder))}`);
      if (inp.type && !["text", "textarea"].includes(inp.type)) bits.push(`type=${inp.type}`);
    }
    if (tag === "select") {
      const sel = el as HTMLSelectElement;
      bits.push(`value=${JSON.stringify(clean(sel.selectedOptions[0]?.text ?? ""))}`);
      bits.push(`options=${JSON.stringify([...sel.options].slice(0, 25).map((o) => clean(o.text, 40)))}`);
    }
    const ariaChecked = el.getAttribute("aria-checked");
    if (ariaChecked) bits.push(`checked=${ariaChecked}`);
    const expanded = el.getAttribute("aria-expanded");
    if (expanded) bits.push(`expanded=${expanded}`);
    const selected = el.getAttribute("aria-selected");
    if (selected === "true") bits.push("selected");
    if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") bits.push("disabled");
    if (el === el.ownerDocument.activeElement) bits.push("focused");
    return bits.join(" ");
  }

  function* childrenOf(el: Element | ShadowRoot | Document): Generator<Element> {
    const host = el as Element;
    if ((host as any).shadowRoot) yield* Array.from((host as any).shadowRoot.children as HTMLCollection);
    if (host.tagName === "IFRAME") {
      try {
        const doc = (host as HTMLIFrameElement).contentDocument;
        if (doc?.body) yield doc.body;
      } catch {}
    }
    if (host.tagName === "SLOT") {
      yield* (host as HTMLSlotElement).assignedElements();
      return;
    }
    yield* Array.from(el.children);
  }

  function readPage(args: { filter?: string; depth?: number; ref_id?: string; max_chars?: number; viewportOnly?: boolean }) {
    const interactiveOnly = args.filter === "interactive";
    const maxDepth = args.depth ?? 25;
    const maxChars = args.max_chars ?? 50_000;
    const root = args.ref_id ? elOf(args.ref_id) : document.body;
    const lines: string[] = [];
    let chars = 0;
    let truncated = false;

    const walk = (el: Element, depth: number) => {
      if (truncated) return;
      if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "HEAD", "META", "LINK"].includes(el.tagName)) return;
      if (el.id === "__acm_overlay_host") return;
      if (isHidden(el)) return;
      const role = roleOf(el);
      let shown = false;
      if (role !== "generic") {
        const name = nameOf(el, role);
        const interesting = interactiveOnly
          ? INTERACTIVE.has(role) || (el as HTMLElement).onclick !== null || el.getAttribute("tabindex") === "0"
          : !(role === "listitem" && !name) && !(["paragraph", "label", "img"].includes(role) && !name);
        if (interesting) {
          const r = rectOf(el);
          if (!args.viewportOnly || inViewport(r)) {
            const line = `${"  ".repeat(Math.min(depth, maxDepth))}- ${describe(el, role, name)}`;
            if (chars + line.length > maxChars) {
              truncated = true;
              return;
            }
            lines.push(line);
            chars += line.length + 1;
            shown = true;
          }
        }
        // Leaf-like roles already include their text.
        if (["button", "link", "heading", "option", "paragraph", "label", "code", "checkbox", "radio"].includes(role) && shown) return;
      } else if (!interactiveOnly && el.children.length === 0) {
        const t = clean((el as HTMLElement).innerText ?? el.textContent, 200);
        if (t && (!args.viewportOnly || inViewport(rectOf(el)))) {
          const line = `${"  ".repeat(Math.min(depth, maxDepth))}- text ${JSON.stringify(t)}`;
          if (chars + line.length > maxChars) {
            truncated = true;
            return;
          }
          lines.push(line);
          chars += line.length + 1;
        }
        return;
      } else if (!interactiveOnly && el.children.length > 0) {
        // Direct text inside a generic container with element children.
        for (const n of Array.from(el.childNodes)) {
          if (n.nodeType === 3) {
            const t = clean(n.textContent, 200);
            if (t) {
              lines.push(`${"  ".repeat(Math.min(depth, maxDepth))}- text ${JSON.stringify(t)}`);
              chars += t.length + 12;
            }
          }
        }
      }
      if (depth >= maxDepth) return;
      for (const c of childrenOf(el)) walk(c, shown ? depth + 1 : depth);
    };
    walk(root, 0);
    const header = `Page: ${document.title}\nURL: ${location.href}\nViewport: ${innerWidth}x${innerHeight}, scrolled to (${Math.round(scrollX)}, ${Math.round(scrollY)}) of ${document.documentElement.scrollWidth}x${document.documentElement.scrollHeight}\n`;
    return header + lines.join("\n") + (truncated ? `\n… output truncated at ${maxChars} chars. Use ref_id to read a subtree, filter="interactive", or viewportOnly.` : "");
  }

  // ---------------- find ----------------
  const ROLE_WORDS: Record<string, string[]> = {
    button: ["button", "btn"], link: ["link", "anchor"], textbox: ["input", "field", "textbox", "box", "text", "textarea"],
    searchbox: ["search", "input", "field", "box"], checkbox: ["checkbox", "check", "toggle"], radio: ["radio", "option"],
    combobox: ["select", "dropdown", "combobox", "menu"], heading: ["heading", "title", "header"], img: ["image", "img", "picture", "logo", "icon"],
    tab: ["tab"], menuitem: ["menu", "item"], switch: ["switch", "toggle"],
  };

  function find(args: { query: string; limit?: number }) {
    const q = args.query.toLowerCase();
    const tokens = q.split(/[^a-z0-9@._-]+/).filter((t) => t.length > 1 && !["the", "a", "an", "of", "on", "in", "to", "for", "and", "with", "that", "this"].includes(t));
    const results: { el: Element; score: number; role: string; name: string }[] = [];
    const visit = (el: Element) => {
      if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName) || el.id === "__acm_overlay_host") return;
      if (isHidden(el)) return;
      const role = roleOf(el);
      if (role !== "generic" || (el.children.length === 0 && (el.textContent ?? "").trim())) {
        const name = nameOf(el, role) || clean((el as HTMLElement).innerText, 100);
        const hay = [
          name, el.getAttribute("placeholder"), el.getAttribute("aria-label"), el.getAttribute("title"), el.getAttribute("name"),
          el.id, el.getAttribute("type"), el.getAttribute("alt"), typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className : "",
          el.getAttribute("data-testid"),
        ].filter(Boolean).join(" ").toLowerCase();
        let score = 0;
        if (name && name.toLowerCase() === q) score += 12;
        if (name && q.includes(name.toLowerCase()) && name.length > 2) score += 4;
        for (const t of tokens) {
          if (hay.includes(t)) score += name.toLowerCase().includes(t) ? 3 : 1.5;
          if ((ROLE_WORDS[role] ?? []).includes(t)) score += 2.5;
        }
        if (INTERACTIVE.has(role)) score += 0.5;
        if (score > 0) results.push({ el, score, role, name });
      }
      for (const c of childrenOf(el)) visit(c);
    };
    visit(document.body);
    results.sort((a, b) => b.score - a.score);
    // Drop ancestors that only matched through their descendants' text.
    const picked: typeof results = [];
    for (const r of results) {
      if (picked.length >= (args.limit ?? 20)) break;
      if (picked.some((p) => p.el.contains(r.el) && p.score >= r.score && p.role === "generic")) continue;
      picked.push(r);
    }
    return picked.map((r) => ({ ref: refOf(r.el), role: r.role, name: r.name, rect: rectOf(r.el), score: Math.round(r.score * 10) / 10 }));
  }

  // ---------------- interaction helpers ----------------
  function scrollIntoViewIfNeeded(el: Element) {
    const r = rectOf(el);
    if (!inViewport(r) || r.y < 0 || r.y + r.height > innerHeight) el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" as ScrollBehavior });
  }

  function refRect(args: { ref: string; scroll?: boolean }) {
    const el = elOf(args.ref);
    if (args.scroll !== false) scrollIntoViewIfNeeded(el);
    const r = rectOf(el);
    return { ...r, cx: r.x + r.width / 2, cy: r.y + r.height / 2, tag: el.tagName.toLowerCase() };
  }

  const setNative = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  };

  function formInput(args: { ref: string; value: string | number | boolean }) {
    const el = elOf(args.ref) as HTMLElement;
    scrollIntoViewIfNeeded(el);
    el.focus?.();
    const fire = (type: string) => el.dispatchEvent(new Event(type, { bubbles: true }));
    if (el instanceof HTMLSelectElement) {
      const v = String(args.value);
      const opt = [...el.options].find((o) => o.value === v) ?? [...el.options].find((o) => o.text.trim().toLowerCase() === v.toLowerCase()) ?? [...el.options].find((o) => o.text.toLowerCase().includes(v.toLowerCase()));
      if (!opt) throw new Error(`No option matching "${v}". Options: ${[...el.options].map((o) => o.text.trim()).join(", ")}`);
      el.value = opt.value;
      fire("input");
      fire("change");
      return `Selected "${opt.text.trim()}"`;
    }
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      const want = typeof args.value === "boolean" ? args.value : !["false", "0", "off", "no", ""].includes(String(args.value).toLowerCase());
      if (el.checked !== want) el.click();
      return `${el.type} is now ${el.checked ? "checked" : "unchecked"}`;
    }
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      setNative(el, String(args.value));
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(args.value) }));
      fire("change");
      return `Set value to ${JSON.stringify(String(args.value))}`;
    }
    if (el.isContentEditable) {
      el.textContent = String(args.value);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(args.value) }));
      return "Set text content";
    }
    const role = el.getAttribute("role");
    if (role === "checkbox" || role === "switch") {
      const want = Boolean(args.value) && String(args.value) !== "false";
      if ((el.getAttribute("aria-checked") === "true") !== want) el.click();
      return `${role} toggled`;
    }
    throw new Error(`${el.tagName.toLowerCase()} is not a form control. Use computer type instead.`);
  }

  function pageText(args: { max_chars?: number }) {
    const max = args.max_chars ?? 50_000;
    const candidates = ["article", "main", "[role=main]", "#content", ".content", "body"];
    let best: HTMLElement = document.body;
    for (const sel of candidates) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el && (el.innerText?.length ?? 0) > 200) {
        best = el;
        break;
      }
    }
    let text = (best.innerText ?? "").replace(/\n{3,}/g, "\n\n").trim();
    const truncated = text.length > max;
    if (truncated) text = text.slice(0, max);
    return `Title: ${document.title}\nURL: ${location.href}\n\n${text}${truncated ? `\n… truncated at ${max} chars` : ""}`;
  }

  async function waitFor(args: { text?: string; textGone?: string; selector?: string; timeoutMs?: number }) {
    const deadline = Date.now() + Math.min(args.timeoutMs ?? 10_000, 60_000);
    const check = () => {
      const body = document.body?.innerText ?? "";
      if (args.text && !body.includes(args.text)) return false;
      if (args.textGone && body.includes(args.textGone)) return false;
      if (args.selector && !document.querySelector(args.selector)) return false;
      return true;
    };
    while (Date.now() < deadline) {
      if (check()) return { ok: true };
      await new Promise((r) => setTimeout(r, 150));
    }
    return { ok: check() };
  }

  const b64ToFile = (f: { name: string; mimeType?: string; base64: string }) => {
    const bin = atob(f.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], f.name, { type: f.mimeType || "application/octet-stream" });
  };

  function setFiles(args: { ref?: string; x?: number; y?: number; files: { name: string; mimeType?: string; base64: string }[] }) {
    const dt = new DataTransfer();
    for (const f of args.files) dt.items.add(b64ToFile(f));
    if (args.ref) {
      const el = elOf(args.ref);
      if (el instanceof HTMLInputElement && el.type === "file") {
        el.files = dt.files;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return `Attached ${args.files.length} file(s) to the file input`;
      }
      const inner = el.querySelector('input[type="file"]') as HTMLInputElement | null;
      if (inner) {
        inner.files = dt.files;
        inner.dispatchEvent(new Event("change", { bubbles: true }));
        return `Attached ${args.files.length} file(s) to the file input inside ${args.ref}`;
      }
      return dropOn(el, dt, rectOf(el).x + 5, rectOf(el).y + 5);
    }
    const target = document.elementFromPoint(args.x ?? 0, args.y ?? 0);
    if (!target) throw new Error("Nothing at that coordinate to drop on");
    return dropOn(target, dt, args.x ?? 0, args.y ?? 0);
  }

  function dropOn(el: Element, dt: DataTransfer, x: number, y: number) {
    for (const type of ["dragenter", "dragover", "drop"]) {
      el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
    }
    return `Dropped ${dt.files.length} file(s) on ${el.tagName.toLowerCase()}`;
  }

  // ---------------- overlay: pulsing border + status pill ----------------
  let host: HTMLDivElement | null = null;
  let shadow: ShadowRoot | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let recTimer: ReturnType<typeof setInterval> | undefined;

  function ensureOverlay() {
    if (host?.isConnected) return shadow!;
    host = document.createElement("div");
    host.id = "__acm_overlay_host";
    host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
    // macOS rounds the bottom corners of browser windows; follow them so the border is not clipped.
    if (/Mac/i.test(navigator.platform) && Math.abs(window.outerHeight - screen.height) > 2) host.style.setProperty("--acm-r", "0 0 18px 18px");
    shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `<style>
      :host{all:initial}
      .frame{position:fixed;inset:0;pointer-events:none;opacity:0;transition:opacity .4s cubic-bezier(.2,.8,.2,1)}
      .frame.on{opacity:1}
      .frame::before{content:"";position:absolute;inset:0;border:5px solid #2F6BFF;border-radius:var(--acm-r,0)}
      .frame::after{content:"";position:absolute;inset:0;border-radius:var(--acm-r,0);box-shadow:inset 0 0 0 5px rgba(47,107,255,.35),inset 0 0 28px 8px rgba(47,107,255,.55),inset 0 0 110px 16px rgba(47,107,255,.2);animation:breathe 2.2s ease-in-out infinite}
      @keyframes breathe{0%,100%{opacity:.45}50%{opacity:1}}
      .pill{position:fixed;left:50%;bottom:20px;transform:translate(-50%,10px) scale(.98);display:flex;align-items:center;gap:10px;height:36px;padding:0 5px 0 14px;border-radius:999px;
        background:rgba(14,14,16,.88);color:#FAFAFA;font:500 13px/1 "Inter","SF Pro Text",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:-.01em;
        box-shadow:0 0 0 1px rgba(255,255,255,.09),0 1px 0 0 rgba(255,255,255,.06) inset,0 12px 32px -8px rgba(0,0,0,.55);
        backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%);
        pointer-events:auto;opacity:0;transition:opacity .3s cubic-bezier(.2,.8,.2,1),transform .3s cubic-bezier(.2,.8,.2,1)}
      .pill.on{opacity:1;transform:translate(-50%,0) scale(1)}
      .dot{position:relative;width:7px;height:7px;border-radius:50%;background:#2F6BFF}
      .dot::after{content:"";position:absolute;inset:-4px;border-radius:50%;background:rgba(47,107,255,.35);animation:halo 1.6s ease-out infinite}
      .rec .dot{background:#FF453A}.rec .dot::after{background:rgba(255,69,58,.35)}
      .paused .dot{background:#A1A1AA}.paused .dot::after{animation:none;opacity:0}
      @keyframes halo{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.8);opacity:0}}
      .rec-time{font-variant-numeric:tabular-nums;color:#A1A1AA;font-size:12px}
      .rec-time:empty{display:none}
      button{all:unset;cursor:pointer;height:26px;padding:0 11px;border-radius:999px;background:rgba(255,255,255,.08);color:#FAFAFA;font-weight:500;font-size:12px;display:inline-flex;align-items:center;
        box-shadow:0 0 0 1px rgba(255,255,255,.08) inset;transition:background .15s}
      button:hover{background:rgba(255,255,255,.16)}
      .ripple{position:fixed;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:2px solid #2F6BFF;background:rgba(47,107,255,.18);pointer-events:none;animation:rip .55s cubic-bezier(.2,.8,.2,1) forwards}
      @keyframes rip{from{transform:scale(.4);opacity:1}to{transform:scale(1.7);opacity:0}}
    </style><div class="frame"></div><div class="pill"><span class="dot"></span><span class="label"></span><span class="rec-time"></span><button class="stop">Stop</button></div>`;
    shadow.querySelector(".stop")!.addEventListener("click", (e) => {
      e.stopPropagation();
      const paused = shadow!.querySelector(".pill")!.classList.contains("paused");
      chrome.runtime.sendMessage({ type: paused ? "acm:resume" : "acm:stop" });
    });
    (document.documentElement ?? document.body).appendChild(host);
    return shadow;
  }

  function overlay(args: { state: "working" | "idle" | "hidden" | "paused"; label?: string; rec?: { since: number } | null; linger?: number }) {
    const sh = ensureOverlay();
    const frame = sh.querySelector(".frame")!;
    const pill = sh.querySelector(".pill")!;
    const label = sh.querySelector(".label")!;
    const btn = sh.querySelector(".stop") as HTMLButtonElement;
    const recTime = sh.querySelector(".rec-time") as HTMLSpanElement;
    clearTimeout(hideTimer);
    if (recTimer) clearInterval(recTimer);
    recTime.textContent = "";
    pill.classList.toggle("rec", Boolean(args.rec));
    pill.classList.toggle("paused", args.state === "paused");
    if (args.rec) {
      const since = args.rec.since;
      const tick = () => {
        const s = Math.floor((Date.now() - since) / 1000);
        recTime.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
      };
      tick();
      recTimer = setInterval(tick, 1000);
    }
    if (args.state === "hidden") {
      frame.classList.remove("on");
      pill.classList.remove("on");
      return true;
    }
    label.textContent = args.label ?? "Agent is working";
    btn.textContent = args.state === "paused" ? "Resume" : "Stop";
    if (args.state === "working" || args.state === "paused") {
      frame.classList.toggle("on", args.state === "working");
      pill.classList.add("on");
    } else {
      // idle: fade the border, keep the pill while recording
      hideTimer = setTimeout(() => {
        frame.classList.remove("on");
        if (!args.rec) pill.classList.remove("on");
      }, args.linger ?? 1500);
    }
    return true;
  }

  function setOverlayVisible(args: { visible: boolean }) {
    if (host) host.style.visibility = args.visible ? "visible" : "hidden";
    return true;
  }

  function ripple(args: { x: number; y: number }) {
    const sh = ensureOverlay();
    const r = document.createElement("div");
    r.className = "ripple";
    r.style.left = `${args.x}px`;
    r.style.top = `${args.y}px`;
    sh.appendChild(r);
    setTimeout(() => r.remove(), 700);
    return true;
  }

  function viewport() {
    return { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, scrollX, scrollY, url: location.href, title: document.title };
  }

  function elementAt(args: { x: number; y: number }) {
    const el = document.elementFromPoint(args.x, args.y);
    if (!el) return null;
    const role = roleOf(el);
    return { ref: refOf(el), tag: el.tagName.toLowerCase(), role, name: nameOf(el, role) || clean((el as HTMLElement).innerText, 60) };
  }

  const fns: Record<string, (a: any) => any> = {
    readPage, find, refRect, formInput, pageText, waitFor, setFiles, overlay, setOverlayVisible, ripple, viewport, elementAt,
    ping: () => true,
  };

  window.__acm = {
    run(name, args) {
      const f = fns[name];
      if (!f) throw new Error(`unknown content function ${name}`);
      return f(args ?? {});
    },
  };
})();

export {};
