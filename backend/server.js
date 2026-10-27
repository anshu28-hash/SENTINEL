
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

function requireApiToken(req, res, next) {
  const expectedToken = process.env.API_TOKEN;
  const authHeader = req.get("authorization");

  if (!expectedToken) {
    return res.status(500).json({
      error: "API authentication is not configured"
    });
  }

  if (
    !authHeader ||
    authHeader !== `Bearer ${expectedToken}`
  ) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  next();
}

// Keep health check public.
// Protect the business API routes.
app.use("/api/alerts", requireApiToken);
app.use("/api/investigations", requireApiToken);


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


app.post("/api/investigations/:id/evidence", async (req, res) => {
  try {
    const { evidence_type, description, source_data } = req.body;
    const investigationId = req.params.id;

    if (
      typeof evidence_type !== "string" ||
      !evidence_type.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      source_data === undefined ||
      source_data === null ||
      typeof source_data !== "object" ||
      Array.isArray(source_data)
    ) {
      return res.status(400).json({
        error: "evidence_type, description and source_data are required"
      });
    }

    // Confirm that the investigation exists
    const { data: investigation, error: findError } = await supabase
      .from("investigations")
      .select("id, alert_id")
      .eq("id", investigationId)
      .maybeSingle();

    if (findError) {
      console.error(findError.message);
      return res.status(500).json({
        error: "Could not find investigation"
      });
    }

    if (!investigation) {
      return res.status(404).json({
        error: "Investigation not found"
      });
    }

    // Save evidence
    const { data: evidence, error } = await supabase
      .from("evidence")
      .insert({
        investigation_id: investigationId,
        evidence_type: evidence_type.trim(),
        description: description.trim(),
        source_data
      })
      .select()
      .single();

    if (error) {
      console.error("Evidence insert failed:", error.message);
      return res.status(500).json({
        error: "Could not save evidence"
      });
    }

    // Record the action in the audit log
    const { error: auditError } = await supabase
      .from("audit_logs")
      .insert({
        action: "evidence_created",
        entity_type: "evidence",
        alert_id: investigation.alert_id,
        investigation_id: investigationId,
        details: {
          evidence_id: evidence.id,
          evidence_type: evidence.evidence_type
        }
      });

    if (auditError) {
      console.error("Audit log insert failed:", auditError.message);
    }

    return res.status(201).json({
      message: "Evidence saved successfully",
      evidence
    });
  } catch (err) {
    console.error("Evidence API error:", err.message);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
});

const PORT = process.env.PORT || 3000;
app.get("/api/investigations/:id/evidence", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("evidence")
      .select("*")
      .eq("investigation_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Evidence fetch error:", error.message);
      return res.status(500).json({
        error: "Failed to fetch evidence"
      });
    }

    return res.status(200).json({
      investigation_id: id,
      count: data.length,
      evidence: data
    });
  } catch (error) {
    console.error("Unexpected error:", error.message);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
});


app.listen(PORT, () => {
  console.log(`FraudLens API running on port ${PORT}`);
});
