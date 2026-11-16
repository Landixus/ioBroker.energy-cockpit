// MDI assets are local and Apache-2.0 licensed. No external requests.
class CockpitIcon extends HTMLElement {
  static get observedAttributes() {
    return ["icon"];
  }
  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.render();
  }
  attributeChangedCallback() {
    this.render();
  }
  async render() {
    if (!this.shadowRoot) return;
    const name = (this.getAttribute("icon") || "").replace(/^mdi:/, "");
    if (!/^[a-z0-9-]+$/.test(name)) return;
    let response = await fetch("icons/" + name + ".svg");
    if (!response.ok) response = await fetch("icons/help-circle-outline.svg");
    if (!response.ok) return;
    const svg = await response.text();
    if (!this.isConnected) return;
    this.shadowRoot.innerHTML =
      "<style>:host{display:inline-flex;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)}svg{width:100%;height:100%;fill:currentColor}</style>" +
      svg;
  }
}
customElements.define("ha-icon", CockpitIcon);
