function officeLanInfo(networkInterfaces) {
  const lanUrls = [];
  const seen = new Set();
  for (const list of Object.values(networkInterfaces || {})) {
    for (const net of list || []) {
      const ipv4 = net.family === "IPv4" || net.family === 4;
      if (!ipv4 || net.internal || !net.address) continue;
      const url = `http://${net.address}:3457`;
      if (seen.has(url)) continue;
      seen.add(url);
      lanUrls.push(url);
    }
  }
  return {
    localUrl: "http://127.0.0.1:3457",
    lanUrls,
  };
}

module.exports = { officeLanInfo };
