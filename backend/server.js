
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

if (!process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "FraudLens API is running"
  });
});

// Fetch an alert using its public reference, e.g. ALERT-001
app.get("/api/alerts/:ref", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("alerts")
      .select(`
        id,
        alert_ref,
        risk_score,
        reason,
        status,
        transaction:transactions (
          id,
          transaction_ref,
          amount,
          currency,
          occurred_at
        )
      `)
      .eq("alert_ref", req.params.ref)
      .maybeSingle();

    if (error) {
      console.error("Supabase query failed:", error.message);
      return res.status(500).json({
        error: "Could not fetch alert"
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Alert not found"
      });
    }

    res.json(data);
  } catch (err) {
    console.error("API error:", err.message);
    res.status(500).json({
      error: "Internal server error"
    });
  }
});


const allowedStatuses = [
  "pending",
  "processing",
  "completed",
  "failed"
];

app.patch("/api/investigations/:id", async (req, res) => {
  try {
    const { workflow_status, ai_summary } = req.body;

    if (
      workflow_status !== undefined &&
      !allowedStatuses.includes(workflow_status)
    ) {
      return res.status(400).json({
        error: "Invalid workflow_status"
      });
    }

    if (
      workflow_status === undefined &&
      ai_summary === undefined
    ) {
      return res.status(400).json({
        error: "Provide workflow_status or ai_summary"
      });
    }

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (workflow_status !== undefined) {
      updates.workflow_status = workflow_status;
    }

    if (ai_summary !== undefined) {
      if (typeof ai_summary !== "string") {
        return res.status(400).json({
          error: "ai_summary must be a string"
        });
      }

      updates.ai_summary = ai_summary;
    }

    const { data, error } = await supabase
      .from("investigations")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Investigation update failed:", error.message);
      return res.status(500).json({
        error: "Could not update investigation"
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Investigation not found"
      });
    }

    const { error: auditError } = await supabase
      .from("audit_logs")
      .insert({
        action: "investigation_updated",
        entity_type: "investigation",
        alert_id: data.alert_id,
        investigation_id: data.id,
        details: {
          workflow_status: data.workflow_status,
          ai_summary_updated: ai_summary !== undefined
        }
      });

    if (auditError) {
      console.error("Audit log insert failed:", auditError.message);
    }

    return res.json({
      message: "Investigation updated",
      investigation: data
    });
  } catch (err) {
    console.error("API error:", err.message);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`FraudLens API running on port ${PORT}`);
});
