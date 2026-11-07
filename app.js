/* Super: anota lo que echas al carro y ve el total en vivo.
   Todo se guarda en el teléfono (localStorage). Sin servidor, sin cuentas. */
(() => {
  "use strict";

  const KEY_COMPRA = "super.compra.v1";
  const KEY_CATALOGO = "super.catalogo.v1";
  const PASO = { un: 1, kg: 0.5 };
  const MAX_PRECIO = 99999999;
  const MAX_CANT = 999;

  // ---------- Formatos (es-CL) ----------
  const fmtPeso = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
  const fmtMiles = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
  const fmtCant = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 });
  const fmtFecha = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" });

  const peso = (n) => fmtPeso.format(Math.round(n || 0));
  const cant = (n) => fmtCant.format(n);
  const lineaTotal = (it) => Math.round(it.qty * it.price);

  const soloDigitos = (s) => String(s || "").replace(/\D/g, "");
  const leerPrecio = (s) => {
    const n = parseInt(soloDigitos(s), 10);
    return Number.isFinite(n) ? n : 0;
  };
  const leerCant = (s) => {
    const n = parseFloat(String(s || "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const redondear = (n) => Math.round(n * 1000) / 1000;
  const normalizar = (s) => s.trim().toLocaleLowerCase("es-CL").replace(/\s+/g, " ");
  const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

  // ---------- Almacenamiento ----------
  const leerJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const guardarJSON = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      mostrarAviso("No se pudo guardar en este teléfono. Revisa el espacio disponible.");
    }
  };

  const estadoInicial = () => ({ items: [], budget: null, startedAt: Date.now() });
  let estado = leerJSON(KEY_COMPRA, null);
  if (!estado || !Array.isArray(estado.items)) estado = estadoInicial();
  estado.items = estado.items.filter((it) => it && typeof it.price === "number" && typeof it.qty === "number");

  let catalogo = leerJSON(KEY_CATALOGO, {});
  if (!catalogo || typeof catalogo !== "object") catalogo = {};

  const guardarEstado = () => guardarJSON(KEY_COMPRA, estado);

  // ---------- Elementos ----------
  const $ = (id) => document.getElementById(id);
  const form = $("composer");
  const fNombre = $("f-nombre");
  const fCant = $("f-cant");
  const fPrecio = $("f-precio");
  const lblPrecio = $("lbl-precio");
  const preview = $("preview");
  const btnGuardar = $("btn-guardar");
  const editActions = $("edit-actions");
  const errPrecio = $("err-precio");
  const errCant = $("err-cant");
  const lista = $("lista");
  const vacio = $("vacio");
  const totalEl = $("total");
  const conteoEl = $("conteo");
  const presInfo = $("presupuesto-info");
  const toast = $("toast");
  const toastMsg = $("toast-msg");
  const toastUndo = $("toast-undo");
  const datalist = $("catalogo");
  const unitBtns = Array.from(document.querySelectorAll(".unit__opt"));

  let unidad = "un";
  let editandoId = null;
  let ultimoTotal = null;

  // ---------- Formulario ----------
  function setUnidad(u) {
    unidad = u === "kg" ? "kg" : "un";
    unitBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.unit === unidad)));
    lblPrecio.textContent = unidad === "kg" ? "Precio por kilo" : "Precio unitario";
    actualizarPreview();
  }

  function actualizarPreview() {
    const total = Math.round(leerCant(fCant.value) * leerPrecio(fPrecio.value));
    preview.textContent = peso(total);
  }

  function limpiarErrores() {
    [errPrecio, errCant].forEach((e) => { e.hidden = true; e.textContent = ""; });
    [fPrecio, fCant].forEach((i) => i.removeAttribute("aria-invalid"));
  }

  function marcarError(input, el, msg) {
    input.setAttribute("aria-invalid", "true");
    el.textContent = msg;
    el.hidden = false;
  }

  function resetForm() {
    form.reset();
    fCant.value = "1";
    setUnidad("un");
    limpiarErrores();
    editandoId = null;
    form.classList.remove("is-editing");
    editActions.hidden = true;
    btnGuardar.textContent = "Agregar al carro";
    actualizarPreview();
    lista.querySelectorAll(".is-selected").forEach((el) => el.classList.remove("is-selected"));
  }

  fPrecio.addEventListener("input", () => {
    const d = soloDigitos(fPrecio.value).slice(0, 8);
    fPrecio.value = d ? fmtMiles.format(Number(d)) : "";
    if (fPrecio.hasAttribute("aria-invalid")) limpiarErrores();
    actualizarPreview();
  });

  fCant.addEventListener("input", () => {
    // dígitos y una sola coma decimal
    let v = fCant.value.replace(/\./g, ",").replace(/[^\d,]/g, "");
    const i = v.indexOf(",");
    if (i !== -1) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/,/g, "").slice(0, 3);
    fCant.value = v.slice(0, 7);
    if (fCant.hasAttribute("aria-invalid")) limpiarErrores();
    actualizarPreview();
  });
  fCant.addEventListener("focus", () => fCant.select());

  function pasoCantidad(dir) {
    const paso = PASO[unidad];
    let q = leerCant(fCant.value);
    if (dir < 0 && q - paso < paso) q = q > paso ? paso : q;
    else q = redondear(q + dir * paso);
    q = Math.min(MAX_CANT, Math.max(0, q));
    fCant.value = q ? cant(q) : "";
    limpiarErrores();
    actualizarPreview();
  }
  $("btn-menos").addEventListener("click", () => pasoCantidad(-1));
  $("btn-mas").addEventListener("click", () => pasoCantidad(1));

  unitBtns.forEach((b) => b.addEventListener("click", () => setUnidad(b.dataset.unit)));

  // Recordar precios: al elegir un producto ya comprado, se completa su último precio
  function completarDesdeCatalogo(sobrescribir) {
    const entrada = catalogo[normalizar(fNombre.value)];
    if (!entrada) return;
    fNombre.value = entrada.name;
    if (!sobrescribir && fPrecio.value) return;
    fPrecio.value = fmtMiles.format(entrada.price);
    setUnidad(entrada.unit);
    actualizarPreview();
  }
  fNombre.addEventListener("input", (e) => {
    // Elegir una sugerencia de la lista dispara un input sin inputType o de reemplazo
    if (!e.inputType || e.inputType === "insertReplacementText") completarDesdeCatalogo(true);
  });
  fNombre.addEventListener("change", () => completarDesdeCatalogo(false));

  function recordarEnCatalogo(it) {
    catalogo[normalizar(it.name)] = { name: it.name, price: it.price, unit: it.unit, t: Date.now() };
    const claves = Object.keys(catalogo);
    if (claves.length > 300) {
      claves.sort((a, b) => catalogo[a].t - catalogo[b].t).slice(0, claves.length - 300).forEach((k) => delete catalogo[k]);
    }
    guardarJSON(KEY_CATALOGO, catalogo);
    pintarCatalogo();
  }

  function pintarCatalogo() {
    const frag = document.createDocumentFragment();
    Object.values(catalogo)
      .sort((a, b) => b.t - a.t)
      .forEach((c) => {
        const o = document.createElement("option");
        o.value = c.name;
        frag.appendChild(o);
      });
    datalist.replaceChildren(frag);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    limpiarErrores();

    const precio = leerPrecio(fPrecio.value);
    const q = redondear(leerCant(fCant.value));

    if (!precio) {
      marcarError(fPrecio, errPrecio, "Falta el precio. Escríbelo tal como sale en el fleje.");
      fPrecio.focus();
      return;
    }
    if (precio > MAX_PRECIO) {
      marcarError(fPrecio, errPrecio, "Ese precio es demasiado alto. Revisa los ceros.");
      fPrecio.focus();
      return;
    }
    if (!q || q > MAX_CANT) {
      marcarError(fCant, errCant, unidad === "kg" ? "Indica cuántos kilos llevas, por ejemplo 0,5." : "Indica cuántas unidades llevas.");
      fCant.focus();
      return;
    }

    let nombre = fNombre.value.trim().replace(/\s+/g, " ");
    let idDestacar;

    if (editandoId) {
      const it = estado.items.find((x) => x.id === editandoId);
      if (it) {
        it.name = nombre || it.name;
        it.qty = q;
        it.unit = unidad;
        it.price = precio;
        idDestacar = it.id;
        recordarEnCatalogo(it);
      }
    } else {
      // Si el mismo producto (nombre, unidad y precio) ya está en el carro, se suma a esa línea
      const igual = nombre && estado.items.find((x) => normalizar(x.name) === normalizar(nombre) && x.unit === unidad && x.price === precio);
      if (igual) {
        igual.qty = Math.min(MAX_CANT, redondear(igual.qty + q));
        estado.items = [igual, ...estado.items.filter((x) => x !== igual)];
        idDestacar = igual.id;
        recordarEnCatalogo(igual);
      } else {
        if (!nombre) nombre = `Producto ${estado.items.length + 1}`;
        const it = { id: nuevoId(), name: nombre, qty: q, unit: unidad, price: precio, at: Date.now() };
        estado.items.unshift(it);
        idDestacar = it.id;
        recordarEnCatalogo(it);
      }
      if (navigator.vibrate) navigator.vibrate(12);
    }

    guardarEstado();
    resetForm();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    render(idDestacar);
  });

  $("btn-cancelar").addEventListener("click", resetForm);

  $("btn-eliminar").addEventListener("click", () => {
    const idx = estado.items.findIndex((x) => x.id === editandoId);
    if (idx === -1) return resetForm();
    const [quitado] = estado.items.splice(idx, 1);
    guardarEstado();
    resetForm();
    render();
    mostrarAviso(`Quitaste ${quitado.name}`, () => {
      estado.items.splice(Math.min(idx, estado.items.length), 0, quitado);
      guardarEstado();
      render(quitado.id);
    });
  });

  function editar(id) {
    const it = estado.items.find((x) => x.id === id);
    if (!it) return;
    limpiarErrores();
    editandoId = id;
    fNombre.value = it.name;
    setUnidad(it.unit);
    fCant.value = cant(it.qty);
    fPrecio.value = fmtMiles.format(it.price);
    actualizarPreview();
    form.classList.add("is-editing");
    editActions.hidden = false;
    btnGuardar.textContent = "Guardar cambios";
    lista.querySelectorAll(".item").forEach((el) => el.classList.toggle("is-selected", el.dataset.id === id));
    form.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  // ---------- Lista y totales ----------
  function render(idDestacar) {
    const frag = document.createDocumentFragment();
    estado.items.forEach((it) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "item";
      b.dataset.id = it.id;
      if (it.id === editandoId) b.classList.add("is-selected");
      if (it.id === idDestacar) b.classList.add("is-new");

      const nombre = document.createElement("span");
      nombre.className = "item__name";
      nombre.textContent = it.name;

      const total = document.createElement("span");
      total.className = "item__line";
      total.textContent = peso(lineaTotal(it));

      const calc = document.createElement("span");
      calc.className = "item__calc";
      calc.textContent = `${cant(it.qty)} ${it.unit} × ${peso(it.price)}`;

      b.setAttribute("aria-label", `${it.name}, ${cant(it.qty)} ${it.unit === "kg" ? "kilos" : "unidades"} a ${peso(it.price)}, total ${peso(lineaTotal(it))}. Tocar para editar`);
      b.append(nombre, total, calc);
      b.addEventListener("click", () => editar(it.id));
      li.appendChild(b);
      frag.appendChild(li);
    });
    lista.replaceChildren(frag);
    vacio.hidden = estado.items.length > 0;

    const total = estado.items.reduce((s, it) => s + lineaTotal(it), 0);
    const articulos = estado.items.reduce((s, it) => s + (it.unit === "kg" ? 1 : it.qty), 0);
    totalEl.textContent = peso(total);
    conteoEl.textContent = `${cant(articulos)} ${articulos === 1 ? "artículo" : "artículos"}`;

    if (ultimoTotal !== null && ultimoTotal !== total) {
      totalEl.classList.remove("is-bump");
      void totalEl.offsetWidth; // reinicia la animación
      totalEl.classList.add("is-bump");
    }
    ultimoTotal = total;

    if (estado.budget) {
      const resto = estado.budget - total;
      presInfo.hidden = false;
      presInfo.classList.toggle("is-over", resto < 0);
      presInfo.replaceChildren();
      const fuerte = document.createElement("strong");
      if (resto >= 0) {
        fuerte.textContent = peso(resto);
        presInfo.append("Te quedan ", fuerte, ` de ${peso(estado.budget)}`);
      } else {
        fuerte.textContent = peso(-resto);
        presInfo.append("Te pasaste por ", fuerte, ` de ${peso(estado.budget)}`);
      }
    } else {
      presInfo.hidden = true;
    }
    $("fecha").textContent = fmtFecha.format(new Date(estado.startedAt || Date.now()));
  }
  totalEl.addEventListener("animationend", () => totalEl.classList.remove("is-bump"));

  // ---------- Aviso con deshacer ----------
  let toastTimer;
  let toastAccion = null;
  function mostrarAviso(msg, deshacer) {
    clearTimeout(toastTimer);
    toastMsg.textContent = msg;
    toastAccion = deshacer || null;
    toastUndo.hidden = !deshacer;
    toast.hidden = false;
    toastTimer = setTimeout(ocultarAviso, deshacer ? 6000 : 3000);
  }
  function ocultarAviso() {
    toast.hidden = true;
    toastAccion = null;
  }
  toastUndo.addEventListener("click", () => {
    const fn = toastAccion;
    ocultarAviso();
    if (fn) fn();
  });

  // ---------- Menú y diálogos ----------
  const dlgMenu = $("dlg-menu");
  const dlgPres = $("dlg-presupuesto");
  const dlgNueva = $("dlg-nueva");
  const fPres = $("f-presupuesto");

  // Cerrar una hoja tocando fuera de ella
  [dlgMenu, dlgPres, dlgNueva].forEach((d) => {
    d.addEventListener("click", (e) => { if (e.target === d) d.close("cerrar"); });
  });

  $("btn-menu").addEventListener("click", () => {
    dlgMenu.returnValue = "";
    dlgMenu.showModal();
  });

  dlgMenu.addEventListener("close", () => {
    const v = dlgMenu.returnValue;
    if (v === "presupuesto") abrirPresupuesto();
    else if (v === "compartir") compartir();
    else if (v === "nueva") pedirNuevaCompra();
  });

  function abrirPresupuesto() {
    fPres.value = estado.budget ? fmtMiles.format(estado.budget) : "";
    $("btn-quitar-pres").hidden = !estado.budget;
    dlgPres.returnValue = "";
    dlgPres.showModal();
  }
  fPres.addEventListener("input", () => {
    const d = soloDigitos(fPres.value).slice(0, 9);
    fPres.value = d ? fmtMiles.format(Number(d)) : "";
  });
  fPres.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); dlgPres.close("guardar"); }
  });
  dlgPres.addEventListener("close", () => {
    const v = dlgPres.returnValue;
    if (v === "guardar") estado.budget = leerPrecio(fPres.value) || null;
    else if (v === "quitar") estado.budget = null;
    else return;
    guardarEstado();
    render();
  });

  function pedirNuevaCompra() {
    if (!estado.items.length) {
      estado.startedAt = Date.now();
      guardarEstado();
      render();
      mostrarAviso("El carro ya está vacío");
      return;
    }
    const n = estado.items.length;
    const total = estado.items.reduce((s, it) => s + lineaTotal(it), 0);
    $("nueva-texto").textContent = `Se quitarán ${n} ${n === 1 ? "producto" : "productos"} por ${peso(total)}. Tu presupuesto y los precios recordados se mantienen.`;
    dlgNueva.returnValue = "";
    dlgNueva.showModal();
  }
  dlgNueva.addEventListener("close", () => {
    if (dlgNueva.returnValue !== "confirmar") return;
    const anterior = { items: estado.items.slice(), startedAt: estado.startedAt };
    estado.items = [];
    estado.startedAt = Date.now();
    guardarEstado();
    resetForm();
    render();
    mostrarAviso("Carro vaciado", () => {
      estado.items = anterior.items;
      estado.startedAt = anterior.startedAt;
      guardarEstado();
      render();
    });
  });

  async function compartir() {
    if (!estado.items.length) {
      mostrarAviso("Agrega productos antes de compartir");
      return;
    }
    const total = estado.items.reduce((s, it) => s + lineaTotal(it), 0);
    const lineas = estado.items
      .slice()
      .reverse()
      .map((it) => `${cant(it.qty)} ${it.unit} ${it.name}: ${peso(lineaTotal(it))}`);
    const texto = [`Compra del super, ${fmtFecha.format(new Date(estado.startedAt))}`, "", ...lineas, "", `Total: ${peso(total)}`].join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: "Compra del super", text: texto });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(texto);
      mostrarAviso("Lista copiada. Pégala donde quieras.");
    } catch {
      mostrarAviso("Este navegador no permite compartir ni copiar.");
    }
  }

  // ---------- Inicio ----------
  // El fleje fijo cambia de alto (presupuesto, pantalla); la lista deja espacio para no quedar tapada
  const dock = document.querySelector(".dock");
  const medirDock = () => document.documentElement.style.setProperty("--dock-h", `${Math.ceil(dock.getBoundingClientRect().height)}px`);
  if ("ResizeObserver" in window) new ResizeObserver(medirDock).observe(dock);
  else window.addEventListener("resize", medirDock);

  pintarCatalogo();
  resetForm();
  render();

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
})();
