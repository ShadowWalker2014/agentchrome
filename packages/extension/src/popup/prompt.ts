const q = new URLSearchParams(location.search);
const host = q.get("host") ?? "";
const client = q.get("client") ?? "An agent";
document.getElementById("who")!.textContent = `${client} wants to use`;
document.getElementById("title")!.textContent = host;
(document.getElementById("fav") as HTMLImageElement).src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
document.getElementById("desc")!.textContent = `It will be able to read and act on ${host} in this Chrome profile, where you may be signed in. Web pages can contain instructions meant to trick agents, so only allow sites you trust for this task.`;
const answer = async (a: string) => {
  await chrome.runtime.sendMessage({ type: "acm:prompt-answer", id: q.get("id"), answer: a });
  window.close();
};
for (const b of document.querySelectorAll<HTMLButtonElement>("button[data-a]")) b.onclick = () => answer(b.dataset.a!);
addEventListener("keydown", (e) => e.key === "Escape" && answer("deny"));
export {};
