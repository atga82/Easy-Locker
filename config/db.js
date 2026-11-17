const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/easy_locker';
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Conectado exitosamente a: ${mongoose.connection.host}/${mongoose.connection.name}`);
    return true;
  } catch (error) {
    console.error('------------------------------------------------------------');
    console.error('[MongoDB ERROR] No se pudo conectar a la base de datos MongoDB.');
    console.error(`URI intentada: ${uri}`);
    console.error('Detalle del error:', error.message);
    console.error('');
    console.error('👉 ¿Cómo solucionarlo?');
    console.error('1. Si usas MongoDB local: Asegúrate de que el servicio esté iniciado (mongod).');
    console.error('2. Si usas MongoDB Atlas (Nube): Configura tu MONGODB_URI en el archivo .env:');
    console.error('   MONGODB_URI=mongodb+srv://<usuario>:<password>@cluster0.mongodb.net/easy_locker?retryWrites=true&w=majority');
    console.error('------------------------------------------------------------');
    return false;
  }
};

module.exports = connectDB;
