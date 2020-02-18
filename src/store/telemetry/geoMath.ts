//
// Helper functions to calculate geometric distances based using great circle formulas
//

const toRadians = (degrees: number) => {
  return (degrees / 180) * Math.PI;
};

const toDegrees = (radians: number) => {
  return (radians / Math.PI) * 180;
};

const mphToMetersPerSecond = (mph: number) => {
  return mph * 0.44704;
};

const distance = (coord1: { lat: number; lon: number }, coord2: { lat: number; lon: number }) => {
  let R = 6371e3; // metres
  let lat1 = toRadians(coord1.lat);
  let lat2 = toRadians(coord2.lat);
  let dLat = toRadians(lat2 - lat1);
  let dLon = toRadians(coord2.lon - coord1.lon);

  let a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  let d = R * c;
  return d;
};

const bearing = (coord1: { lat: number; lon: number }, coord2: { lat: number; lon: number }) => {
  let R = 6371e3; // metres
  let lat1 = toRadians(coord1.lat);
  let lat2 = toRadians(coord2.lat);
  let dLat = toRadians(lat2 - lat1);
  let dLon = toRadians(coord2.lon - coord1.lon);
  let y = Math.sin(dLon) * Math.cos(lat2);
  let x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return toDegrees(Math.atan2(y, x));
};

const destination = (
  coord1: { lat: number; lon: number },
  initialBearing: number,
  travelDistance: number
) => {
  let R = 6371e3; // metres
  let d = travelDistance / R;
  let lat1 = toRadians(coord1.lat);
  let lon1 = toRadians(coord1.lon);
  initialBearing = toRadians(initialBearing);
  let lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(initialBearing)
  );
  let lon2 =
    lon1 +
    Math.atan2(
      Math.sin(initialBearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  const coord2 = { lat: toDegrees(lat2), lon: toDegrees(lon2) };
  return { coord1, coord2, bearing: bearing(coord1, coord2) };
};

export default {
  toRadians,
  toDegrees,
  mphToMetersPerSecond,
  distance,
  bearing,
  destination,
};
