function classifyError(log) {
  if (log.error_code === "UI_NULL_ERROR") {
    return "LOW";
  }

  if (log.error_code === "API_TIMEOUT") {
    return "MEDIUM";
  }

  if (log.error_code === "AUTH_FAILURE") {
    return "HIGH";
  }

  if (log.error_code === "DB_CONNECTION_LOST") {
    return "CRITICAL";
  }

  if (log.error_code === "CART_EMPTY") {
  return "LOW";
}

  return "LOW";
}

module.exports = classifyError;