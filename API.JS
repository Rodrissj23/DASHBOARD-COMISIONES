const API_URL = "https://script.google.com/macros/s/AKfycbxUd5KwJPLvLYgIfNaFoZY6mXe5FzD20Lf9epeomutVtC33U5qQF4PZijJQGX4JkIZzmA/exec";

/**
 * Obtiene todas las ventas desde Google Sheets
 */
async function obtenerVentas() {
    try {
        const respuesta = await fetch(API_URL, { cache: "no-store" });

        if (!respuesta.ok) {
            throw new Error(`Error HTTP ${respuesta.status}`);
        }

        const datos = await respuesta.json();

        return datos;

    } catch (error) {
        console.error("Error al obtener ventas:", error);
        return [];
    }
}