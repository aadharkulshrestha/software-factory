const fs = require("fs");
const { execSync } = require("child_process");
const aiFix = require("./aiFixer");

// Cached fallback fixes
const fallbackFixes = {
  UI_NULL_ERROR: "Add null check before map.",
  API_TIMEOUT: "Add default value before accessing data.",
  CART_EMPTY: "Return zero if cart is null."
};

async function applyAutoFix(log) {
  const filePath = log.file || "production/app.js";

  // Read current file
  const originalCode = fs.readFileSync(filePath, "utf-8");

  let fixMessage = "";

  // Try AI fix
  try {
    fixMessage = await aiFix(log);
    console.log("AI Suggested Fix:", fixMessage);
  } catch (err) {
    console.log("AI unavailable. Using fallback fix.");

    fixMessage =
      fallbackFixes[log.error_code] || "Fallback fix applied.";
  }

  let patchedCode = originalCode;

  // UI null bug
  if (log.error_code === "UI_NULL_ERROR") {
    if (!originalCode.includes("if (!items) return []")) {
      patchedCode = patchedCode.replace(
        "return items.map",
        "if (!items) return [];\n  return items.map"
      );
    }
  }

  // API data bug
  if (log.error_code === "API_TIMEOUT") {
    if (!originalCode.includes("if (!data || !data.value) return")) {
      patchedCode = patchedCode.replace(
        "return data.value.toUpperCase()",
        "if (!data || !data.value) return '';\n  return data.value.toUpperCase()"
      );
    }
  }

  // Cart bug
  if (log.error_code === "CART_EMPTY") {
    if (!originalCode.includes("if (!cart) return 0")) {
      patchedCode = patchedCode.replace(
        "for (let item of cart)",
        "if (!cart) return 0;\n  for (let item of cart)"
      );
    }
  }

  // Write patched file
  fs.writeFileSync(filePath, patchedCode);

  console.log("Patch applied. Running tests...");

  try {
    execSync(`node test.js ${log.error_code}`, { stdio: "inherit" });

    console.log("Auto-fix successful. Deployed.");

    return {
      type: "DEPLOYED",
      message: fixMessage,
      before: originalCode,
      after: patchedCode
    };
  } catch (err) {
    // rollback
    fs.writeFileSync(filePath, originalCode);

    console.log("Test failed. Rolled back.");

    return {
      type: "ESCALATED",
      message: "Auto-fix failed tests.",
      before: originalCode,
      after: originalCode
    };
  }
}

module.exports = applyAutoFix;