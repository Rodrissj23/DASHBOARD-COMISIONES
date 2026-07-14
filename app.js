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

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const PORCENTAJE_COMISION = 0.05;
const comisionDe = (v) => (Number(v.liquidable) || 0) * PORCENTAJE_COMISION;

function esAprobada(estado) {
    return (estado || "").toString().toLowerCase().includes("aprob");
}

function claveMes(fecha) {
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function agruparPorMes(ventas) {
    const grupos = {};
    ventas.forEach(v => {
        const clave = claveMes(v.fecha);
        if (!clave) return;
        if (!grupos[clave]) {
            grupos[clave] = { clave, capitas: 0, comision: 0, cantidad: 0, fecha: new Date(v.fecha) };
        }
        grupos[clave].capitas += Number(v.capitas) || 0;
        grupos[clave].comision += comisionDe(v);
        grupos[clave].cantidad += 1;
    });
    return Object.values(grupos).sort((a, b) => a.fecha - b.fecha);
}

function renderCards(meses, totalGeneral) {
    const cont = document.getElementById("cards");
    cont.innerHTML = "";

    const ultimosDos = meses.slice(-2);
    const iconos = [
        { icon: "icon-orange", fill: "fill-orange", emoji: "📅" },
        { icon: "icon-teal", fill: "fill-teal", emoji: "📈" }
    ];
    const maxValor = Math.max(totalGeneral.comision, ...ultimosDos.map(m => m.comision), 1);

    ultimosDos.forEach((mes, i) => {
        const nombreMes = MESES[mes.fecha.getMonth()];
        const anio = mes.fecha.getFullYear();
        const pct = Math.min(100, (mes.comision / maxValor) * 100);
        cont.insertAdjacentHTML("beforeend", `
          <div class="card">
            <div class="card-top">
              <span class="card-label">${nombreMes} ${anio}</span>
              <span class="card-icon ${iconos[i].icon}">${iconos[i].emoji}</span>
            </div>
            <div class="card-body">
              <span class="card-count">${mes.capitas}</span>
              <div class="card-money-wrap">
                <span class="card-money">${fmtMoney(mes.comision)}</span>
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

function renderChart(meses) {
    const contChart = document.getElementById("chart");
    const nota = document.getElementById("chartNote");
    const ultimosDos = meses.slice(-2);

    if (ultimosDos.length < 2) {
        contChart.innerHTML = `<div class="empty">Todavía no hay suficientes meses para graficar.</div>`;
        nota.textContent = "";
        return;
    }

    const [m1, m2] = ultimosDos;
    const w = 260, h = 140, padX = 30, padY = 24;
    const max = Math.max(m1.comision, m2.comision, 1);
    const y1 = padY + (1 - m1.comision / max) * (h - padY * 2);
    const y2 = padY + (1 - m2.comision / max) * (h - padY * 2);
    const x1 = padX, x2 = w - padX;

    contChart.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
        <line x1="${x1}" y1="${h - padY}" x2="${x2}" y2="${h - padY}" stroke="#E7E9F0" stroke-width="1"/>
        <line x1="${x1}" y1="${padY - 10}" x2="${x1}" y2="${h - padY}" stroke="#E7E9F0" stroke-width="1"/>
        <path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="#0F9D8E" stroke-width="2.5" fill="none"/>
        <circle cx="${x1}" cy="${y1}" r="5" fill="#F2994A"/>
        <circle cx="${x2}" cy="${y2}" r="5" fill="#0F9D8E"/>
        <text x="${x1}" y="${y1 - 12}" font-size="11" fill="#1B2138" font-weight="700">${fmtMoney(m1.comision)}</text>
        <text x="${x2}" y="${y2 - 12}" font-size="11" fill="#1B2138" font-weight="700" text-anchor="end">${fmtMoney(m2.comision)}</text>
        <text x="${x1}" y="${h}" font-size="11" fill="#9AA1B2">${MESES[m1.fecha.getMonth()]}</text>
        <text x="${x2}" y="${h}" font-size="11" fill="#9AA1B2" text-anchor="end">${MESES[m2.fecha.getMonth()]}</text>
      </svg>
    `;

    const totalDosMeses = m1.comision + m2.comision;
    const pctUltimo = totalDosMeses > 0 ? Math.round((m2.comision / totalDosMeses) * 100) : 0;
    const totalVentasDosMeses = m1.cantidad + m2.cantidad;
    nota.innerHTML = `${MESES[m2.fecha.getMonth()][0]}${MESES[m2.fecha.getMonth()].slice(1).toLowerCase()} concentra <b>el ${pctUltimo}%</b> de tu comisión aprobada hasta el momento (${m2.cantidad} de las ${totalVentasDosMeses} ventas del período).`;
}

function renderTabla(ventas) {
    const tbody = document.getElementById("tableBody");
    const badge = document.getElementById("tableBadge");

    if (ventas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty">Todavía no hay ventas aprobadas cargadas.</td></tr>`;
        badge.textContent = "0 ventas";
        return;
    }

    const ordenadas = [...ventas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

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

async function iniciarDashboard() {
    const ventas = await obtenerVentas();
    const aprobadas = ventas.filter(v => esAprobada(v.estado));

    const meses = agruparPorMes(aprobadas);

    const totalGeneral = aprobadas.reduce((acc, v) => {
        acc.capitas += Number(v.capitas) || 0;
        acc.comision += comisionDe(v);
        return acc;
    }, { capitas: 0, comision: 0 });

    if (meses.length === 0) {
        document.getElementById("cards").innerHTML = `<div class="empty">No hay ventas aprobadas todavía.</div>`;
    } else {
        renderCards(meses, totalGeneral);
    }

    renderChart(meses);
    renderTabla(aprobadas);
}

document.addEventListener("DOMContentLoaded", iniciarDashboard);
