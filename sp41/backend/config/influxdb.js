const { InfluxDB, Point } = require('@influxdata/influxdb-client');

const url = process.env.INFLUXDB_URL || 'http://localhost:8086';
const token = process.env.INFLUXDB_TOKEN || 'smartband-token';
const org = process.env.INFLUXDB_ORG || 'smartband-org';
const bucket = process.env.INFLUXDB_BUCKET || 'smartband-data';

const influxDB = new InfluxDB({ url, token });
const writeApi = influxDB.getWriteApi(org, bucket);
const queryApi = influxDB.getQueryApi(org);

module.exports = {
  influxDB,
  writeApi,
  queryApi,
  Point,
  org,
  bucket
};
