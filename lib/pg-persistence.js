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

    const result = await dbQuery(NOT_DUPLICATE, username);
    if (result.rowCount !== 0) {
      return "duplicate";
    } else {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);
      const added = await dbQuery(ADD_USER, username, hash);
      return (added ? true : false);
    }
  }

  async authenticate(username, password) {
    const VALID_USER = 'SELECT * FROM users WHERE username = $1';
    console.log(username, password);
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
    const NEW_LOCATION = `INSERT INTO locations (latitude, longitude, logtime, username)
                      VALUES ($1, $2, $3, $4)`;

    const result = await dbQuery(NEW_LOCATION, lat, lon, time, this.username);
    return result.rowCount > 0;
  }

  async addLocationNoSession(lat, lon, time, user) {
    const NEW_LOCATION = `INSERT INTO locations (latitude, longitude, logtime, username)
                      VALUES ($1, $2, $3, $4)`;
    const ADDED_LOCATION =  `SELECT * FROM locations
                     WHERE username = $1
                     ORDER BY logtime DESC LIMIT 1`

    const result = await dbQuery(NEW_LOCATION, lat, lon, time, user);
    const last = await dbQuery(ADDED_LOCATION, user);

    return (last.rows.length > 0 ? last.rows : false);
  }

  async recentLocations(user) {
    const TEN_LOCATIONS =  `SELECT * FROM locations
                     WHERE username = $1
                     ORDER BY logtime DESC LIMIT 10`
    const lastTen = await dbQuery(TEN_LOCATIONS, user);

    return (lastTen.rows.length > 0 ? lastTen.rows : false);
  }

  async allLocations(user) {
    const LOCATIONS = `SELECT * FROM locations
                     WHERE username = $1
                     ORDER BY logtime ASC`;

    const result = await dbQuery(LOCATIONS, user);

    return (result.rows.length > 0 ? result.rows : false);
  }
};
