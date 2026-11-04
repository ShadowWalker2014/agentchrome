const q = new URLSearchParams(location.search);
const host = q.get("host") ?? "";
const client = q.get("client") ?? "An agent";
document.getElementById("title")!.textContent = `Let ${client} use ${host}?`;
document.getElementById("desc")!.textContent = `${client} wants to read and act on ${host} in this Chrome profile. Pages can contain instructions meant to trick agents; only allow sites you trust for this task.`;
for (const b of document.querySelectorAll<HTMLButtonElement>("button[data-a]")) {
  b.onclick = async () => {
    await chrome.runtime.sendMessage({ type: "acm:prompt-answer", id: q.get("id"), answer: b.dataset.a });
    window.close();
  };
}
