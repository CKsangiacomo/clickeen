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
      handle.innerHTML =
        '<span class="diet-btn-ic__icon" data-icon="arrow.up.arrow.down"></span>';

      const body = document.createElement("div");
      body.className = "diet-repeater__item-body";
      body.innerHTML = template.replace(/__INDEX__/g, String(index));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "diet-btn-ic diet-repeater__item-remove";
      remove.setAttribute("data-size", "sm");
      remove.setAttribute("data-variant", "neutral");
      remove.innerHTML = '<span class="diet-btn-ic__icon" data-icon="trash"></span>';
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
