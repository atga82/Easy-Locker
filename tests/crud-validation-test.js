require('dotenv').config();
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../db');
const models = require('../models');
const base = process.env.TEST_BASE_URL || 'http://localhost:' + (process.env.PORT || 3000);
const prefix = 'qa-crud-' + Date.now();
const made = [];
const mapping = { roles: models.Rol, facultades: models.Facultad, usuarios: models.Usuario,
  edificios: models.Edificio, pisos: models.Piso, casilleros: models.Casillero,
  planes: models.Plan, rentas: models.Renta, pagos: models.Pago, logs: models.LogSistema };
let headers = {};
async function api(route, method='GET', data, auth=headers) {
  const r = await fetch(base + route, { method, headers: {'Content-Type':'application/json', ...auth},
    ...(data === undefined ? {} : {body:JSON.stringify(data)}) });
  const body = await r.json().catch(() => ({}));
  return {status:r.status,body};
}
async function expect(route, method, data, status, auth) {
  const r = await api(route,method,data,auth);
  assert.equal(r.status,status,method+' '+route+' expected '+status+', got '+r.status+': '+JSON.stringify(r.body).slice(0,250));
  return r.body;
}
async function create(resource,data) {
  const result = await expect('/api/admin/'+resource,'POST',data,201);
  assert.match(result.id,/^[a-f0-9]{24}$/);
  made.push([resource,result.id]);
  return result.id;
}
async function update(resource,id,data) {
  await expect('/api/admin/'+resource+'/'+id,'PUT',data,200);
}
async function del(resource,id) {
  await expect('/api/admin/'+resource+'/'+id,'DELETE',undefined,200);
  const i=made.findIndex(([r,k])=>r===resource&&k===id);
  if(i>=0) made.splice(i,1);
}
async function main() {
  assert.ok(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
  const login=await expect('/api/login','POST',{correo:process.env.ADMIN_EMAIL,contrasena:process.env.ADMIN_PASSWORD},200,{});
  headers={Authorization:'Bearer '+login.token};
  await connectDB();
  const existingRole = await models.Rol.findOne({nombre:'estudiante'}).lean();
  const existingFaculty = await models.Facultad.findOne({activa:true}).lean();
  assert.ok(existingRole && existingFaculty,'Ejecuta npm run seed antes de probar.');
  const role=await create('roles',{nombre:prefix,descripcion:'Prueba CRUD'});
  await update('roles',role,{descripcion:'Actualizado'});
  const faculty=await create('facultades',{nombre:prefix,activa:true});
  await update('facultades',faculty,{activa:false});
  const user=await create('usuarios',{rol:role,facultad:faculty,nombre:'QA',apellidos:'Temporal',
    matricula:String(Date.now()).slice(-10),correo:prefix+'@example.invalid',password:'TemporalQA2026!',estado:'activo'});
  await update('usuarios',user,{apellidos:'Actualizado'});
  const building=await create('edificios',{facultad:faculty,nombre:prefix,activo:true});
  await update('edificios',building,{activo:false});
  const floor=await create('pisos',{edificio:building,numero_piso:99,activo:true});
  await update('pisos',floor,{activo:false});
  const locker=await create('casilleros',{piso:floor,numero:9999,fila:1,columna:1,estado:'disponible'});
  await update('casilleros',locker,{estado:'mantenimiento'});
  const plan=await create('planes',{nombre:prefix,descripcion:'Prueba',duracion_valor:1,
    duracion_unidad:'dia',precio:25,moneda:'MXN',activo:true});
  await update('planes',plan,{precio:26});
  const rent=await create('rentas',{usuario:user,casillero:locker,plan,estado:'cancelada',
    precio_total:26,moneda:'MXN'});
  await update('rentas',rent,{precio_total:27});
  const payment=await create('pagos',{renta:rent,monto:27,moneda:'MXN',metodo_pago:'otro',
    estado:'pendiente',proveedor:'QA'});
  await update('pagos',payment,{estado:'rechazado'});
  const log=await create('logs',{nivel:'INFO',evento:prefix,mensaje:'Registro QA',contexto_json:'{"qa":true}'});
  await update('logs',log,{mensaje:'Actualizado'});
  for(const [resource,id] of made) {
    const list=await expect('/api/admin/'+resource,'GET',undefined,200);
    assert.ok(Array.isArray(list) && list.some(x=>x._id===id),'GET missing '+resource);
  }
  console.log('OK: 10 colecciones POST/GET/PUT');
  await expect('/api/admin/roles/'+role,'DELETE',undefined,409);
  await expect('/api/admin/facultades/'+faculty,'DELETE',undefined,409);
  await expect('/api/admin/edificios/'+building,'DELETE',undefined,409);
  await expect('/api/admin/pisos/'+floor,'DELETE',undefined,409);
  await expect('/api/admin/casilleros/'+locker,'DELETE',undefined,409);
  await expect('/api/admin/planes/'+plan,'DELETE',undefined,409);
  await expect('/api/admin/usuarios/'+user,'DELETE',undefined,409);
  await expect('/api/admin/rentas/'+rent,'DELETE',undefined,409);
  console.log('OK: 8 borrados con dependencias bloqueados');
  await expect('/api/admin/pisos','POST',{edificio:'000000000000000000000001',numero_piso:50},400);
  await expect('/api/admin/edificios','POST',{nombre:prefix+'-bad'},400);
  await expect('/api/admin/usuarios','POST',{rol:role,facultad:faculty,nombre:'QA',
    apellidos:'Invalido',matricula:prefix+'-bad',correo:prefix+'bad@example.invalid',password:'123'},400);
  await expect('/api/admin/planes','POST',{nombre:prefix+'-bad',duracion_valor:1,
    duracion_unidad:'dia',precio:-1},400);
  await expect('/api/admin/casilleros','POST',{piso:floor,numero:2,fila:1,columna:1,estado:'no-existe'},400);
  await expect('/api/admin/logs','POST',{evento:prefix+'-bad',mensaje:'qa',contexto_json:'{mal'},400);
  await expect('/api/admin/roles','POST',{nombre:prefix},409);
  await expect('/api/admin/roles','POST',{nombre:prefix+'-notallowed'},401,{Authorization:'Bearer INVALID'});
  const studentLogin=await expect('/api/login','POST',{correo:prefix+'@example.invalid',contrasena:'TemporalQA2026!'},200,{});
  await expect('/api/admin/roles','GET',undefined,403,{Authorization:'Bearer '+studentLogin.token});
  await expect('/api/admin/roles','GET',undefined,401,{});
  console.log('OK: validaciones negativas, duplicados, autorización y permisos');
  await models.LogSistema.deleteMany({usuario:user});
  for(const [resource,id] of [...made].reverse()) await del(resource,id);
  assert.equal(made.length,0);
  console.log('APROBADO: CRUD completo de 10 colecciones, 8 guardas y casos negativos.');
}
main().catch(e=>{console.error('FALLÓ QA CRUD:',e);process.exitCode=1;})
.finally(async()=>{
  try {
    if(mongoose.connection.readyState!==1) await connectDB();
    const tempUsers=made.filter(([resource])=>resource==='usuarios').map(([,id])=>id);
    if(tempUsers.length) await models.LogSistema.deleteMany({usuario:{$in:tempUsers}});
    for(const [resource,id] of [...made].reverse()) {
      await mapping[resource].deleteOne({_id:id}).catch(()=>{});
    }
    const qaLeft = await models.Usuario.countDocuments({correo:prefix+'@example.invalid'});
    if(qaLeft) {console.error('QA: quedó un usuario temporal; requiere limpieza.');process.exitCode=1;}
  } catch(e) {console.error('Error al limpiar QA:',e.message);process.exitCode=1;}
  finally {await disconnectDB().catch(()=>{});}
});