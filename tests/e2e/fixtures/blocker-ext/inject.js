if (location.search.includes("blocker")) {
  const host = document.createElement("com-1password-button");
  const root = host.attachShadow({ mode: "closed" });
  const f = document.createElement("iframe");
  f.src = chrome.runtime.getURL("frame.html");
  f.style.cssText = "position:fixed;right:8px;bottom:8px;width:120px;height:40px;border:0";
  root.append(f);
  document.documentElement.append(host);
}
