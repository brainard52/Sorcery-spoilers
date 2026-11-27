"use strict";
const $ = id => document.getElementById(id);
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
let catalog, images, releasedSets;
const removedFields = new Set(["category","collector_number","copyright","copyright_year"]);
const view = document.body.dataset.view === "archive" ? "archive" : "current";
function isSite(card) { return card.fields.type?.trim().toLowerCase() === "site"; }
function imageNode(image, alt, site = false) {
  const frame = el("span",undefined,`card-image${site ? " site-image" : ""}`);
  const node = el("img"); node.src = image.url; node.alt = alt; node.loading = "lazy";
  frame.append(node); return frame;
}
function fieldsNode(fields) {
  const dl = el("dl", undefined, "printed-fields");
  for (const [key, value] of Object.entries(fields)) {
    if (key === "back" || removedFields.has(key) || key === "additional_fields" || !value) continue;
    dl.append(el("dt", key.replaceAll("_", " ")), el("dd", value));
  }
  for (const [key, value] of Object.entries(fields.additional_fields || {})) if (value) dl.append(el("dt", key), el("dd", value));
  return dl;
}
function openCard(card) {
  const title = card.fields.name || "Unnamed card";
  $("detail-content").replaceChildren(el("p", card.fields.set || "No set", "muted small"), el("h2", title));
  const gallery = el("div", undefined, "detail-images");
  for (const id of card.image_ids) {
    const a = el("a"); a.href = images[id].url; a.target = "_blank"; a.rel = "noopener";
    if (isSite(card)) a.className = "site-asset";
    a.append(imageNode(images[id], title, isSite(card))); gallery.append(a);
  }
  $("detail-content").append(gallery, fieldsNode(card.fields));
  if (card.fields.back) $("detail-content").append(el("h3", "Reverse face"), fieldsNode(card.fields.back));
  $("detail").showModal();
}
function inView(card) { return releasedSets.has(card.fields.set) === (view === "archive"); }
function updateView() {
  if (!catalog) return;
  $("collection-title").textContent = view === "archive" ? "Archive" : "Current spoilers";
  const scoped = catalog.cards.filter(inView);
  for (const key of ["set", "type"]) {
    const previous = $(key).value;
    $(key).replaceChildren(new Option(key === "set" ? "All sets" : "All types", ""));
    for (const value of [...new Set(scoped.map(c => c.fields[key]).filter(Boolean))].sort()) $(key).add(new Option(value, value));
    if ([...$(key).options].some(o => o.value === previous)) $(key).value = previous;
  }
  render();
}
function render() {
  const query = $("search").value.toLowerCase(), set = $("set").value, type = $("type").value;
  const cards = catalog.cards.filter(c => inView(c) && (!set || c.fields.set === set) && (!type || c.fields.type === type) && `${c.fields.name || "Unnamed card"} ${JSON.stringify(c.fields)}`.toLowerCase().includes(query));
  $("cards").replaceChildren();
  const groups = new Map();
  for (const card of cards) {
    const name = card.fields.set || "";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(card);
  }
  for (const [setName, entries] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const archived = view === "archive";
    const group = el("section", undefined, "set-group"), grid = el(archived ? "ul" : "div", undefined, archived ? "archive-list" : "public-grid");
    group.append(el("h2", setName || "No set", "set-heading"), grid);
    if (archived) entries.sort((a,b) => (a.fields.name || "Unnamed card").localeCompare(b.fields.name || "Unnamed card"));
    $("cards").append(group);
    for (const card of entries) {
      const button = el("button", undefined, archived ? "public-card archive-card" : "public-card"); const face = el("div", undefined, `card-face${isSite(card) ? " site-face" : ""}`);
      const title = card.fields.name || "Unnamed card";
      if (card.image_ids.length) face.append(imageNode(images[card.image_ids[0]], title, isSite(card)));
      else face.append(el("span", "No image"));
      const meta = el("div", undefined, "card-meta");
      if (archived) meta.append(el("h3",title),el("p",[card.fields.type,card.fields.rarity].filter(Boolean).join(" · ")));
      else meta.append(el("small", [card.fields.set, card.fields.rarity].filter(Boolean).join(" · ") || "No set"), el("h3", title), el("p", card.fields.typeline || card.fields.type || ""), el("small", `${card.image_ids.length} ${card.image_ids.length === 1 ? "image" : "images"}`));
      button.append(face, meta); button.addEventListener("click", () => openCard(card));
      if (archived) { const item = el("li"); item.append(button); grid.append(item); } else grid.append(button);
    }
  }
  $("result-count").textContent = `${cards.length} ${cards.length === 1 ? "spoiler" : "spoilers"}`;
  $("empty").hidden = cards.length > 0;
  $("empty").textContent = !catalog.cards.some(inView) ? view === "archive" ? "No archived spoilers yet." : "No current spoilers yet." : "No spoilers match.";
}
async function main() {
  const response = await fetch("catalog.json"); if (!response.ok) throw new Error("Could not load cards.");
  catalog = await response.json(); if (catalog.schema_version !== 1) throw new Error("This catalog version is not supported.");
  images = Object.fromEntries(catalog.images.map(im => [im.id, im]));
  releasedSets = new Set((catalog.sets || []).filter(s => s.released).map(s => s.name));
  const scoped = catalog.cards.filter(inView), count = new Set(scoped.map(c => c.fields.set)).size;
  $("stats").textContent = `${scoped.length} ${scoped.length === 1 ? "spoiler" : "spoilers"} · ${count} ${count === 1 ? "set" : "sets"}`;
  for (const id of ["search", "set", "type"]) $(id).addEventListener("input", render);
  updateView();
}
// Keep previously shared archive bookmarks working with the separate page.
if (view === "current" && location.hash === "#archive") location.replace("archive.html");
window.addEventListener("hashchange",() => { if (view === "current" && location.hash === "#archive") location.replace("archive.html"); });
$("close-detail").addEventListener("click", () => $("detail").close());
$("detail").addEventListener("click", event => { if (event.target === $("detail")) { const r = $("detail").getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $("detail").close(); } });
main().catch(error => { $("stats").textContent = error.message; $("cards").replaceChildren(el("p", error.message, "error")); });
