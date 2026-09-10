import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";
import { markPaymentCaptureVerified } from "../services/payment-service";

const router = Router();

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

// ============================================================================
// Razorpay Webhook Handler
// ============================================================================
// This route is mounted with express.raw() BEFORE express.json() in app.ts.
// req.body is a raw Buffer at this point.

router.post("/razorpay", async (req: Request, res: Response) => {
  try {
    // 1. Verify webhook signature against raw body
    if (!RAZORPAY_WEBHOOK_SECRET) {
      console.warn("[webhook] RAZORPAY_WEBHOOK_SECRET not configured, rejecting webhook");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    const signature = req.headers["x-razorpay-signature"] as string | undefined;
    if (!signature) {
      res.status(400).json({ error: "Missing webhook signature" });
      return;
    }

    // req.body is a Buffer because express.raw() parsed it
    const rawBody: Buffer = req.body;

    const crypto = await import("crypto");
    const expectedSig = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature))) {
      console.warn("[webhook] Invalid signature");
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    // 2. Idempotency via x-razorpay-event-id
    const eventId = req.headers["x-razorpay-event-id"] as string | undefined;
    if (!eventId) {
      res.status(400).json({ error: "Missing event ID" });
      return;
    }

    const admin = createAdminClient();

    // Try to insert the event (unique constraint prevents duplicates)
    const { error: insertError } = await admin
      .from("payment_webhook_events")
      .insert({
        gateway: "razorpay",
        event_id: eventId,
        event_type: "unknown", // will be updated after parsing
        payload: null,
        status: "pending",
      });

    if (insertError) {
      // Duplicate event ID — already processed, return 200 to stop retries
      if (insertError.code === "23505") {
        res.json({ status: "already_processed" });
        return;
      }
      console.error("[webhook] Failed to record event:", insertError.message);
      res.status(500).json({ error: "Failed to record event" });
      return;
    }

    // 3. Parse the event payload
    let event: { event: string; payload?: any };
    try {
      event = JSON.parse(rawBody.toString());
    } catch {
      // Mark event as failed
      await admin
        .from("payment_webhook_events")
        .update({ status: "failed", processed_at: new Date().toISOString() })
        .eq("event_id", eventId);

      res.status(400).json({ error: "Invalid JSON payload" });
      return;
    }

    // Update event type and payload
    await admin
      .from("payment_webhook_events")
      .update({
        event_type: event.event,
        payload: event.payload,
      })
      .eq("event_id", eventId);

    // 4. Handle events
    switch (event.event) {
      case "payment.captured": {
        const paymentEntity = event.payload?.payment?.entity;
        if (paymentEntity) {
          const razorpayOrderId = paymentEntity.order_id;
          const razorpayPaymentId = paymentEntity.id;

          if (razorpayOrderId && razorpayPaymentId) {
            const result = await markPaymentCaptureVerified(
              razorpayOrderId,
              razorpayPaymentId
            );

            console.log(
              `[webhook] payment.captured processed: eventId=${eventId}, ` +
              `orderId=${razorpayOrderId}, transactionId=${result.transactionId}, ` +
              `finalized=${result.finalized}`
            );
          }
        }
        break;
      }

      case "payment.failed": {
        const paymentEntity = event.payload?.payment?.entity;
        if (paymentEntity) {
          const razorpayOrderId = paymentEntity.order_id;
          const failureReason = paymentEntity.error_description || "Payment failed";

          // Update payment transaction status
          if (razorpayOrderId) {
            await admin
              .from("payment_transactions")
              .update({
                payment_status: "failed",
                failure_reason: failureReason,
                updated_at: new Date().toISOString(),
              })
              .eq("gateway_order_id", razorpayOrderId)
              .in("payment_status", ["created", "pending", "authorized"]);

            console.log(
              `[webhook] payment.failed processed: eventId=${eventId}, ` +
              `orderId=${razorpayOrderId}`
            );
          }
        }
        break;
      }

      case "refund.processed": {
        // Future: handle refund webhooks
        console.log(`[webhook] refund.processed received: eventId=${eventId}`);
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.event} (eventId=${eventId})`);
    }

    // 5. Mark event as processed
    await admin
      .from("payment_webhook_events")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);

    res.json({ status: "ok" });
  } catch (err: any) {
    console.error("[webhook] Error:", err.message);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
