require('dotenv').config();
const dns = require('dns');

// Atlas usa registros SRV; permite definir resolutores alternativos si el DNS local los rechaza.
const dnsServers = String(process.env.MONGODB_DNS_SERVERS || '')
    .split(',')
    .map(server => server.trim())
    .filter(Boolean);
if (dnsServers.length) dns.setServers(dnsServers);

const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/easy_locker';

async function connectDB() {
    mongoose.set('strictQuery', true);
    await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10
    });
    console.log('MongoDB conectado:', mongoose.connection.name);
    return mongoose.connection;
}

async function disconnectDB() {
    await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB, mongoUri };
