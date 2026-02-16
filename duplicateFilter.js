const seenErrors = new Map();

function isDuplicate(log) {
  const key = `${log.service}-${log.error_code}`;
  const now = Date.now();

  if (seenErrors.has(key)) {
    const lastTime = seenErrors.get(key);
    if (now - lastTime < 5000) {
      return true; // duplicate within 5 seconds
    }
  }

  seenErrors.set(key, now);
  return false;
}

module.exports = isDuplicate;