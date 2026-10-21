const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

/**
 * Run a query against the pool.
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a client for running a transaction. Caller MUST release() it.
 */
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
