const fmtMoney = (n) => "$" + Number(n || 0).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const fmtFecha = (valor) => {
    const d = new Date(valor);
    if (isNaN(d.getTime())) return valor || "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
};

const PORCENTAJE_COMISION = 0.05;
const comisionDe = (v) => (Number(v.liquidable) || 0) * PORCENTAJE_COMISION;

// Meta de comisión para el período en curso. Cambiala acá cuando quieras ajustarla.
const META_MENSUAL = 600000;

function esAprobada(estado) {
    return (estado || "").toString().toLowerCase().includes("aprob");
}

// Clave de agrupamiento: usa el campo "periodo" (columna o nombre de pestaña).
function claveGrupo(v) {
    const p = (v.periodo || "").toString().trim();
    return p || "Sin período";
}

function agruparPorPeriodo(ventas) {
    const grupos = {};
    ventas.forEach(v => {
        const clave = claveGrupo(v);
        if (!grupos[clave]) {
            grupos[clave] = { clave, capitas: 0, comision: 0, cantidad: 0, primeraFecha: new Date(v.fecha) };
        }
        grupos[clave].capitas += Number(v.capitas) || 0;
        grupos[clave].comision += comisionDe(v);
        grupos[clave].cantidad += 1;
        const f = new Date(v.fecha);
        if (!isNaN(f.getTime()) && f < grupos[clave].primeraFecha) {
            grupos[clave].primeraFecha = f;
        }
    });
    return Object.values(grupos).sort((a, b) => a.primeraFecha - b.primeraFecha);
}

function variacionHTML(actual, anterior) {
    if (!anterior || anterior.comision <= 0) return "";
    const pct = ((actual.comision - anterior.comision) / anterior.comision) * 100;
    const subio = pct >= 0;
    const flecha = subio ? "▲" : "▼";
    return `<div class="variacion ${subio ? "up" : "down"}">${flecha} ${Math.abs(Math.round(pct))}% vs. ${anterior.clave}</div>`;
}

// ---- Estado global de la app ----
let TODAS_APROBADAS = [];
let TODOS_PERIODOS = [];
let FILTRO_ACTUAL = null; // null = vista general, o clave de período
let TEXTO_BUSQUEDA = "";

function renderCards(periodos, totalGeneral) {
    const cont = document.getElementById("cards");
    cont.innerHTML = "";
    cont.classList.remove("single");

    if (FILTRO_ACTUAL) {
        const idxP = periodos.findIndex(x => x.clave === FILTRO_ACTUAL);
        const p = periodos[idxP];
        const anterior = idxP > 0 ? periodos[idxP - 1] : null;
        cont.classList.add("single");
        if (!p) {
            cont.innerHTML = `<div class="empty">No hay ventas para este período.</div>`;
            return;
        }
        cont.insertAdjacentHTML("beforeend", `
          <div class="card">
            <div class="card-top">
              <span class="card-label">${p.clave}</span>
              <span class="card-icon icon-teal">🗂️</span>
            </div>
            <div class="card-body">
              <span class="card-count">${p.capitas}</span>
              <div class="card-money-wrap">
                <span class="card-money">${fmtMoney(p.comision)}</span>
                <span class="card-caption">Cápitas · Tu comisión (5%)</span>
              </div>
            </div>
            ${variacionHTML(p, anterior)}
          </div>
        `);
        return;
    }

    const ultimosDos = periodos.slice(-2);
    const actual = ultimosDos[ultimosDos.length - 1];
    const anterior = ultimosDos.length > 1 ? ultimosDos[0] : null;
    const iconos = [
        { icon: "icon-orange", fill: "fill-orange", emoji: "📅" },
        { icon: "icon-teal", fill: "fill-teal", emoji: "📈" }
    ];
    const maxValor = Math.max(...ultimosDos.map(p => p.comision), 1);

    ultimosDos.forEach((periodo, i) => {
        const pct = Math.min(100, (periodo.comision / maxValor) * 100);
        const esActual = periodo === actual;
        cont.insertAdjacentHTML("beforeend", `
          <div class="card">
            <div class="card-top">
              <span class="card-label">${periodo.clave}</span>
              <span class="card-icon ${iconos[i].icon}">${iconos[i].emoji}</span>
            </div>
            <div class="card-body">
              <span class="card-count">${periodo.capitas}</span>
              <div class="card-money-wrap">
                <span class="card-money">${fmtMoney(periodo.comision)}</span>
                <span class="card-caption">Cápitas · Tu comisión (5%)</span>
              </div>
            </div>
            <div class="bar-track"><div class="bar-fill ${iconos[i].fill}" style="width:${pct}%"></div></div>
            ${esActual ? variacionHTML(actual, anterior) : ""}
          </div>
        `);
    });

    // Tarjeta de promedio por liquidación (reemplaza al viejo "Total Acumulado")
    const promedio = periodos.length > 0 ? totalGeneral.comision / periodos.length : 0;
    const promedioCapitas = periodos.length > 0 ? Math.round(totalGeneral.capitas / periodos.length) : 0;
    cont.insertAdjacentHTML("beforeend", `
      <div class="card">
        <div class="card-top">
          <span class="card-label">Promedio por Liquidación</span>
          <span class="card-icon icon-purple">Σ</span>
        </div>
        <div class="card-body">
          <span class="card-count">${promedioCapitas}</span>
          <div class="card-money-wrap">
            <span class="card-money">${fmtMoney(promedio)}</span>
            <span class="card-caption">Cápitas prom. · Comisión promedio</span>
          </div>
        </div>
      </div>
    `);

    // Tarjeta de meta mensual, medida contra el período más reciente
    if (actual) {
        const pctMeta = Math.min(100, (actual.comision / META_MENSUAL) * 100);
        cont.insertAdjacentHTML("beforeend", `
          <div class="card">
            <div class="card-top">
              <span class="card-label">Meta del Período</span>
              <span class="card-icon icon-orange">🎯</span>
            </div>
            <div class="card-body">
              <span class="card-money">${fmtMoney(actual.comision)}</span>
            </div>
            <div class="bar-track"><div class="bar-fill fill-orange" style="width:${pctMeta}%"></div></div>
            <div class="meta-info">
              <span>${Math.round(pctMeta)}% de la meta</span>
              <span>Meta: ${fmtMoney(META_MENSUAL)}</span>
            </div>
          </div>
        `);
    }
}

function renderChart(periodos) {
    const contChart = document.getElementById("chart");
    const nota = document.getElementById("chartNote");
    const panelChart = document.getElementById("chartTitulo").closest(".panel");

    if (FILTRO_ACTUAL) {
        panelChart.style.display = "none";
        return;
    }
    panelChart.style.display = "";

    if (periodos.length < 2) {
        contChart.innerHTML = `<div class="empty">Todavía no hay suficientes períodos para graficar.</div>`;
        nota.textContent = "";
        return;
    }

    // Gráfico con TODOS los períodos, no solo los últimos dos
    const anchoPorPunto = 90;
    const h = 150, padX = 34, padY = 24;
    const w = Math.max(260, periodos.length * anchoPorPunto);
    const max = Math.max(...periodos.map(p => p.comision), 1);
    const min = Math.min(...periodos.map(p => p.comision), 0);
    const rango = Math.max(max - min, 1);

    const puntos = periodos.map((p, i) => {
        const x = periodos.length === 1
            ? w / 2
            : padX + (i * (w - padX * 2)) / (periodos.length - 1);
        const y = padY + (1 - (p.comision - min) / rango) * (h - padY * 2);
        return { x, y, p };
    });

    const pathD = puntos.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");

    const circulos = puntos.map(pt => `<circle cx="${pt.x}" cy="${pt.y}" r="5" fill="#0F9D8E"/>`).join("");
    const etiquetasValor = puntos.map(pt => `<text x="${pt.x}" y="${pt.y - 12}" font-size="10" fill="#1B2138" font-weight="700" text-anchor="middle">${fmtMoney(pt.p.comision)}</text>`).join("");
    const etiquetasEje = puntos.map(pt => `<text x="${pt.x}" y="${h}" font-size="9.5" fill="#9AA1B2" text-anchor="middle">${pt.p.clave}</text>`).join("");

    contChart.innerHTML = `
      <div style="overflow-x:auto;">
        <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="min-width:100%;">
          <line x1="${padX}" y1="${h - padY}" x2="${w - padX}" y2="${h - padY}" stroke="#E7E9F0" stroke-width="1"/>
          <path d="${pathD}" stroke="#0F9D8E" stroke-width="2.5" fill="none"/>
          ${circulos}
          ${etiquetasValor}
          ${etiquetasEje}
        </svg>
      </div>
    `;

    const actual = periodos[periodos.length - 1];
    const anterior = periodos.length > 1 ? periodos[periodos.length - 2] : null;
    if (anterior && anterior.comision > 0) {
        const pct = Math.round(((actual.comision - anterior.comision) / anterior.comision) * 100);
        const subio = pct >= 0;
        nota.innerHTML = `${actual.clave} viene <b>${subio ? "un " + pct + "% arriba" : "un " + Math.abs(pct) + "% abajo"}</b> de ${anterior.clave}.`;
    } else {
        nota.textContent = "";
    }
}

function renderTabla(ventas) {
    const tbody = document.getElementById("tableBody");
    const badge = document.getElementById("tableBadge");
    const titulo = document.getElementById("tablaTitulo");

    titulo.textContent = FILTRO_ACTUAL ? `Ventas · ${FILTRO_ACTUAL}` : "Últimas Ventas Aprobadas";

    let filtradas = FILTRO_ACTUAL
        ? ventas.filter(v => claveGrupo(v) === FILTRO_ACTUAL)
        : ventas;

    if (TEXTO_BUSQUEDA.trim()) {
        const q = TEXTO_BUSQUEDA.trim().toLowerCase();
        filtradas = filtradas.filter(v =>
            (v.nombre || "").toString().toLowerCase().includes(q) ||
            (v.dni || "").toString().toLowerCase().includes(q)
        );
    }

    if (filtradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty">No hay ventas aprobadas para mostrar.</td></tr>`;
        badge.textContent = "0 ventas";
        return;
    }

    const ordenadas = [...filtradas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    badge.textContent = `${ordenadas.length} ventas · comisión 5%`;

    tbody.innerHTML = ordenadas.map((v, i) => `
      <tr>
        <td class="num-cell">${String(i + 1).padStart(2, "0")}</td>
        <td>
          <div class="titular">${v.nombre || "-"}</div>
          <div class="dni">${v.dni || "-"}</div>
        </td>
        <td>${fmtMoney(v.valorPlan)}</td>
        <td>${v.capitas ?? "-"}</td>
        <td>${fmtFecha(v.fecha)}</td>
        <td class="money-cell">${fmtMoney(comisionDe(v))}</td>
        <td><span class="pill ${esAprobada(v.estado) ? "pill-aprobada" : "pill-otro"}">${(v.estado || "-").toString().toUpperCase()}</span></td>
      </tr>
    `).join("");
}

function renderMenu(periodos) {
    const grid = document.getElementById("menuGrid");

    if (periodos.length === 0) {
        grid.innerHTML = `<div class="empty">Todavía no hay períodos cargados en la planilla.</div>`;
        return;
    }

    const ordenMenu = [...periodos].reverse();

    grid.innerHTML = ordenMenu.map(p => `
      <button class="menu-card" data-clave="${p.clave.replace(/"/g, '&quot;')}">
        <div class="clave">${p.clave}</div>
        <div class="monto">${fmtMoney(p.comision)}</div>
        <div class="detalle">${p.cantidad} ventas · ${p.capitas} cápitas</div>
      </button>
    `).join("");

    grid.querySelectorAll(".menu-card").forEach(btn => {
        btn.addEventListener("click", () => {
            seleccionarPeriodo(btn.getAttribute("data-clave"));
        });
    });
}

function renderTodo() {
    const totalGeneral = TODAS_APROBADAS.reduce((acc, v) => {
        acc.capitas += Number(v.capitas) || 0;
        acc.comision += comisionDe(v);
        return acc;
    }, { capitas: 0, comision: 0 });

    if (TODOS_PERIODOS.length === 0) {
        document.getElementById("cards").innerHTML = `<div class="empty">No hay ventas aprobadas todavía.</div>`;
    } else {
        renderCards(TODOS_PERIODOS, totalGeneral);
    }
    renderChart(TODOS_PERIODOS);
    renderTabla(TODAS_APROBADAS);
    renderMenu(TODOS_PERIODOS);
}

function actualizarChip() {
    const chip = document.getElementById("chipFiltro");
    const texto = document.getElementById("chipFiltroTexto");
    if (FILTRO_ACTUAL) {
        chip.style.display = "inline-flex";
        texto.textContent = `Viendo: ${FILTRO_ACTUAL}`;
    } else {
        chip.style.display = "none";
    }
}

function mostrarVista(nombre) {
    document.getElementById("vistaDashboard").style.display = nombre === "dashboard" ? "" : "none";
    document.getElementById("vistaMenu").style.display = nombre === "menu" ? "" : "none";
    document.getElementById("btnResumen").classList.toggle("active", nombre === "dashboard");
    document.getElementById("btnLiquidaciones").classList.toggle("active", nombre === "menu");
}

function seleccionarPeriodo(clave) {
    FILTRO_ACTUAL = clave;
    actualizarChip();
    renderTodo();
    mostrarVista("dashboard");
}

function quitarFiltro() {
    FILTRO_ACTUAL = null;
    actualizarChip();
    renderTodo();
}

async function iniciarDashboard() {
    const ventas = await obtenerVentas();
    TODAS_APROBADAS = ventas.filter(v => esAprobada(v.estado));
    TODOS_PERIODOS = agruparPorPeriodo(TODAS_APROBADAS);

    renderTodo();

    document.getElementById("btnResumen").addEventListener("click", () => mostrarVista("dashboard"));
    document.getElementById("btnLiquidaciones").addEventListener("click", () => mostrarVista("menu"));
    document.getElementById("chipFiltroQuitar").addEventListener("click", quitarFiltro);

    document.getElementById("buscador").addEventListener("input", (e) => {
        TEXTO_BUSQUEDA = e.target.value;
        renderTabla(TODAS_APROBADAS);
    });
}

document.addEventListener("DOMContentLoaded", iniciarDashboard);
