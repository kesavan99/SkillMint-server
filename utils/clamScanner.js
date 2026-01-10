const NodeClam = require("clamscan");

let clamScan = null;

async function initClam() {
  if (clamScan) return clamScan;

  try {
    const clamscan = await new NodeClam().init({
      removeInfected: false,
      quarantineInfected: false,
      scanLog: null,
      debugMode: false,
      fileList: null,
      scanRecursively: false,
      clamscan: {
        path: '/usr/bin/clamscan',
      },
      clamdscan: {
        socket: false,
      }
    });

    if (!clamscan) {
      return { isInfected: false, viruses: [] };
    }

    clamScan = clamscan;
    return clamscan;

  } catch (error) {
    return null;
  }
}

async function scanBuffer(buffer) {
  if (!clamScan) {
    await initClam();
  }

  const result = await clamScan.scanBuffer(buffer);
  return result;
}

module.exports = { initClam, scanBuffer };
