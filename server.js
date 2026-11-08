const crypto = require('crypto');
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');
const app = express();
app.disable('x-powered-by');
app.use(express.json({limit:'20kb'}));
app.use(session({name:'easylocker.sid',secret:process.env.SESSION_SECRET || 'solo-desarrollo-cambiar-esta-clave-antes-de-publicar',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:false,maxAge:1000*60*60*8}}));
const fail = (res,status,mensaje)=>res.status(status).json({mensaje});
const auth = (req,res,next)=>req.session.userId ? next():fail(res,401,'Inicia sesión para continuar.');
const run = handler => (req,res,next)=>Promise.resolve(handler(req,res,next)).catch(next);
const clean = v=>typeof v==='string'?v.trim():'';
const email = v=>clean(v).toLowerCase();
const safeUser = async id=>{const [rows]=await db.execute(`SELECT u.id,u.nombre,u.apellidos,u.matricula,u.correo,u.estado,f.nombre AS facultad,r.nombre AS rol FROM usuarios u JOIN facultades f ON f.id=u.facultad_id JOIN roles r ON r.id=u.rol_id WHERE u.id=?`,[id]);return rows[0];};
app.get('/api/estado',run(async(req,res)=>{const [r]=await db.query('SELECT DATABASE() AS baseDatos');res.json({mensaje:'Servidor funcionando',baseDatos:r[0].baseDatos});}));
app.post('/api/registro',run(async(req,res)=>{
 const {nombre,apellidos,matricula,correo,facultad,contrasena}=req.body;
 if([nombre,apellidos,matricula,correo,facultad,contrasena].some(x=>!clean(x)))return fail(res,400,'Completa todos los campos.');
 if(!/^\S+@\S+\.\S+$/.test(email(correo))||clean(contrasena).length<8)return fail(res,400,'Correo inválido o contraseña menor a 8 caracteres.');
 const [f]=await db.execute('SELECT id FROM facultades WHERE nombre=? AND activa=1',[clean(facultad)]);
 const [r]=await db.execute('SELECT id FROM roles WHERE nombre=?',['estudiante']);
 if(!f.length||!r.length)return fail(res,400,'Facultad o rol no disponible.');
 const hash=await bcrypt.hash(contrasena,12);
 await db.execute('INSERT INTO usuarios (rol_id,facultad_id,nombre,apellidos,matricula,correo,password_hash) VALUES (?,?,?,?,?,?,?)',[r[0].id,f[0].id,clean(nombre),clean(apellidos),clean(matricula),email(correo),hash]);
 res.status(201).json({mensaje:'Cuenta creada. Ahora inicia sesión.'});
}));
app.post('/api/login',run(async(req,res)=>{
 const [r]=await db.execute('SELECT id,password_hash,estado FROM usuarios WHERE correo=? LIMIT 1',[email(req.body.correo)]);
 if(!r.length||!(await bcrypt.compare(String(req.body.contrasena||''),r[0].password_hash)))return fail(res,401,'Correo o contraseña incorrectos.');
 if(r[0].estado!=='activo')return fail(res,403,'Cuenta inactiva.');
 req.session.regenerate(err=>{if(err)return fail(res,500,'Error al iniciar sesión.');req.session.userId=r[0].id;res.json({mensaje:'Sesión iniciada.'});});
}));
app.post('/api/logout',auth,(req,res)=>req.session.destroy(()=>{res.clearCookie('easylocker.sid');res.json({mensaje:'Sesión cerrada.'});}));
app.get('/api/yo',auth,run(async(req,res)=>{const user=await safeUser(req.session.userId);if(!user)return fail(res,401,'Usuario no encontrado.');res.json(user);}));
app.put('/api/yo',auth,run(async(req,res)=>{
 const {nombre,apellidos,matricula,correo,facultad,contrasena}=req.body;
 if([nombre,apellidos,matricula,correo,facultad].some(x=>!clean(x)))return fail(res,400,'Completa tus datos.');
 const [f]=await db.execute('SELECT id FROM facultades WHERE nombre=?',[clean(facultad)]);
 if(!f.length)return fail(res,400,'Facultad inválida.');
 if(contrasena&&contrasena.length<8)return fail(res,400,'La nueva contraseña debe tener 8 caracteres.');
 const params=[clean(nombre),clean(apellidos),clean(matricula),email(correo),f[0].id];
 let sql='UPDATE usuarios SET nombre=?,apellidos=?,matricula=?,correo=?,facultad_id=?';
 if(contrasena){sql+=',password_hash=?';params.push(await bcrypt.hash(contrasena,12));}
 sql+=' WHERE id=?';params.push(req.session.userId);await db.execute(sql,params);res.json({mensaje:'Datos actualizados.'});
}));
app.get('/api/casilleros',run(async(req,res)=>{
 await db.query("UPDATE rentas r JOIN casilleros c ON c.id=r.casillero_id SET r.estado='vencida',c.estado='disponible' WHERE r.estado='activa' AND r.fecha_fin < NOW() AND c.estado='ocupado'");
 await db.query("UPDATE rentas r JOIN casilleros c ON c.id=r.casillero_id SET r.estado='cancelada',c.estado='disponible' WHERE r.estado='pendiente_pago' AND r.fecha_solicitud < NOW() - INTERVAL 15 MINUTE AND c.estado='reservado'");
 const {facultad,edificio,piso}=req.query;
 const [rows]=await db.execute(`SELECT c.id,c.numero,c.fila,c.columna,c.estado,e.nombre AS edificio,p.numero_piso AS piso,f.nombre AS facultad FROM casilleros c JOIN pisos p ON p.id=c.piso_id JOIN edificios e ON e.id=p.edificio_id JOIN facultades f ON f.id=e.facultad_id WHERE f.nombre=? AND e.nombre=? AND p.numero_piso=? AND p.activo=1 AND e.activo=1 ORDER BY c.numero`,[clean(facultad),clean(edificio),Number(piso)||1]);res.json(rows);
}));
app.get('/api/planes',run(async(req,res)=>{const [rows]=await db.query('SELECT id,nombre,precio,moneda,duracion_unidad FROM planes WHERE activo=1 ORDER BY id');res.json(rows);}));
// Una reserva pendiente bloquea el casillero por 15 minutos. Las expiradas se liberan.
async function expirePending(conn){await conn.query(`UPDATE rentas r JOIN casilleros c ON c.id=r.casillero_id SET r.estado='cancelada',c.estado='disponible' WHERE r.estado='pendiente_pago' AND r.fecha_solicitud < NOW() - INTERVAL 15 MINUTE AND c.estado='reservado'`);}
app.post('/api/rentas',auth,run(async(req,res)=>{
 const locker=Number(req.body.casilleroId),plan=Number(req.body.planId);
 if(!Number.isSafeInteger(locker)||!Number.isSafeInteger(plan))return fail(res,400,'Selecciona casillero y plan.');
 const conn=await db.getConnection();try{
 await conn.beginTransaction();await expirePending(conn);
 const [c]=await conn.execute('SELECT id,estado FROM casilleros WHERE id=? FOR UPDATE',[locker]);
 const [p]=await conn.execute('SELECT id,precio,moneda FROM planes WHERE id=? AND activo=1',[plan]);
 if(!c.length||c[0].estado!=='disponible'||!p.length){await conn.rollback();return fail(res,409,'El casillero ya no está disponible o el plan no existe.');}
 const [existing]=await conn.execute(`SELECT id FROM rentas WHERE casillero_id=? AND estado IN ('pendiente_pago','activa') LIMIT 1`,[locker]);
 if(existing.length){await conn.rollback();return fail(res,409,'Este casillero ya está reservado.');}
 const [insert]=await conn.execute('INSERT INTO rentas (usuario_id,casillero_id,plan_id,precio_total,moneda) VALUES (?,?,?,?,?)',[req.session.userId,locker,plan,p[0].precio,p[0].moneda]);
 await conn.execute("UPDATE casilleros SET estado='reservado' WHERE id=?",[locker]);await conn.commit();res.status(201).json({id:insert.insertId,mensaje:'Reserva creada. Completa el pago simulado antes de 15 minutos.'});
 }catch(err){await conn.rollback();throw err;}finally{conn.release();}
}));
// Código de demostración para la renta activa. No controla una cerradura física.
const accessCode = rentId => String(Number.parseInt(crypto.createHmac('sha256',process.env.ACCESS_CODE_SECRET || process.env.SESSION_SECRET || 'easy-locker-demo-local').update(String(rentId)).digest('hex').slice(0,12),16)%1000000).padStart(6,'0');
app.get('/api/mi-acceso',auth,run(async(req,res)=>{
 const [rows]=await db.execute(`SELECT r.id,r.estado,r.fecha_fin,c.numero,e.nombre AS edificio,p.numero_piso AS piso FROM rentas r JOIN casilleros c ON c.id=r.casillero_id JOIN pisos p ON p.id=c.piso_id JOIN edificios e ON e.id=p.edificio_id WHERE r.usuario_id=? AND r.estado='activa' AND r.fecha_fin>NOW() ORDER BY r.fecha_inicio DESC LIMIT 1`,[req.session.userId]);
 if(!rows.length)return res.json({activo:false,mensaje:'El código se mostrará después de confirmar la renta.'});
 const r=rows[0];res.set('Cache-Control','no-store');res.json({activo:true,codigo:accessCode(r.id),numero:r.numero,edificio:r.edificio,piso:r.piso,vence:r.fecha_fin,nota:'Código de demostración; no abre una cerradura física.'});
}));
app.get('/api/rentas',auth,run(async(req,res)=>{
 await db.query("UPDATE rentas r JOIN casilleros c ON c.id=r.casillero_id SET r.estado='vencida',c.estado='disponible' WHERE r.estado='activa' AND r.fecha_fin < NOW() AND c.estado='ocupado'");
 const [rows]=await db.execute(`SELECT r.id,r.estado,r.precio_total,r.fecha_solicitud,r.fecha_inicio,r.fecha_fin,c.numero,c.id AS casillero_id,e.nombre AS edificio,p.numero_piso AS piso,f.nombre AS facultad,pl.nombre AS plan FROM rentas r JOIN casilleros c ON c.id=r.casillero_id JOIN pisos p ON p.id=c.piso_id JOIN edificios e ON e.id=p.edificio_id JOIN facultades f ON f.id=e.facultad_id JOIN planes pl ON pl.id=r.plan_id WHERE r.usuario_id=? ORDER BY r.fecha_solicitud DESC`,[req.session.userId]);res.json(rows);
}));
app.post('/api/rentas/:id/pagar',auth,run(async(req,res)=>{
 const conn=await db.getConnection();try{await conn.beginTransaction();await expirePending(conn);
 const [rows]=await conn.execute(`SELECT r.*,pl.duracion_unidad,pl.duracion_valor FROM rentas r JOIN planes pl ON pl.id=r.plan_id WHERE r.id=? AND r.usuario_id=? FOR UPDATE`,[Number(req.params.id),req.session.userId]);
 if(!rows.length||rows[0].estado!=='pendiente_pago'){await conn.rollback();return fail(res,409,'Esta reserva ya no admite pagos.');}
 const r=rows[0];const interval=r.duracion_unidad==='dia'?'DAY':'MONTH';const amount=r.duracion_unidad==='dia'?r.duracion_valor:r.duracion_valor*6;
 await conn.execute(`UPDATE rentas SET estado='activa',fecha_inicio=NOW(),fecha_fin=DATE_ADD(NOW(), INTERVAL ${Number(amount)} ${interval}) WHERE id=?`,[r.id]);
 await conn.execute("UPDATE casilleros SET estado='ocupado' WHERE id=?",[r.casillero_id]);
 await conn.execute("INSERT INTO pagos (renta_id,monto,moneda,metodo_pago,estado,proveedor,pagado_en) VALUES (?,?,?,'otro','aprobado','SIMULACION',NOW())",[r.id,r.precio_total,r.moneda]);
 await conn.commit();res.json({mensaje:'Pago simulado aprobado. Casillero asignado.'});
 }catch(err){await conn.rollback();throw err;}finally{conn.release();}
}));
app.post('/api/rentas/:id/cancelar',auth,run(async(req,res)=>{
 const conn=await db.getConnection();try{await conn.beginTransaction();const [r]=await conn.execute('SELECT id,casillero_id,estado FROM rentas WHERE id=? AND usuario_id=? FOR UPDATE',[Number(req.params.id),req.session.userId]);
 if(!r.length||r[0].estado!=='pendiente_pago'){await conn.rollback();return fail(res,409,'Solo se cancelan reservas pendientes.');}
 await conn.execute("UPDATE rentas SET estado='cancelada' WHERE id=?",[r[0].id]);await conn.execute("UPDATE casilleros SET estado='disponible' WHERE id=?",[r[0].casillero_id]);await conn.commit();res.json({mensaje:'Reserva cancelada.'});
 }catch(err){await conn.rollback();throw err;}finally{conn.release();}
}));
const admin=(req,res,next)=>{if(!req.session.userId)return fail(res,401,'Inicia sesión.');safeUser(req.session.userId).then(u=>u?.rol==='administrador'?next():fail(res,403,'Solo administradores.')).catch(next);};
app.get('/api/admin/resumen',admin,run(async(req,res)=>{const [[a]]=await db.query("SELECT COUNT(*) AS total, SUM(estado='disponible') AS disponibles, SUM(estado='ocupado') AS ocupados, SUM(estado='reservado') AS reservados FROM casilleros");const [[b]]=await db.query('SELECT COUNT(*) AS usuarios FROM usuarios');const [[c]]=await db.query("SELECT COUNT(*) AS rentas FROM rentas");res.json({...a,...b,...c});}));
// Evita que archivos privados sean accesibles mediante HTTP.
app.use((req,res,next)=>{if(/(^|\/)\.|\.sql$|\.json$|\.md$|\.js\.map$/i.test(decodeURIComponent(req.path))||['/server.js','/db.js'].includes(req.path))return res.sendStatus(404);next();});
app.use(express.static(path.join(__dirname),{index:'index.html'}));
app.use((err,req,res,next)=>{console.error(err);if(err.code==='ER_DUP_ENTRY')return fail(res,409,'El correo o matrícula ya existen.');res.status(500).json({mensaje:'Error interno. Revisa la consola del servidor.'});});
const PORT=Number(process.env.PORT)||3000;app.listen(PORT,()=>console.log(`Easy Locker listo en http://localhost:${PORT}`));
