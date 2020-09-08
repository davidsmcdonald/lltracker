/* eslint-disable class-methods-use-this */
const bcrypt = require('bcrypt');
const { dbQuery } = require('./db-query');

module.exports = class PgPersistence {
  constructor(session) {
    this.username = session.username;
  }

  async createUser(username, password) {
    const NOT_DUPLICATE = 'SELECT * FROM users WHERE username = $1'
    const ADD_USER = `INSERT INTO users (username, password)
      VALUES ($1, $2);`

    const result = await dbQuery(VALID_USER, username);
    if (result.rowCount !== 0) {
      return false;
    } else {
      const added = await dbQuery(ADD_USER, username, password);
      return (added ? true : false);
    }
  }

  async authenticate(username, password) {
    const VALID_USER = 'SELECT * FROM users WHERE username = $1';

    const result = await dbQuery(VALID_USER, username);
    if (result.rowCount === 0) return false;

    return bcrypt.compare(password, result.rows[0].password);
  }

  // Deletes all location data from userid. Returns a promise that resolves
  // to `true` on success, `false` on failure.
  async deleteData() {
    const DELETE_DATA = `DELETE FROM locations WHERE username = $1`;

    const result = await dbQuery(DELETE_DATA, this.username);
    return result.rowCount > 0;
  }

  // Adds a location data point
  async addLocation(lat, lon, time) {
    const NEW_LOCCATION = `INSERT INTO locations (latitude, longitude, logtime, user)
                      VALUES ($1, $2, $3, $4)`;

    const result = await dbQuery(NEW_LOCATION, lat, lon, time, this.username);
    return result.rowCount > 0;
  }

  async allLocations() {
    const LOCATIONS = `SELECT * FROM locations
                     WHERE username = $1
                     ORDER BY logtime ASC`;

    const result = await dbQuery(LOCATIONS, this.username);
    return result.rows;
  }
};
