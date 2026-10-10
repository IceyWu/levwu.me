interface FileDetail {
  address: string | null;
  altitude: number | null;
  city: string | null;
  colors: Array<{ rank: number; color: { hex: string } | null }> | null;
  country: string | null;
  created_at: string;
  device_make: string | null;
  device_model: string | null;
  exposure_time: string | null;
  f_number: string | null;
  focal_length: string | null;
  height: number | null;
  iso: number | null;
  lat: number | null;
  lens_model: string | null;
  lng: number | null;
  name: string;
  province: string | null;
  size: number;
  taken_at: string | null;
  uid: string;
  width: number | null;
}

const pendingDetails = new Map<string, Promise<FileDetail>>();
const icons: Record<string, string> = {
  aperture:
    "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M14 2l-3 6 M22 9h-7 M18 20l-4-6 M8 22l3-6 M2 15h7 M6 4l4 6",
  calendar: "M3 5h18v16H3z M7 2v6 M17 2v6 M3 10h18",
  camera: "M14 4h-4L8 7H3v13h18V7h-5z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  expand: "M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5",
  file: "M14 2H5v20h14V7z M14 2v6h5 M8 13h8 M8 17h8",
  focus:
    "M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  gauge:
    "M20 19a10 10 0 1 0-16 0 M12 13l4-4 M13 14a1 1 0 1 1-2 0 1 1 0 0 1 2 0",
  mountain: "M2 21L10 3l12 18z M7 10l3 3 3-3",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0 M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  ruler: "M3 16L16 3l5 5L8 21z M7 12l3 3 M11 8l3 3 M15 4l3 3",
  timer: "M10 2h4 M12 8v5l3 2 M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
};

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = ""
) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function icon(name: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", icons[name] || icons.file);
  svg.appendChild(path);
  return svg;
}

function loadDetail(uid: string): Promise<FileDetail> {
  const cached = pendingDetails.get(uid);
  if (cached) {
    return cached;
  }
  const request = fetch(
    `https://api.lpalette.cn/api/v1/files/${encodeURIComponent(uid)}?fields=full`,
    { signal: AbortSignal.timeout(15_000) }
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload: { code: number; data?: FileDetail } =
        await response.json();
      if (payload.code !== 200 || payload.data?.uid !== uid) {
        throw new Error("Invalid file detail");
      }
      return payload.data;
    })
    .catch((error: unknown) => {
      pendingDetails.delete(uid);
      throw error;
    });
  if (pendingDetails.size >= 100) {
    pendingDetails.delete(pendingDetails.keys().next().value || "");
  }
  pendingDetails.set(uid, request);
  return request;
}

function formatDate(value: string | null) {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return date.toLocaleString("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function mountMap(container: HTMLElement, lng: number, lat: number) {
  const token = import.meta.env.PUBLIC_MAPBOX_TOKEN || "";
  if (!token) {
    container.replaceChildren(
      element("p", "photo-info-message", "地图暂不可用")
    );
    return;
  }
  try {
    const [{ default: mapboxgl }, { default: MapboxLanguage }] =
      await Promise.all([
        import("mapbox-gl"),
        import("@mapbox/mapbox-gl-language"),
      ]);
    if (!container.isConnected) {
      return;
    }
    const map = new mapboxgl.Map({
      accessToken: token,
      attributionControl: false,
      center: [lng, lat],
      container,
      interactive: false,
      style: "mapbox://styles/mapbox/dark-v11",
      zoom: 12,
    });
    map.addControl(new MapboxLanguage({ defaultLanguage: "zh-Hans" }));
    map.on("load", () => {
      new mapboxgl.Marker({ color: "#60a5fa" })
        .setLngLat([lng, lat])
        .addTo(map);
      map.resize();
    });
    map.on("error", () => {
      if (!map.loaded()) {
        container.dataset.mapError = "true";
      }
    });
    const observer = new MutationObserver(() => {
      const preview = container.closest(".image-preview-container");
      if (!(container.isConnected && preview?.classList.contains("active"))) {
        observer.disconnect();
        map.remove();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const preview = container.closest(".image-preview-container");
    if (preview) {
      observer.observe(preview, {
        attributeFilter: ["class"],
        attributes: true,
      });
    }
  } catch {
    container.replaceChildren(
      element("p", "photo-info-message", "地图加载失败")
    );
  }
}

function renderDeviceAndParams(container: HTMLElement, detail: FileDetail) {
  const device = [detail.device_make, detail.device_model]
    .filter(Boolean)
    .join(" ");
  if (device || detail.lens_model) {
    const block = element("section");
    const heading = element("div", "photo-info-device", device);
    heading.prepend(icon("camera"));
    block.appendChild(heading);
    if (detail.lens_model) {
      block.appendChild(element("div", "photo-info-lens", detail.lens_model));
    }
    container.appendChild(block);
  }
  const params: [string, string, string | null][] = [
    ["aperture", "光圈", detail.f_number ? `f/${detail.f_number}` : null],
    ["timer", "快门", detail.exposure_time ? `${detail.exposure_time}s` : null],
    ["gauge", "ISO", detail.iso === null ? null : String(detail.iso)],
    ["focus", "焦距", detail.focal_length ? `${detail.focal_length}mm` : null],
  ];
  const grid = element("div", "photo-info-params");
  for (const [name, label, value] of params) {
    if (!value) {
      continue;
    }
    const cell = element("div", "photo-info-param");
    const text = element("div");
    text.append(
      element("strong", "", value),
      element("div", "photo-info-param-label", label)
    );
    cell.append(icon(name), text);
    grid.appendChild(cell);
  }
  if (grid.childElementCount) {
    container.appendChild(grid);
  }
}

function section(container: HTMLElement, label: string) {
  const block = element("section");
  block.appendChild(element("h4", "photo-info-section-title", label));
  container.appendChild(block);
  return block;
}

function renderColors(container: HTMLElement, detail: FileDetail) {
  const colors = (detail.colors || [])
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .filter((entry) => /^#[0-9a-f]{6}$/i.test(entry.color?.hex || ""));
  if (colors.length) {
    const block = section(container, "色彩");
    const swatches = element("div", "photo-info-swatches");
    const labels = element("div", "photo-info-color-labels");
    for (const color of colors) {
      const hex = color.color?.hex || "";
      const swatch = element("div");
      swatch.style.backgroundColor = hex;
      swatch.title = hex;
      swatches.appendChild(swatch);
      labels.appendChild(element("span", "", hex));
    }
    block.append(swatches, labels);
  }
}

function renderFiles(container: HTMLElement, detail: FileDetail) {
  const files = section(container, "文件信息");
  const rows = element("dl", "photo-info-rows");
  const values: [string, string, string][] = [
    ["file", "文件名", detail.name],
    [
      "expand",
      "分辨率",
      detail.width && detail.height
        ? `${detail.width} × ${detail.height}`
        : "--",
    ],
    [
      "ruler",
      "文件大小",
      detail.size < 1_048_576
        ? `${(detail.size / 1024).toFixed(1)} KB`
        : `${(detail.size / 1_048_576).toFixed(1)} MB`,
    ],
    ["calendar", "拍摄时间", formatDate(detail.taken_at)],
  ];
  if (detail.altitude !== null) {
    values.push(["mountain", "海拔", `${detail.altitude.toFixed(0)} m`]);
  }
  for (const [name, label, value] of values) {
    const row = element("div", "photo-info-row");
    const term = element("dt", "", label);
    term.prepend(icon(name));
    const description = element("dd", "", value || "--");
    description.title = value;
    row.append(term, description);
    rows.appendChild(row);
  }
  files.appendChild(rows);
}

function renderLocation(container: HTMLElement, detail: FileDetail) {
  const hasCoordinates =
    detail.lng !== null &&
    detail.lat !== null &&
    Number.isFinite(detail.lng) &&
    Number.isFinite(detail.lat);
  const locationText =
    detail.address ||
    [detail.city, detail.province, detail.country].filter(Boolean).join(", ");
  if (hasCoordinates || locationText) {
    const location = section(container, "拍摄地点");
    if (locationText) {
      const address = element("div", "photo-info-address", locationText);
      address.prepend(icon("pin"));
      location.appendChild(address);
    }
    if (hasCoordinates) {
      const map = element("div", "photo-info-map");
      location.append(
        map,
        element(
          "div",
          "photo-info-coordinates",
          `${detail.lat?.toFixed(6)}, ${detail.lng?.toFixed(6)}`
        )
      );
      void mountMap(map, detail.lng as number, detail.lat as number);
    }
  }
}

function renderDetail(container: HTMLElement, detail: FileDetail) {
  container.replaceChildren();
  renderDeviceAndParams(container, detail);
  renderColors(container, detail);
  renderFiles(container, detail);
  renderLocation(container, detail);
}

export function createPhotoInfoPanel(uid: string): HTMLElement {
  const container = element("div", "photo-info-panel");
  container.setAttribute("aria-live", "polite");
  if (!uid) {
    container.textContent = "缺少文件 UID，无法读取详情。";
    return container;
  }
  const load = () => {
    container.textContent = "加载中...";
    loadDetail(uid)
      .then((detail) => renderDetail(container, detail))
      .catch(() => {
        container.replaceChildren(
          element(
            "p",
            "photo-info-message",
            "文件信息加载失败，文件可能已删除或设为私有。"
          )
        );
        const retry = element("button", "photo-info-retry", "重试");
        retry.type = "button";
        retry.addEventListener("click", load);
        container.appendChild(retry);
      });
  };
  load();
  return container;
}
