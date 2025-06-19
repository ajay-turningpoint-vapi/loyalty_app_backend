// redisClient.js
const redis = require('redis');

const redisClient = redis.createClient(); // defaults to localhost:6379

redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error', err);
});

redisClient.connect();

module.exports = redisClient;
