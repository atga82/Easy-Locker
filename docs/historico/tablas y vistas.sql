
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS easy_locker
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE easy_locker;


CREATE TABLE IF NOT EXISTS roles (
    id              SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre          VARCHAR(30) NOT NULL,
    descripcion     VARCHAR(150) NULL,
    creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_nombre (nombre)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS facultades (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre          VARCHAR(150) NOT NULL,
    activa          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_facultades_nombre (nombre)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS usuarios (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    rol_id          SMALLINT UNSIGNED NOT NULL,
    facultad_id     INT UNSIGNED NOT NULL,
    nombre          VARCHAR(80) NOT NULL,
    apellidos       VARCHAR(120) NOT NULL,
    matricula       VARCHAR(30) NOT NULL,
    correo          VARCHAR(150) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    estado          ENUM('activo', 'inactivo', 'bloqueado') NOT NULL DEFAULT 'activo',
    creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarios_matricula (matricula),
    UNIQUE KEY uq_usuarios_correo (correo),
    KEY idx_usuarios_facultad (facultad_id),
    KEY idx_usuarios_rol (rol_id),
    CONSTRAINT fk_usuarios_rol
        FOREIGN KEY (rol_id) REFERENCES roles (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_usuarios_facultad
        FOREIGN KEY (facultad_id) REFERENCES facultades (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS edificios (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    facultad_id     INT UNSIGNED NOT NULL,
    nombre          VARCHAR(80) NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_edificio_facultad_nombre (facultad_id, nombre),
    CONSTRAINT fk_edificios_facultad
        FOREIGN KEY (facultad_id) REFERENCES facultades (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS pisos (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    edificio_id     INT UNSIGNED NOT NULL,
    numero_piso     TINYINT UNSIGNED NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_piso_edificio_numero (edificio_id, numero_piso),
    CONSTRAINT chk_pisos_numero CHECK (numero_piso >= 1),
    CONSTRAINT fk_pisos_edificio
        FOREIGN KEY (edificio_id) REFERENCES edificios (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS casilleros (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    piso_id         INT UNSIGNED NOT NULL,
    numero          SMALLINT UNSIGNED NOT NULL,
    fila            TINYINT UNSIGNED NOT NULL,
    columna         TINYINT UNSIGNED NOT NULL,
    estado          ENUM('disponible', 'reservado', 'ocupado', 'mantenimiento', 'inactivo')
                    NOT NULL DEFAULT 'disponible',
    creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_casillero_piso_numero (piso_id, numero),
    UNIQUE KEY uq_casillero_piso_posicion (piso_id, fila, columna),
    KEY idx_casilleros_estado (estado),
    CONSTRAINT chk_casilleros_numero CHECK (numero >= 1),
    CONSTRAINT chk_casilleros_fila CHECK (fila >= 1),
    CONSTRAINT chk_casilleros_columna CHECK (columna >= 1),
    CONSTRAINT fk_casilleros_piso
        FOREIGN KEY (piso_id) REFERENCES pisos (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS planes (
    id                  SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre              VARCHAR(80) NOT NULL,
    descripcion         VARCHAR(255) NULL,
    duracion_valor      SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    duracion_unidad     ENUM('dia', 'semestre') NOT NULL,
    precio              DECIMAL(10,2) NOT NULL,
    moneda              CHAR(3) NOT NULL DEFAULT 'MXN',
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_planes_nombre (nombre),
    CONSTRAINT chk_planes_duracion CHECK (duracion_valor > 0),
    CONSTRAINT chk_planes_precio CHECK (precio >= 0)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS rentas (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id          BIGINT UNSIGNED NOT NULL,
    casillero_id        BIGINT UNSIGNED NOT NULL,
    plan_id             SMALLINT UNSIGNED NOT NULL,
    estado              ENUM('pendiente_pago', 'activa', 'finalizada', 'cancelada', 'vencida')
                        NOT NULL DEFAULT 'pendiente_pago',
    precio_total        DECIMAL(10,2) NOT NULL,
    moneda              CHAR(3) NOT NULL DEFAULT 'MXN',
    fecha_solicitud     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_inicio        DATETIME NULL,
    fecha_fin            DATETIME NULL,
    actualizado_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_rentas_usuario_fecha (usuario_id, fecha_solicitud),
    KEY idx_rentas_casillero_estado (casillero_id, estado),
    KEY idx_rentas_plan (plan_id),
    KEY idx_rentas_estado_fecha_fin (estado, fecha_fin),
    CONSTRAINT chk_rentas_precio CHECK (precio_total >= 0),
    CONSTRAINT chk_rentas_fechas CHECK (
        fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio
    ),
    CONSTRAINT fk_rentas_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_rentas_casillero
        FOREIGN KEY (casillero_id) REFERENCES casilleros (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_rentas_plan
        FOREIGN KEY (plan_id) REFERENCES planes (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS pagos (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    renta_id            BIGINT UNSIGNED NOT NULL,
    monto               DECIMAL(10,2) NOT NULL,
    moneda              CHAR(3) NOT NULL DEFAULT 'MXN',
    metodo_pago         ENUM('tarjeta', 'transferencia', 'efectivo', 'otro') NOT NULL DEFAULT 'tarjeta',
    estado              ENUM('pendiente', 'aprobado', 'rechazado', 'cancelado', 'error')
                        NOT NULL DEFAULT 'pendiente',
    proveedor           VARCHAR(60) NULL,
    referencia_externa  VARCHAR(150) NULL,
    pagado_en           DATETIME NULL,
    creado_en           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_pagos_referencia_externa (referencia_externa),
    KEY idx_pagos_renta_estado (renta_id, estado),
    KEY idx_pagos_fecha_estado (pagado_en, estado),
    CONSTRAINT chk_pagos_monto CHECK (monto >= 0),
    CONSTRAINT fk_pagos_renta
        FOREIGN KEY (renta_id) REFERENCES rentas (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS logs_sistema (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usuario_id      BIGINT UNSIGNED NULL,
    nivel           ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL') NOT NULL DEFAULT 'INFO',
    evento          VARCHAR(100) NOT NULL,
    metodo_http     VARCHAR(10) NULL,
    endpoint        VARCHAR(180) NULL,
    mensaje         TEXT NOT NULL,
    contexto_json   JSON NULL,
    creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_logs_nivel_fecha (nivel, creado_en),
    KEY idx_logs_usuario_fecha (usuario_id, creado_en),
    CONSTRAINT fk_logs_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;


INSERT INTO roles (nombre, descripcion) VALUES
    ('estudiante', 'Usuario que solicita y administra rentas de casilleros'),
    ('administrador', 'Usuario que administra inventario, usuarios, rentas y reportes')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

INSERT INTO facultades (nombre) VALUES
    ('Facultad de Ciencias Físico-Matemáticas'),
    ('Facultad de Ingeniería Mecánica y Eléctrica'),
    ('Facultad de Artes Visuales'),
    ('Otra facultad')
ON DUPLICATE KEY UPDATE activa = TRUE;

INSERT INTO planes (nombre, descripcion, duracion_valor, duracion_unidad, precio, moneda, activo) VALUES
    ('Renta diaria', 'Uso del casillero durante un dia.', 1, 'dia', 25.00, 'MXN', TRUE),
    ('Renta semestral', 'Uso del casillero durante un semestre.', 1, 'semestre', 650.00, 'MXN', TRUE)
ON DUPLICATE KEY UPDATE
    descripcion = VALUES(descripcion),
    duracion_valor = VALUES(duracion_valor),
    duracion_unidad = VALUES(duracion_unidad),
    precio = VALUES(precio),
    moneda = VALUES(moneda),
    activo = VALUES(activo);

INSERT INTO edificios (facultad_id, nombre)
SELECT f.id, e.nombre
FROM facultades AS f
CROSS JOIN (
    SELECT 'Edificio A' AS nombre
    UNION ALL SELECT 'Edificio B'
) AS e
WHERE f.nombre IN (
    'Facultad de Ciencias Físico-Matemáticas',
    'Facultad de Ingeniería Mecánica y Eléctrica',
    'Facultad de Artes Visuales'
)
ON DUPLICATE KEY UPDATE activo = TRUE;

INSERT INTO pisos (edificio_id, numero_piso)
SELECT 
    e.id,
    p.numero_piso
FROM edificios AS e
CROSS JOIN (
    SELECT 1 AS numero_piso
    UNION ALL SELECT 2
    UNION ALL SELECT 3
) AS p
WHERE 1 = 1
ON DUPLICATE KEY UPDATE
    activo = TRUE;


INSERT INTO casilleros (piso_id, numero, fila, columna, estado)
SELECT
    p.id,
    n.numero,
    FLOOR((n.numero - 1) / 12) + 1 AS fila,
    MOD(n.numero - 1, 12) + 1 AS columna,
    'disponible'
FROM pisos AS p
CROSS JOIN (
    SELECT (decenas.d * 10) + unidades.u AS numero
    FROM (
        SELECT 0 AS d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL
        SELECT 3 UNION ALL SELECT 4
    ) AS decenas
    CROSS JOIN (
        SELECT 0 AS u UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL
        SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL
        SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
    ) AS unidades
) AS n
WHERE n.numero BETWEEN 1 AND 48
ON DUPLICATE KEY UPDATE
    fila = VALUES(fila),
    columna = VALUES(columna);

CREATE OR REPLACE VIEW vw_historial_rentas AS
SELECT
    r.id AS renta_id,
    u.id AS usuario_id,
    u.matricula,
    CONCAT(u.nombre, ' ', u.apellidos) AS alumno,
    u.correo,
    f.nombre AS facultad,
    e.nombre AS edificio,
    pi.numero_piso,
    c.numero AS numero_casillero,
    c.fila,
    c.columna,
    pl.nombre AS plan,
    r.estado AS estado_renta,
    r.precio_total,
    r.moneda,
    r.fecha_solicitud,
    r.fecha_inicio,
    r.fecha_fin,
    ultimo_pago.estado AS estado_ultimo_pago,
    ultimo_pago.monto AS monto_ultimo_pago
FROM rentas AS r
INNER JOIN usuarios AS u ON u.id = r.usuario_id
INNER JOIN casilleros AS c ON c.id = r.casillero_id
INNER JOIN pisos AS pi ON pi.id = c.piso_id
INNER JOIN edificios AS e ON e.id = pi.edificio_id
INNER JOIN facultades AS f ON f.id = e.facultad_id
INNER JOIN planes AS pl ON pl.id = r.plan_id
LEFT JOIN pagos AS ultimo_pago
    ON ultimo_pago.id = (
        SELECT p2.id
        FROM pagos AS p2
        WHERE p2.renta_id = r.id
        ORDER BY p2.creado_en DESC, p2.id DESC
        LIMIT 1
    );


CREATE OR REPLACE VIEW vw_ocupacion_casilleros AS
SELECT
    f.id AS facultad_id,
    f.nombre AS facultad,
    e.id AS edificio_id,
    e.nombre AS edificio,
    pi.id AS piso_id,
    pi.numero_piso,
    COUNT(c.id) AS total_casilleros,
    COALESCE(SUM(c.estado = 'disponible'), 0) AS disponibles,
    COALESCE(SUM(c.estado = 'reservado'), 0) AS reservados,
    COALESCE(SUM(c.estado = 'ocupado'), 0) AS ocupados,
    COALESCE(SUM(c.estado = 'mantenimiento'), 0) AS mantenimiento,
    COALESCE(SUM(c.estado = 'inactivo'), 0) AS inactivos,
    ROUND(
        100 * (COALESCE(SUM(c.estado = 'reservado'), 0) + COALESCE(SUM(c.estado = 'ocupado'), 0))
        / NULLIF(COUNT(c.id), 0),
        2
    ) AS porcentaje_ocupacion
FROM facultades AS f
INNER JOIN edificios AS e ON e.facultad_id = f.id
INNER JOIN pisos AS pi ON pi.edificio_id = e.id
LEFT JOIN casilleros AS c ON c.piso_id = pi.id
GROUP BY f.id, f.nombre, e.id, e.nombre, pi.id, pi.numero_piso;


CREATE OR REPLACE VIEW vw_ingresos_mensuales AS
SELECT
    DATE_FORMAT(pg.pagado_en, '%Y-%m') AS periodo,
    f.id AS facultad_id,
    f.nombre AS facultad,
    COUNT(pg.id) AS pagos_aprobados,
    COUNT(DISTINCT r.id) AS rentas_pagadas,
    SUM(pg.monto) AS ingresos,
    pg.moneda
FROM pagos AS pg
INNER JOIN rentas AS r ON r.id = pg.renta_id
INNER JOIN casilleros AS c ON c.id = r.casillero_id
INNER JOIN pisos AS pi ON pi.id = c.piso_id
INNER JOIN edificios AS e ON e.id = pi.edificio_id
INNER JOIN facultades AS f ON f.id = e.facultad_id
WHERE pg.estado = 'aprobado'
  AND pg.pagado_en IS NOT NULL
GROUP BY
    DATE_FORMAT(pg.pagado_en, '%Y-%m'),
    f.id,
    f.nombre,
    pg.moneda;


CREATE OR REPLACE VIEW vw_rentas_por_plan AS
SELECT
    pl.id AS plan_id,
    pl.nombre AS plan,
    pl.precio AS precio_actual,
    pl.moneda,
    COUNT(r.id) AS total_rentas,
    COALESCE(SUM(r.estado = 'activa'), 0) AS rentas_activas,
    COALESCE(SUM(r.estado = 'pendiente_pago'), 0) AS rentas_pendientes,
    COALESCE(SUM(r.estado = 'finalizada'), 0) AS rentas_finalizadas,
    COALESCE(SUM(r.estado = 'cancelada'), 0) AS rentas_canceladas,
    COALESCE(SUM(pagos_aprobados.total_pagado), 0.00) AS ingresos_confirmados
FROM planes AS pl
LEFT JOIN rentas AS r ON r.plan_id = pl.id
LEFT JOIN (
    SELECT
        renta_id,
        SUM(monto) AS total_pagado
    FROM pagos
    WHERE estado = 'aprobado'
    GROUP BY renta_id
) AS pagos_aprobados ON pagos_aprobados.renta_id = r.id
GROUP BY pl.id, pl.nombre, pl.precio, pl.moneda;

