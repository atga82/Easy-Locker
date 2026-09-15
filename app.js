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
        const matricula = document.querySelector("#matricula").value.trim();

        if (contrasena !== confirmar) {
            mensaje.textContent = "Las contraseñas no coinciden.";
            return;
        }

        localStorage.setItem("easyLockerUsuario", JSON.stringify({
            nombre,
            apellidos,
            matricula,
            correo,
            facultad,
            contrasena
        }));

       mensaje.textContent = "Registro completado correctamente. Redirigiendo al inicio de sesión...";

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1500);
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
                    
                    const facultadCasillero =
                    document.querySelector("#facultadCasillero");

                if (facultadCasillero) {

                    localStorage.setItem(
                        "easyLockerFacultadCasillero",
                        facultadCasillero.value
                    );

                }
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
        const precio = boton.dataset.precio;
        const casillero =
            localStorage.getItem("easyLockerCasillero");
        const facultad =
            localStorage.getItem(
                "easyLockerFacultadCasillero"
            );
        localStorage.setItem(
            "easyLockerPlan",
            plan
        );
        localStorage.setItem(
            "easyLockerPrecio",
            precio
        );


        if (casillero) {

            const historial = JSON.parse(
                localStorage.getItem(
                    "easyLockerHistorial"
                ) || "[]"
            );


            historial.push({
                facultad:
                    facultad || "Sin seleccionar",
                casillero,
                plan,
                estado: "Activa"

            });

            localStorage.setItem(
                "easyLockerHistorial",
                JSON.stringify(historial)
            );

        }
        window.location.href = "pago.html";

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
        cuentaNombre.textContent =
        `${usuarioGuardado.nombre} ${usuarioGuardado.apellidos}`;
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

const formLogin = document.querySelector("#formLogin");

if (formLogin) {
    formLogin.addEventListener("submit", (evento) => {
        evento.preventDefault();

        const correo = document.querySelector("#loginCorreo").value.trim();
        const mensaje = document.querySelector("#mensajeLogin");

        mensaje.textContent = `Inicio de sesión de demostración para ${correo}.`;

        setTimeout(() => {
            window.location.href = "index.html";
        }, 1200);
    });
}


const formDatos = document.querySelector("#formDatos");
if (formDatos) {
    const usuario = JSON.parse(
        localStorage.getItem("easyLockerUsuario") || "null"
    );
    const nombre = document.querySelector("#datosNombre");
    const apellidos = document.querySelector("#datosApellidos");
    const matricula = document.querySelector("#datosMatricula");
    const correo = document.querySelector("#datosCorreo");
    const facultad = document.querySelector("#datosFacultad");
    const contrasena = document.querySelector("#datosContrasena");
    const confirmar = document.querySelector("#datosConfirmar");
    const mensaje = document.querySelector("#mensajeDatos");

    if (usuario) {
        nombre.value = usuario.nombre || "";
        apellidos.value = usuario.apellidos || "";
        matricula.value = usuario.matricula || "";
        correo.value = usuario.correo || "";
        facultad.value = usuario.facultad || "";
        contrasena.value = usuario.contrasena || "";
        confirmar.value = usuario.contrasena || "";

    }
    formDatos.addEventListener("submit", (evento) => {
        evento.preventDefault();

        if (contrasena.value !== confirmar.value) {
            mensaje.textContent =
                "Las contraseñas no coinciden.";
            return;
        }

        const datosActualizados = {
            nombre: nombre.value.trim(),
            apellidos: apellidos.value.trim(),
            matricula: matricula.value.trim(),
            correo: correo.value.trim(),
            facultad: facultad.value,
            contrasena: contrasena.value
        };


        localStorage.setItem(
            "easyLockerUsuario",
            JSON.stringify(datosActualizados)
        );


        mensaje.textContent =
            "Datos personales actualizados correctamente.";
    });
}


const formPago = document.querySelector("#formPago");
if (formPago) {

    const plan = localStorage.getItem("easyLockerPlan");
    const precio = localStorage.getItem("easyLockerPrecio");
    const pagoPlan = document.querySelector("#pagoPlan");
    const pagoPrecio = document.querySelector("#pagoPrecio");
    const numeroTarjeta =
        document.querySelector("#numeroTarjeta");
    const vencimiento =
        document.querySelector("#vencimiento");
    const cvv =
        document.querySelector("#cvv");
    const mensaje =
        document.querySelector("#mensajePago");


    if (plan) {
        pagoPlan.textContent = plan;
    }

    if (precio) {
        pagoPrecio.textContent = precio;
    }

    numeroTarjeta.addEventListener("input", () => {
        let numero =
            numeroTarjeta.value.replace(/\D/g, "");
        numero = numero.substring(0, 16);

        numeroTarjeta.value =
            numero.replace(/(.{4})/g, "$1 ").trim();
    });

    vencimiento.addEventListener("input", () => {
        let valor =
            vencimiento.value.replace(/\D/g, "");
        valor = valor.substring(0, 4);
        if (valor.length > 2) {
            valor =
                valor.substring(0, 2) +
                "/" +
                valor.substring(2);

        }

        vencimiento.value = valor;
    });

    cvv.addEventListener("input", () => {
        cvv.value =
            cvv.value.replace(/\D/g, "").substring(0, 4);

    });

    formPago.addEventListener("submit", (evento) => {
        evento.preventDefault();
        mensaje.textContent =
            "Pago de demostración realizado correctamente. Redirigiendo...";
        setTimeout(() => {
            window.location.href = "index.html";

        }, 1500);

    });

}

const tablaHistorial =
    document.querySelector("#tablaHistorial");
if (tablaHistorial) {
    const historial = JSON.parse(
        localStorage.getItem(
            "easyLockerHistorial"
        ) || "[]"
    );

    const cantidadRentas =
        document.querySelector("#cantidadRentas");
    const rentaActual =
        document.querySelector("#rentaActual");
    const historialFacultad =
        document.querySelector("#historialFacultad");
    cantidadRentas.textContent =
        historial.length;


    if (historial.length > 0) {
        tablaHistorial.innerHTML = "";
        historial.forEach((renta) => {
            const fila =
                document.createElement("tr");

            fila.innerHTML = ` <td> ${renta.facultad} </td><td>${renta.casillero}</td><td>${renta.plan}</td><td><span class="estado-activo">${renta.estado}</span></td>`;
            tablaHistorial.appendChild(fila);

        });

        const ultimaRenta =
            historial[historial.length - 1];
        rentaActual.textContent =
            ultimaRenta.plan;
        historialFacultad.textContent =
            ultimaRenta.facultad;

    }
}