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

function esAprobada(estado) {
    return (estado || "").toString().toLowerCase().includes("aprob");
}

// Clave de agrupamiento: usa el campo "periodo" cargado a mano en la planilla.
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

// ---- Estado global de la app ----
let TODAS_APROBADAS = [];
let TODOS_PERIODOS = [];
let FILTRO_ACTUAL = null; // null = vista general, o clave de período

function renderCards(periodos, totalGeneral) {
    const cont = document.getElementById("cards");
    cont.innerHTML = "";
    cont.classList.remove("single");

    if (FILTRO_ACTUAL) {
        const p = periodos.find(x => x.clave === FILTRO_ACTUAL);
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
          </div>
        `);
        return;
    }

    const ultimosDos = periodos.slice(-2);
    const iconos = [
        { icon: "icon-orange", fill: "fill-orange", emoji: "📅" },
        { icon: "icon-teal", fill: "fill-teal", emoji: "📈" }
    ];
    const maxValor = Math.max(totalGeneral.comision, ...ultimosDos.map(p => p.comision), 1);

    ultimosDos.forEach((periodo, i) => {
        const pct = Math.min(100, (periodo.comision / maxValor) * 100);
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
          </div>
        `);
    });

    const pctTotal = Math.min(100, (totalGeneral.comision / maxValor) * 100);
    cont.insertAdjacentHTML("beforeend", `
      <div class="card">
        <div class="card-top">
          <span class="card-label">Total Acumulado</span>
          <span class="card-icon icon-purple">Σ</span>
        </div>
        <div class="card-body">
          <span class="card-count">${totalGeneral.capitas}</span>
          <div class="card-money-wrap">
            <span class="card-money">${fmtMoney(totalGeneral.comision)}</span>
            <span class="card-caption">Cápitas · Tu comisión (5%)</span>
          </div>
        </div>
        <div class="bar-track"><div class="bar-fill fill-purple" style="width:${pctTotal}%"></div></div>
      </div>
    `);
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

    const ultimosDos = periodos.slice(-2);

    if (ultimosDos.length < 2) {
        contChart.innerHTML = `<div class="empty">Todavía no hay suficientes períodos para graficar.</div>`;
        nota.textContent = "";
        return;
    }

    const [p1, p2] = ultimosDos;
    const w = 260, h = 140, padX = 34, padY = 24;
    const max = Math.max(p1.comision, p2.comision, 1);
    const y1 = padY + (1 - p1.comision / max) * (h - padY * 2);
    const y2 = padY + (1 - p2.comision / max) * (h - padY * 2);
    const x1 = padX, x2 = w - padX;

    contChart.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
        <line x1="${x1}" y1="${h - padY}" x2="${x2}" y2="${h - padY}" stroke="#E7E9F0" stroke-width="1"/>
        <line x1="${x1}" y1="${padY - 10}" x2="${x1}" y2="${h - padY}" stroke="#E7E9F0" stroke-width="1"/>
        <path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="#0F9D8E" stroke-width="2.5" fill="none"/>
        <circle cx="${x1}" cy="${y1}" r="5" fill="#F2994A"/>
        <circle cx="${x2}" cy="${y2}" r="5" fill="#0F9D8E"/>
        <text x="${x1}" y="${y1 - 12}" font-size="11" fill="#1B2138" font-weight="700">${fmtMoney(p1.comision)}</text>
        <text x="${x2}" y="${y2 - 12}" font-size="11" fill="#1B2138" font-weight="700" text-anchor="end">${fmtMoney(p2.comision)}</text>
        <text x="${x1}" y="${h}" font-size="10" fill="#9AA1B2">${p1.clave}</text>
        <text x="${x2}" y="${h}" font-size="10" fill="#9AA1B2" text-anchor="end">${p2.clave}</text>
      </svg>
    `;

    const totalDosPeriodos = p1.comision + p2.comision;
    const pctUltimo = totalDosPeriodos > 0 ? Math.round((p2.comision / totalDosPeriodos) * 100) : 0;
    const totalVentasDosPeriodos = p1.cantidad + p2.cantidad;
    nota.innerHTML = `${p2.clave} concentra <b>el ${pctUltimo}%</b> de tu comisión aprobada hasta el momento (${p2.cantidad} de las ${totalVentasDosPeriodos} ventas del período).`;
}

function renderTabla(ventas) {
    const tbody = document.getElementById("tableBody");
    const badge = document.getElementById("tableBadge");
    const titulo = document.getElementById("tablaTitulo");

    titulo.textContent = FILTRO_ACTUAL ? `Ventas · ${FILTRO_ACTUAL}` : "Últimas Ventas Aprobadas";

    const filtradas = FILTRO_ACTUAL
        ? ventas.filter(v => claveGrupo(v) === FILTRO_ACTUAL)
        : ventas;

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
}

document.addEventListener("DOMContentLoaded", iniciarDashboard);
