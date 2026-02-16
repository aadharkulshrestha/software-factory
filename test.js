const { render, fetchData, calculateTotal } = require("./production/app");

const errorType = process.argv[2];

try {
  if (errorType === "UI_NULL_ERROR") {
    render(null);
  }

  if (errorType === "API_TIMEOUT") {
    fetchData({});
  }

  if (errorType === "CART_EMPTY") {
    calculateTotal(null);
  }

  console.log("Test passed");
  process.exit(0);
} catch (err) {
  console.log("Test failed:", err.message);
  process.exit(1);
}