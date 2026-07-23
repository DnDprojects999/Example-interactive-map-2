(() => {
  const STORAGE_KEY = "serkonia:atlas-contours:v1";
  const MAP_WIDTH = 2048;
  const MAP_HEIGHT = 1051;
  const palette = ["#ef6f6c", "#f5b45b", "#d7df73", "#72c58b", "#5fb8c8", "#788de0", "#b783d9", "#e181af"];

  const els = {
    viewport: document.getElementById("viewport"),
    mapTransform: document.getElementById("mapTransform"),
    mapImage: document.getElementById("mapImage"),
    mapPlaceholder: document.getElementById("mapPlaceholder"),
    svg: document.getElementById("contoursSvg"),
    savedLayer: document.getElementById("savedContoursLayer"),
    draftLayer: document.getElementById("draftContourLayer"),
    uploadMapButton: document.getElementById("uploadMapButton"),
    uploadMapInput: document.getElementById("uploadMapInput"),
    newContourButton: document.getElementById("newContourButton"),
    finishContourButton: document.getElementById("finishContourButton"),
    undoPointButton: document.getElementById("undoPointButton"),
    deleteContourButton: document.getElementById("deleteContourButton"),
    exportButton: document.getElementById("exportButton"),
    importButton: document.getElementById("importButton"),
    importInput: document.getElementById("importInput"),
    fitButton: document.getElementById("fitButton"),
    clearButton: document.getElementById("clearButton"),
    contourNameInput: document.getElementById("contourNameInput"),
    fillOpacityInput: document.getElementById("fillOpacityInput"),
    strokeWidthInput: document.getElementById("strokeWidthInput"),
    contoursList: document.getElementById("contoursList"),
    contourCount: document.getElementById("contourCount"),
    statusText: document.getElementById("statusText"),
    zoomReadout: document.getElementById("zoomReadout"),
    cursorReadout: document.getElementById("cursorReadout"),
  };

  const state = {
    contours: [],
    draft: [],
    selectedId: null,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isPanning: false,
    panPointerId: null,
    panStartX: 0,
    panStartY: 0,
    spaceDown: false,
    mapName: "",
  };

  function uid() {
    return `region-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function round(value) {
    return Number(value.toFixed(2));
  }

  function setStatus(text) {
    els.statusText.textContent = text;
  }

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ contours: state.contours }));
  }

  function loadLocal() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(parsed?.contours)) state.contours = parsed.contours;
    } catch (error) {
      console.warn("Failed to load atlas contours", error);
    }
  }

  function applyTransform() {
    els.mapTransform.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`;
    els.zoomReadout.textContent = `${Math.round(state.scale * 100)}%`;
  }

  function fitMap() {
    const rect = els.viewport.getBoundingClientRect();
    state.scale = Math.min(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT);
    state.offsetX = (rect.width - MAP_WIDTH * state.scale) / 2;
    state.offsetY = (rect.height - MAP_HEIGHT * state.scale) / 2;
    applyTransform();
  }

  function clientToMap(clientX, clientY) {
    const rect = els.viewport.getBoundingClientRect();
    const x = (clientX - rect.left - state.offsetX) / state.scale;
    const y = (clientY - rect.top - state.offsetY) / state.scale;
    return {
      x: Math.max(0, Math.min(MAP_WIDTH, round(x))),
      y: Math.max(0, Math.min(MAP_HEIGHT, round(y))),
    };
  }

  function colorForIndex(index) {
    return palette[index % palette.length];
  }

  function selectedContour() {
    return state.contours.find((contour) => contour.id === state.selectedId) || null;
  }

  function renderContours() {
    els.savedLayer.innerHTML = "";
    state.contours.forEach((contour) => {
      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.classList.add("saved-contour");
      if (contour.id === state.selectedId) polygon.classList.add("active");
      polygon.dataset.contourId = contour.id;
      polygon.setAttribute("points", contour.points.map((point) => `${point.x},${point.y}`).join(" "));
      polygon.setAttribute("fill", contour.color || "#72c58b");
      polygon.setAttribute("fill-opacity", String(contour.fillOpacity ?? 0.16));
      polygon.setAttribute("stroke", contour.color || "#72c58b");
      polygon.setAttribute("stroke-width", String(contour.strokeWidth ?? 3));
      polygon.addEventListener("click", (event) => {
        event.stopPropagation();
        selectContour(contour.id);
      });
      els.savedLayer.appendChild(polygon);
    });

    els.draftLayer.innerHTML = "";
    if (state.draft.length) {
      const draft = document.createElementNS("http://www.w3.org/2000/svg", state.draft.length > 2 ? "polygon" : "polyline");
      draft.classList.add("draft-line");
      draft.setAttribute("points", state.draft.map((point) => `${point.x},${point.y}`).join(" "));
      draft.setAttribute("stroke-width", String(Number(els.strokeWidthInput.value) || 3));
      els.draftLayer.appendChild(draft);
      state.draft.forEach((point) => {
        const vertex = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        vertex.classList.add("vertex");
        vertex.setAttribute("cx", point.x);
        vertex.setAttribute("cy", point.y);
        vertex.setAttribute("r", "5");
        els.draftLayer.appendChild(vertex);
      });
    }

    renderList();
    updateControls();
  }

  function renderList() {
    els.contourCount.textContent = String(state.contours.length);
    els.contoursList.innerHTML = "";
    if (!state.contours.length) {
      const empty = document.createElement("div");
      empty.className = "empty-list";
      empty.textContent = "Пока ни одного контура.";
      els.contoursList.appendChild(empty);
      return;
    }

    state.contours.forEach((contour) => {
      const row = document.createElement("div");
      row.className = `contour-row${contour.id === state.selectedId ? " active" : ""}`;
      row.innerHTML = `
        <span class="contour-swatch" style="background:${contour.color}"></span>
        <span class="contour-name"></span>
        <span class="contour-points">${contour.points.length}</span>
      `;
      row.querySelector(".contour-name").textContent = contour.name || "Без названия";
      row.addEventListener("click", () => selectContour(contour.id));
      els.contoursList.appendChild(row);
    });
  }

  function updateControls() {
    els.finishContourButton.disabled = state.draft.length < 3;
    els.undoPointButton.disabled = state.draft.length === 0;
    els.deleteContourButton.disabled = !state.selectedId;
  }

  function selectContour(id) {
    state.selectedId = id;
    const contour = selectedContour();
    if (contour) {
      els.contourNameInput.value = contour.name || "";
      els.fillOpacityInput.value = String(contour.fillOpacity ?? 0.16);
      els.strokeWidthInput.value = String(contour.strokeWidth ?? 3);
      setStatus(`Выбран контур: ${contour.name || "Без названия"}`);
    }
    renderContours();
  }

  function startNewContour() {
    state.draft = [];
    state.selectedId = null;
    els.contourNameInput.value = `Регион ${state.contours.length + 1}`;
    setStatus("Новый контур: ставь точки по границе");
    renderContours();
  }

  function finishContour() {
    if (state.draft.length < 3) return;
    const contour = {
      id: uid(),
      name: els.contourNameInput.value.trim() || `Регион ${state.contours.length + 1}`,
      color: colorForIndex(state.contours.length),
      fillOpacity: Number(els.fillOpacityInput.value) || 0.16,
      strokeWidth: Number(els.strokeWidthInput.value) || 3,
      points: state.draft.map((point) => ({ x: round(point.x), y: round(point.y) })),
    };
    state.contours.push(contour);
    state.draft = [];
    state.selectedId = contour.id;
    saveLocal();
    setStatus(`Контур «${contour.name}» сохранён`);
    renderContours();
  }

  function deleteSelected() {
    if (!state.selectedId) return;
    state.contours = state.contours.filter((contour) => contour.id !== state.selectedId);
    state.selectedId = null;
    saveLocal();
    setStatus("Контур удалён");
    renderContours();
  }

  function updateSelectedStyle() {
    const contour = selectedContour();
    if (!contour) return;
    contour.name = els.contourNameInput.value.trim() || contour.name;
    contour.fillOpacity = Number(els.fillOpacityInput.value);
    contour.strokeWidth = Number(els.strokeWidthInput.value);
    saveLocal();
    renderContours();
  }

  function downloadJson() {
    const payload = {
      schemaVersion: 1,
      type: "serkonia-atlas-svg-contours",
      map: {
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        sourceName: state.mapName || null,
      },
      contours: state.contours.map((contour) => ({
        ...contour,
        normalizedPoints: contour.points.map((point) => ({
          x: round(point.x / MAP_WIDTH),
          y: round(point.y / MAP_HEIGHT),
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "serkonia-atlas-contours.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(`Экспортировано контуров: ${state.contours.length}`);
  }

  async function importJson(file) {
    if (!file) return;
    const payload = JSON.parse(await file.text());
    if (!Array.isArray(payload?.contours)) throw new Error("В JSON отсутствует массив contours");
    state.contours = payload.contours.map((contour, index) => ({
      id: String(contour.id || uid()),
      name: String(contour.name || `Регион ${index + 1}`),
      color: String(contour.color || colorForIndex(index)),
      fillOpacity: Number.isFinite(Number(contour.fillOpacity)) ? Number(contour.fillOpacity) : 0.16,
      strokeWidth: Number.isFinite(Number(contour.strokeWidth)) ? Number(contour.strokeWidth) : 3,
      points: Array.isArray(contour.points)
        ? contour.points.map((point) => ({ x: Number(point.x), y: Number(point.y) })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        : [],
    })).filter((contour) => contour.points.length >= 3);
    state.draft = [];
    state.selectedId = null;
    saveLocal();
    renderContours();
    setStatus(`Импортировано контуров: ${state.contours.length}`);
  }

  els.uploadMapButton.addEventListener("click", () => els.uploadMapInput.click());
  els.uploadMapInput.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    state.mapName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      els.mapImage.src = String(reader.result || "");
      els.mapImage.hidden = false;
      els.mapPlaceholder.hidden = true;
      setStatus(`Карта загружена: ${file.name}`);
      fitMap();
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  });

  els.newContourButton.addEventListener("click", startNewContour);
  els.finishContourButton.addEventListener("click", finishContour);
  els.undoPointButton.addEventListener("click", () => {
    state.draft.pop();
    renderContours();
  });
  els.deleteContourButton.addEventListener("click", deleteSelected);
  els.exportButton.addEventListener("click", downloadJson);
  els.importButton.addEventListener("click", () => els.importInput.click());
  els.importInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    try {
      await importJson(file);
    } catch (error) {
      alert(`Не удалось импортировать JSON: ${error.message}`);
    }
    event.target.value = "";
  });
  els.fitButton.addEventListener("click", fitMap);
  els.clearButton.addEventListener("click", () => {
    if (!confirm("Удалить все нарисованные контуры?")) return;
    state.contours = [];
    state.draft = [];
    state.selectedId = null;
    saveLocal();
    renderContours();
    setStatus("Все контуры удалены");
  });

  els.contourNameInput.addEventListener("change", updateSelectedStyle);
  els.fillOpacityInput.addEventListener("input", updateSelectedStyle);
  els.strokeWidthInput.addEventListener("input", () => {
    updateSelectedStyle();
    renderContours();
  });

  els.viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = els.viewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const worldX = (pointerX - state.offsetX) / state.scale;
    const worldY = (pointerY - state.offsetY) / state.scale;
    const nextScale = Math.max(0.15, Math.min(8, state.scale * (event.deltaY < 0 ? 1.12 : 0.89)));
    state.offsetX = pointerX - worldX * nextScale;
    state.offsetY = pointerY - worldY * nextScale;
    state.scale = nextScale;
    applyTransform();
  }, { passive: false });

  els.viewport.addEventListener("pointerdown", (event) => {
    const shouldPan = event.button === 1 || event.button === 2 || state.spaceDown;
    if (shouldPan) {
      event.preventDefault();
      state.isPanning = true;
      state.panPointerId = event.pointerId;
      state.panStartX = event.clientX - state.offsetX;
      state.panStartY = event.clientY - state.offsetY;
      els.viewport.classList.add("panning");
      els.viewport.setPointerCapture(event.pointerId);
      return;
    }

    if (event.button !== 0 || event.target.closest(".saved-contour")) return;
    state.selectedId = null;
    state.draft.push(clientToMap(event.clientX, event.clientY));
    setStatus(`Точек в текущем контуре: ${state.draft.length}`);
    renderContours();
  });

  els.viewport.addEventListener("pointermove", (event) => {
    const point = clientToMap(event.clientX, event.clientY);
    els.cursorReadout.textContent = `x: ${point.x}, y: ${point.y}`;
    if (!state.isPanning || event.pointerId !== state.panPointerId) return;
    state.offsetX = event.clientX - state.panStartX;
    state.offsetY = event.clientY - state.panStartY;
    applyTransform();
  });

  function stopPanning(event) {
    if (!state.isPanning || (event && event.pointerId !== state.panPointerId)) return;
    state.isPanning = false;
    state.panPointerId = null;
    els.viewport.classList.remove("panning");
  }

  els.viewport.addEventListener("pointerup", stopPanning);
  els.viewport.addEventListener("pointercancel", stopPanning);
  els.viewport.addEventListener("contextmenu", (event) => event.preventDefault());
  els.viewport.addEventListener("dblclick", (event) => {
    event.preventDefault();
    if (state.draft.length >= 3) finishContour();
  });

  document.addEventListener("keydown", (event) => {
    if (event.code === "Space" && !event.repeat) {
      state.spaceDown = true;
      event.preventDefault();
    }
    if (event.key === "Enter") finishContour();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      state.draft.pop();
      renderContours();
    }
    if (event.key === "Delete" && state.selectedId) deleteSelected();
    if (event.key === "Escape") {
      state.draft = [];
      renderContours();
      setStatus("Черновик контура отменён");
    }
  });
  document.addEventListener("keyup", (event) => {
    if (event.code === "Space") state.spaceDown = false;
  });
  window.addEventListener("resize", fitMap);

  loadLocal();
  renderContours();
  fitMap();
})();
