var __prevDieter = window.Dieter ? { ...window.Dieter } : {};
(function () {
  const registry = new WeakMap();

  function parseJson(value, fallback) {
    if (!value) return fallback;
    try {
      const decoded = value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
      return JSON.parse(decoded);
    } catch {
      return fallback;
    }
  }

  function stringify(value) {
    try {
      return JSON.stringify(value);
    } catch {
      return "[]";
    }
  }

  function diffArrays(prev, next) {
    if (!Array.isArray(prev) || !Array.isArray(next)) {
      return { structuralChange: true, valueChanges: [] };
    }
    if (prev.length !== next.length) {
      return { structuralChange: true, valueChanges: [] };
    }
    const valueChanges = [];
    for (let i = 0; i < next.length; i++) {
      const prevItem = prev[i];
      const nextItem = next[i];
      const prevId = prevItem && prevItem.id;
      const nextId = nextItem && nextItem.id;
      if ((prevId || nextId) && prevId !== nextId) {
        return { structuralChange: true, valueChanges: [] };
      }
      if (JSON.stringify(prevItem) !== JSON.stringify(nextItem)) {
        valueChanges.push({ index: i, nextItem });
      }
    }
    return { structuralChange: false, valueChanges };
  }

  function hydrateRepeater(scope) {
    const roots = scope.querySelectorAll(".diet-repeater");
    roots.forEach((root) => {
      if (registry.has(root)) return;
      const hidden = root.querySelector(".diet-repeater__field");
      const list = root.querySelector("[data-repeater-list]");
      const templateEl = root.querySelector("template[data-repeater-item]");
      const addBtn = root.querySelector(".diet-repeater__add");
      const reorderBtn = root.querySelector(".diet-repeater__reorder");
      if (!hidden || !list || !templateEl || !addBtn || !reorderBtn) return;

      const state = {
        root,
        hidden,
        list,
        template: templateEl.innerHTML || "",
        addBtn,
        reorderBtn,
        reorder: false,
        value: parseJson(hidden.value, []),
      };
      registry.set(root, state);
      render(state);

      addBtn.addEventListener("click", () => {
        state.value = Array.isArray(state.value) ? [...state.value, {}] : [{}];
        commit(state);
      });

      reorderBtn.addEventListener("click", () => {
        state.reorder = !state.reorder;
        root.dataset.reorder = state.reorder ? "on" : "off";
        reorderBtn.setAttribute("aria-pressed", state.reorder ? "true" : "false");
        render(state);
      });

      const handleExternal = (ev) => {
        const payload =
          ev && ev.type === "external-sync" && ev.detail && typeof ev.detail.value !== "undefined"
            ? ev.detail.value
            : hidden.value;
        const next =
          typeof payload === "string"
            ? parseJson(payload, [])
            : Array.isArray(payload)
              ? payload
              : parseJson(stringify(payload), []);
        const diff = diffArrays(state.value, next);
        if (diff.structuralChange) {
          state.value = Array.isArray(next) ? next : [];
          render(state);
          return;
        }
        if (diff.valueChanges.length > 0) {
          state.value = next;
          syncChangedItems(state, diff.valueChanges);
        }
      };

      hidden.addEventListener("input", handleExternal);
      hidden.addEventListener("change", handleExternal);
      hidden.addEventListener("external-sync", handleExternal);
    });
  }

  function render(state) {
    const { list, template, value, reorder, hidden, root } = state;
    list.innerHTML = "";
    if (!Array.isArray(value)) return;

    value.forEach((_item, index) => {
      const item = document.createElement("div");
      item.className = "diet-repeater__item";
      item.dataset.index = String(index);

      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "diet-btn-ic diet-repeater__item-handle";
      handle.setAttribute("data-size", "sm");
      handle.setAttribute("data-variant", "neutral");
      handle.innerHTML = '<span class="diet-btn-ic__icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="3.828125 1.4053388917082947 19.26 30.55" fill="currentColor" aria-hidden="true"><path d="M10.31 31.39L22.74 15.41C22.97 15.12 23.09 14.85 23.09 14.53C23.09 14.01 22.68 13.62 22.11 13.62L14.38 13.62L18.46 2.98C19.00 1.57 17.50 0.81 16.61 1.98L4.18 17.95C3.95 18.25 3.83 18.53 3.83 18.83C3.83 19.36 4.24 19.76 4.81 19.76L12.54 19.76L8.46 30.38C7.92 31.79 9.42 32.55 10.31 31.39ZM15.70 17.72L7.25 17.72L14.96 7.48L11.22 15.65L19.66 15.65L11.95 25.89Z"/></svg></span>';

      const body = document.createElement("div");
      body.className = "diet-repeater__item-body";
      body.innerHTML = template.replace(/__INDEX__/g, String(index));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "diet-btn-ic diet-repeater__item-remove";
      remove.setAttribute("data-size", "sm");
      remove.setAttribute("data-variant", "neutral");
      remove.innerHTML = '<span class="diet-btn-ic__icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox=\"2.447265625 0.505859375 24.14 29.37\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M14.52 29.87C21.19 29.87 26.59 24.47 26.59 17.80C26.59 11.13 21.19 5.73 14.52 5.73C13.74 5.73 12.99 5.81 12.25 5.95L15.80 2.42C16.01 2.21 16.11 1.91 16.11 1.63C16.11 1.01 15.64 0.51 15.03 0.51C14.70 0.51 14.44 0.64 14.23 0.85L8.60 6.56C8.38 6.78 8.26 7.08 8.26 7.38C8.26 7.68 8.35 7.96 8.60 8.20L14.23 13.86C14.44 14.05 14.68 14.18 15.03 14.18C15.64 14.18 16.11 13.70 16.11 13.07C16.11 12.78 16.01 12.51 15.79 12.30L11.76 8.31C12.63 8.05 13.56 7.92 14.52 7.92C19.97 7.92 24.39 12.33 24.39 17.79C24.39 23.24 19.97 27.66 14.52 27.66C9.06 27.66 4.65 23.24 4.65 17.79C4.65 17.19 4.16 16.69 3.54 16.69C2.94 16.69 2.45 17.19 2.45 17.79C2.45 24.47 7.85 29.87 14.52 29.87Z\"/></svg></span>';
      remove.addEventListener("click", () => {
        const next = [...state.value];
        next.splice(index, 1);
        state.value = next;
        commit(state);
      });

      const itemValue = Array.isArray(value) ? value[index] : void 0;
      const arrayPath = hidden.getAttribute("data-bob-path") || hidden.getAttribute("data-path") || "";
      const prefix = arrayPath ? `${arrayPath}.${index}.` : "";
      const getAt = (obj, path) => {
        if (!obj || !path) return void 0;
        const parts = path.split(".");
        let cur = obj;
        for (const p of parts) {
          if (cur == null) return void 0;
          cur = cur[p];
        }
        return cur;
      };
      body.querySelectorAll("[data-bob-path]").forEach((el) => {
        const p = el.getAttribute("data-bob-path");
        if (!p) return;
        const rel = prefix && p.startsWith(prefix) ? p.slice(prefix.length) : null;
        const val = rel ? getAt(itemValue, rel) : void 0;
        if (val === void 0) return;
        if (el instanceof HTMLInputElement) {
          if (el.type === "checkbox") {
            el.checked = Boolean(val);
          } else {
            el.value = String(val);
          }
        } else if ("value" in el) {
          el.value = String(val);
        }
      });

      item.appendChild(handle);
      item.appendChild(body);
      item.appendChild(remove);

      if (reorder) {
        attachReorderVisuals(item);
        installPointerReorder(item, state, index);
      }

      list.appendChild(item);
    });

    runChildHydrators(list);
    if (root) {
      runChildHydrators(root);
    }

    if (!reorder) {
      list.querySelectorAll(".diet-repeater__item").forEach((el) => {
        el.style.borderColor = "";
        el.style.backgroundColor = "";
        el.style.borderWidth = "";
        el.style.borderStyle = "";
        el.style.boxShadow = "";
        el.style.transform = "";
      });
    }
  }

  function updateItemFields(state, itemEl, itemValue, index) {
    const hidden = state.hidden;
    const arrayPath = hidden.getAttribute("data-bob-path") || hidden.getAttribute("data-path") || "";
    const prefix = arrayPath ? `${arrayPath}.${index}.` : "";
    const getAt = (obj, path) => {
      if (!obj || !path) return void 0;
      const parts = path.split(".");
      let cur = obj;
      for (const p of parts) {
        if (cur == null) return void 0;
        cur = cur[p];
      }
      return cur;
    };
    itemEl.querySelectorAll("[data-bob-path]").forEach((el) => {
      const p = el.getAttribute("data-bob-path");
      if (!p) return;
      const rel = prefix && p.startsWith(prefix) ? p.slice(prefix.length) : null;
      const val = rel ? getAt(itemValue, rel) : void 0;
      if (val === void 0) return;
      if (el instanceof HTMLInputElement) {
        if (el.type === "checkbox") {
          const nextChecked = Boolean(val);
          if (el.checked !== nextChecked) {
            el.checked = nextChecked;
          }
        } else {
          const nextVal = String(val);
          if (el.value !== nextVal) {
            el.value = nextVal;
          }
        }
      } else if ("value" in el) {
        const nextVal = String(val);
        if (el.value !== nextVal) {
          el.value = nextVal;
        }
      }
    });
  }

  function syncChangedItems(state, changes) {
    const { list } = state;
    changes.forEach(({ index, nextItem }) => {
      const itemEl = list.children[index];
      if (!itemEl) return;
      if (itemEl.contains(document.activeElement)) return;
      updateItemFields(state, itemEl, nextItem, index);
    });
  }

  function commit(state) {
    state.hidden.value = stringify(state.value);
    const evt = new Event("input", { bubbles: true });
    state.hidden.dispatchEvent(evt);
    render(state);
  }

  function isInteractive(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (
      target.matches(
        'input, textarea, select, button, [role="button"], label, .diet-toggle__switch, [contenteditable="true"]'
      )
    ) {
      return true;
    }
    return Boolean(
      target.closest(
        'input, textarea, select, button, [role="button"], .diet-toggle__switch, label, [contenteditable="true"]'
      )
    );
  }

  function setItemVisual(item, mode) {
    item.style.borderStyle = "solid";
    item.style.borderWidth = "2px";
    item.style.boxShadow = "none";
    item.style.transition = "border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease";
    if (mode === "drag") {
      item.style.borderColor = "var(--color-system-green, #2ecc71)";
      item.style.backgroundColor = "#c7efd8";
      item.style.boxShadow = "0 10px 24px rgba(0,0,0,0.12), 0 0 0 2px rgba(46, 204, 113, 0.35)";
      return;
    }
    if (mode === "hover") {
      item.style.borderColor = "var(--color-system-blue, #2f6bff)";
      item.style.backgroundColor = "#cedcff";
      item.style.boxShadow = "none";
      return;
    }
    item.style.borderColor = "#2f6bff";
    item.style.backgroundColor = "#e4ebff";
    item.style.boxShadow = "none";
  }

  function attachReorderVisuals(item) {
    setItemVisual(item, "base");
    item.addEventListener("mouseenter", () => setItemVisual(item, "hover"));
    item.addEventListener("mouseleave", () => setItemVisual(item, "base"));
  }

  function installPointerReorder(item, state, index) {
    const list = state.list;
    const onPointerDown = (startEvent) => {
      if (startEvent.button !== 0) return;
      if (isInteractive(startEvent.target)) return;
      startEvent.preventDefault();

      const rect = item.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const startLeft = rect.left - listRect.left + list.scrollLeft;
      const startTop = rect.top - listRect.top + list.scrollTop;
      let placeholder = null;
      const items = () => Array.from(list.children).filter((el) => el.classList.contains("diet-repeater__item") || el.classList.contains("diet-repeater__placeholder"));
      const originalPosition = list.style.position;
      if (!originalPosition) {
        list.style.position = "relative";
      }

      const startY = startEvent.clientY;
      let currentIndex = index;
      let hasLifted = false;
      setItemVisual(item, "hover");

      const move = (ev) => {
        ev.preventDefault();
        const deltaY = ev.clientY - startY;

        if (!hasLifted && Math.abs(deltaY) > 4) {
          hasLifted = true;
          placeholder = document.createElement("div");
          placeholder.className = "diet-repeater__placeholder";
          placeholder.style.height = `${rect.height}px`;
          placeholder.style.width = "100%";
          list.insertBefore(placeholder, item);

          setItemVisual(item, "drag");
          item.classList.add("is-dragging");
          item.style.position = "absolute";
          item.style.pointerEvents = "none";
          item.style.width = `${rect.width}px`;
          item.style.left = `${startLeft}px`;
          item.style.top = `${startTop}px`;
          item.style.zIndex = "2";
          item.style.transition = "transform 80ms ease";
          list.appendChild(item);
        }

        if (!placeholder) return;

        const nextTop = startTop + deltaY;
        item.style.transform = `translateY(${nextTop - startTop}px)`;

        const pointerY = ev.clientY;
        let target = placeholder;
        for (const sibling of items()) {
          if (sibling === item || sibling === placeholder) continue;
          const r = sibling.getBoundingClientRect();
          const mid = r.top + r.height / 2;
          if (pointerY < mid) {
            target = sibling;
            break;
          }
        }
        if (target && target !== placeholder) {
          list.insertBefore(placeholder, target);
        } else {
          list.appendChild(placeholder);
        }
        currentIndex = items().indexOf(placeholder);
      };

      const up = (ev) => {
        ev.preventDefault();
        window.removeEventListener("pointermove", move, true);
        window.removeEventListener("pointerup", up, true);
        if (hasLifted && placeholder) {
          item.classList.remove("is-dragging");
          setItemVisual(item, "base");
          item.style.transform = "";
          item.style.position = "";
          item.style.pointerEvents = "";
          item.style.width = "";
          item.style.left = "";
          item.style.top = "";
          item.style.zIndex = "";
          item.style.transition = "";
          const newIndex = currentIndex;
          placeholder.remove();
          if (newIndex !== index && newIndex !== -1) {
            const next = Array.isArray(state.value) ? [...state.value] : [];
            const [moved] = next.splice(index, 1);
            next.splice(newIndex, 0, moved);
            state.value = next;
            commit(state);
          }
        }
        if (!originalPosition) {
          list.style.position = "";
        }
      };

      window.addEventListener("pointermove", move, true);
      window.addEventListener("pointerup", up, true);
    };

    item.addEventListener("pointerdown", onPointerDown);
  }

  function runChildHydrators(scope) {
    if (typeof window === "undefined" || !window.Dieter) return;
    const entries = Object.entries(window.Dieter).filter(
      ([name, fn]) =>
        typeof fn === "function" &&
        name.toLowerCase().startsWith("hydrate") &&
        name.toLowerCase() !== "hydrateall" &&
        name.toLowerCase() !== "hydraterepeater"
    );
    entries.forEach(([, fn]) => {
      try {
        fn(scope);
      } catch (err) {
        if (process.env && process.env.NODE_ENV === "development") {
          console.warn("[repeater] child hydrator error", err);
        }
      }
    });
  }

  window.Dieter = {
    ...__prevDieter,
    hydrateRepeater,
  };
})();
