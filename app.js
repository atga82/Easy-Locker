const botonMenu = document.querySelector("#botonMenu");
const navegacion = document.querySelector("#navegacion");

if (botonMenu && navegacion) {
    botonMenu.addEventListener("click", () => {
        navegacion.classList.toggle("abierto");
    });
}

const formRegistro = document.querySelector("#formRegistro");

if (formRegistro) {
    formRegistro.addEventListener("submit", (evento) => {
        evento.preventDefault();

        const nombre = document.querySelector("#nombre").value.trim();
        const apellidos = document.querySelector("#apellidos").value.trim();
        const correo = document.querySelector("#correo").value.trim();
        const facultad = document.querySelector("#facultad").value;
        const contrasena = document.querySelector("#contrasena").value;
        const confirmar = document.querySelector("#confirmar").value;
        const mensaje = document.querySelector("#mensajeRegistro");

        if (contrasena !== confirmar) {
            mensaje.textContent = "Las contraseñas no coinciden.";
            return;
        }

        localStorage.setItem("easyLockerUsuario", JSON.stringify({
            nombre: `${nombre} ${apellidos}`,
            correo,
            facultad
        }));

        mensaje.textContent = "Registro de demostración completado correctamente.";
        formRegistro.reset();
    });
}

const pisoSelect = document.querySelector("#piso");
const edificioSelect = document.querySelector("#edificio");
const filasCasilleros = document.querySelector("#filasCasilleros");
const tituloPiso = document.querySelector("#tituloPiso");
const casilleroSeleccionado = document.querySelector("#casilleroSeleccionado");
const continuarCasillero = document.querySelector("#continuarCasillero");

const ocupadosPorPiso = {
    1: [4, 7, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 26, 27, 28, 29, 30, 31],
    2: [3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29],
    3: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23]
};

let seleccionActual = null;

function crearMapa() {
    if (!pisoSelect || !edificioSelect || !filasCasilleros) {
        return;
    }

    const piso = Number(pisoSelect.value);
    const edificio = edificioSelect.value;

    tituloPiso.textContent = `${edificio} · Piso ${piso}`;
    filasCasilleros.innerHTML = "";

    for (let fila = 1; fila <= 4; fila += 1) {
        const filaElemento = document.createElement("div");
        const numeroIzquierdo = document.createElement("span");
        const numeroDerecho = document.createElement("span");

        filaElemento.className = "fila-casilleros";
        numeroIzquierdo.className = "numero-fila";
        numeroDerecho.className = "numero-fila";
        numeroIzquierdo.textContent = fila;
        numeroDerecho.textContent = fila;

        filaElemento.appendChild(numeroIzquierdo);

        for (let columna = 1; columna <= 12; columna += 1) {
            const numero = (fila - 1) * 12 + columna;
            const casillero = document.createElement("button");

            casillero.type = "button";
            casillero.className = "casillero";
            casillero.title = `Casillero ${numero}, piso ${piso}`;

            if (ocupadosPorPiso[piso].includes(numero)) {
                casillero.classList.add("ocupado");
                casillero.disabled = true;
            } else {
                casillero.addEventListener("click", () => {
                    document.querySelectorAll(".casillero.seleccionado").forEach((elemento) => {
                        elemento.classList.remove("seleccionado");
                    });

                    casillero.classList.add("seleccionado");

                    seleccionActual = {
                        edificio,
                        piso,
                        fila,
                        columna,
                        numero
                    };

                    const texto = `${edificio} · Piso ${piso} · Casillero ${numero}`;

                    casilleroSeleccionado.textContent = texto;
                    localStorage.setItem("easyLockerCasillero", texto);
                });
            }

            filaElemento.appendChild(casillero);
        }

        filaElemento.appendChild(numeroDerecho);
        filasCasilleros.appendChild(filaElemento);
    }
}

if (pisoSelect && edificioSelect) {
    pisoSelect.addEventListener("change", crearMapa);
    edificioSelect.addEventListener("change", crearMapa);
    crearMapa();
}

if (continuarCasillero) {
    continuarCasillero.addEventListener("click", (evento) => {
        if (!seleccionActual) {
            evento.preventDefault();
            alert("Selecciona primero un casillero disponible.");
        }
    });
}

document.querySelectorAll(".boton-plan").forEach((boton) => {
    boton.addEventListener("click", () => {
        const plan = boton.dataset.plan;
        localStorage.setItem("easyLockerPlan", plan);

        const mensaje = document.querySelector("#mensajePlan");

        if (mensaje) {
            mensaje.textContent = `Has seleccionado: ${plan}.`;
        }
    });
});

const usuarioGuardado = JSON.parse(localStorage.getItem("easyLockerUsuario") || "null");
const casilleroGuardado = localStorage.getItem("easyLockerCasillero");
const planGuardado = localStorage.getItem("easyLockerPlan");

if (usuarioGuardado) {
    const cuentaNombre = document.querySelector("#cuentaNombre");
    const cuentaCorreo = document.querySelector("#cuentaCorreo");
    const cuentaFacultad = document.querySelector("#cuentaFacultad");

    if (cuentaNombre) {
        cuentaNombre.textContent = usuarioGuardado.nombre;
    }

    if (cuentaCorreo) {
        cuentaCorreo.textContent = usuarioGuardado.correo;
    }

    if (cuentaFacultad) {
        cuentaFacultad.textContent = usuarioGuardado.facultad;
    }
}

if (casilleroGuardado) {
    const cuentaCasillero = document.querySelector("#cuentaCasillero");

    if (cuentaCasillero) {
        cuentaCasillero.textContent = casilleroGuardado;
    }
}

if (planGuardado) {
    const cuentaPlan = document.querySelector("#cuentaPlan");

    if (cuentaPlan) {
        cuentaPlan.textContent = planGuardado;
    }
}
