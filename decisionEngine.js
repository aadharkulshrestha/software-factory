const applyAutoFix = require("./patchEngine");

async function handleError(log, severity) {
  if (severity === "LOW") {
    console.log("→ LOW severity: Autonomous repair started.");
    return await applyAutoFix(log);   // must return full object
  } else if (severity === "MEDIUM") {
    return {
    type: "AUTO_RECOVERY",
    message: "Service restarted and request retried successfully.",
    before: "",
    after: ""
  };
  } else {
    return {
      type: "ESCALATED",
      message: "Escalated to human engineer.",
      before: "",
      after: ""
    };
  }
}

module.exports = handleError;