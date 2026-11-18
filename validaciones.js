// Validaciones de campos de usuario y formato del formulario de pago.
const EasyLockerValidaciones = (() => {
    const limpiar = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    const nombreValido = (value, maximo = 80) => {
        const dato = limpiar(value);
        return dato.length >= 2 && dato.length <= maximo &&
            /^[\p{L}]+(?:[ '\u2019-][\p{L}]+)*$/u.test(dato);
    };
    const matriculaValida = value => typeof value === 'string' && /^\d{6,10}$/.test(value.trim());
    const correoValido = value => typeof value === 'string' && value.length <= 150 &&
        /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value.trim());
    const contrasenaValida = value => typeof value === 'string' && value.length >= 8 &&
        value.length <= 72 && /[A-Za-z]/.test(value) && /\d/.test(value);

    function errorAlumno({ nombre, apellidos, matricula, correo, contrasena }, validarContrasena = false) {
        if (!nombreValido(nombre, 80)) return 'El nombre debe tener de 2 a 80 letras; se permiten espacios, apóstrofes y guiones.';
        if (!nombreValido(apellidos, 120)) return 'Los apellidos deben tener de 2 a 120 letras; se permiten espacios y guiones.';
        if (!matriculaValida(matricula)) return 'La matrícula debe tener entre 6 y 10 dígitos, sin letras ni espacios.';
        if (!correoValido(correo)) return 'Introduce un correo electrónico válido.';
        if (validarContrasena && !contrasenaValida(contrasena)) {
            return 'La contraseña debe tener entre 8 y 72 caracteres e incluir letras y números.';
        }
        return '';
    }

    // La comprobación de formato no verifica la existencia ni disponibilidad de una tarjeta.
    function numeroTarjetaValido(value) {
        if (typeof value !== 'string') return false;
        const digits = value.replace(/\s/g, '');
        if (!/^\d{16}$/.test(digits)) return false;
        // Luhn por sí solo aceptaría secuencias como 0000000000000000.
        if (digits.startsWith('0') || /^(\d)\1{15}$/.test(digits)) return false;
        let suma = 0;
        for (let i = digits.length - 1, alterno = false; i >= 0; i--, alterno = !alterno) {
            let n = Number(digits[i]);
            if (alterno) { n *= 2; if (n > 9) n -= 9; }
            suma += n;
        }
        return suma % 10 === 0;
    }

    function vencimientoValido(value, fecha = new Date()) {
        const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(String(value || '').trim());
        if (!match) return false;
        const mes = Number(match[1]);
        const anio = 2000 + Number(match[2]);
        return anio > fecha.getFullYear() || (anio === fecha.getFullYear() && mes >= fecha.getMonth() + 1);
    }
    const cvcValido = value => /^\d{3}$/.test(String(value || ''));
    function errorTarjeta(datos) {
        if (!nombreValido(datos.titular, 80)) return 'Escribe un nombre de titular válido (solo letras).';
        if (!numeroTarjetaValido(datos.numero)) return 'Introduce un número de tarjeta válido de 16 dígitos.';
        if (!vencimientoValido(datos.vencimiento)) return 'La fecha debe tener formato MM/AA y no estar vencida.';
        if (!cvcValido(datos.cvc)) return 'El CVC debe tener exactamente 3 dígitos.';
        return '';
    }
    return { limpiar, nombreValido, matriculaValida, correoValido, contrasenaValida,
        errorAlumno, numeroTarjetaValido, vencimientoValido, cvcValido, errorTarjeta };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = EasyLockerValidaciones;
if (typeof window !== 'undefined') window.EasyLockerValidaciones = EasyLockerValidaciones;
