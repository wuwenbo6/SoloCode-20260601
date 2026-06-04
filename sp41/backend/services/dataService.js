const { writeApi, queryApi, Point, org, bucket, influxDB } = require('../config/influxdb');

const writeSteps = async (deviceId, steps, timestamp = new Date()) => {
  const point = new Point('steps')
    .tag('deviceId', deviceId)
    .intField('value', steps)
    .timestamp(timestamp);
  writeApi.writePoint(point);
  await writeApi.flush();
};

const writeHeartRate = async (deviceId, heartRate, timestamp = new Date()) => {
  const point = new Point('heart_rate')
    .tag('deviceId', deviceId)
    .intField('value', heartRate)
    .timestamp(timestamp);
  writeApi.writePoint(point);
  await writeApi.flush();
};

const writeSleep = async (deviceId, stage, duration, timestamp = new Date()) => {
  const point = new Point('sleep')
    .tag('deviceId', deviceId)
    .tag('stage', stage)
    .floatField('duration', duration)
    .timestamp(timestamp);
  writeApi.writePoint(point);
  await writeApi.flush();
};

const queryStepsByRange = async (deviceId, start, stop) => {
  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: ${start}, stop: ${stop})
      |> filter(fn: (r) => r._measurement == "steps" and r.deviceId == "${deviceId}")
      |> aggregateWindow(every: 1d, fn: sum, createEmpty: false)
      |> yield(name: "daily_steps")
  `;
  const result = await queryApi.collectRows(fluxQuery);
  return result.map(row => ({
    date: new Date(row._time).toISOString().split('T')[0],
    steps: row._value
  }));
};

const queryHeartRateByRange = async (deviceId, start, stop) => {
  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: ${start}, stop: ${stop})
      |> filter(fn: (r) => r._measurement == "heart_rate" and r.deviceId == "${deviceId}")
      |> yield(name: "heart_rate_data")
  `;
  const result = await queryApi.collectRows(fluxQuery);
  return result.map(row => ({
    timestamp: row._time,
    heartRate: row._value
  }));
};

const querySleepByRange = async (deviceId, start, stop) => {
  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: ${start}, stop: ${stop})
      |> filter(fn: (r) => r._measurement == "sleep" and r.deviceId == "${deviceId}")
      |> yield(name: "sleep_data")
  `;
  const result = await queryApi.collectRows(fluxQuery);
  return result.map(row => ({
    timestamp: row._time,
    stage: row.stage,
    duration: row._value
  }));
};

const queryAllDataByRange = async (deviceId, start, stop) => {
  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: ${start}, stop: ${stop})
      |> filter(fn: (r) => r.deviceId == "${deviceId}")
      |> yield(name: "all_data")
  `;
  return await queryApi.collectRows(fluxQuery);
};

const getLatestData = async (deviceId) => {
  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: -1h)
      |> filter(fn: (r) => r.deviceId == "${deviceId}")
      |> last()
  `;
  return await queryApi.collectRows(fluxQuery);
};

module.exports = {
  writeSteps,
  writeHeartRate,
  writeSleep,
  queryStepsByRange,
  queryHeartRateByRange,
  querySleepByRange,
  queryAllDataByRange,
  getLatestData
};
