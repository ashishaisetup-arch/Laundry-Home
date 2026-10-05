import { Router, Request, Response } from "express";
import { createAdminClient } from "../supabase";
import { markPaymentCaptureVerified } from "../services/payment-service";
import {
  resolveLocalRefund,
  handleRefundCreatedWebhook,
  handleRefundProcessedWebhook,
  handleRefundFailedWebhook,
} from "../services/refund-service";

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

    if (Buffer.byteLength(expectedSig) !== Buffer.byteLength(signature)) {
      console.warn("[webhook] Invalid signature length");
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

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

    // Status-aware dedupe logic
    // new event_id → insert pending → process
    // duplicate + status=processed → 200 already_processed
    // duplicate + status=pending → 202 already_in_progress (don't process concurrently)
    // duplicate + status=failed → atomically reclaim (failed → pending) → process again
    const { error: insertError } = await admin
      .from("payment_webhook_events")
      .insert({
        gateway: "razorpay",
        event_id: eventId,
        event_type: "unknown",
        payload: null,
        status: "pending",
      });

    if (insertError && insertError.code === "23505") {
      // Duplicate event_id — check current status
      const { data: existingEvent } = await admin
        .from("payment_webhook_events")
        .select("status")
        .eq("event_id", eventId)
        .single();

      const existingStatus = existingEvent?.status;

      if (existingStatus === "processed") {
        res.json({ status: "already_processed" });
        return;
      }

      if (existingStatus === "pending") {
        // Another request is processing this event concurrently
        res.status(202).json({ status: "already_in_progress" });
        return;
      }

      if (existingStatus === "failed") {
        // Parse payload for audit trail before reclaiming
        let parsedEvent: any = null;
        try {
          parsedEvent = JSON.parse(rawBody.toString());
        } catch {
          // Will handle after reclaim
        }

        // Atomically reclaim: failed → pending, update event_type and payload
        const { data: reclaimed, error: reclaimError } = await admin
          .from("payment_webhook_events")
          .update({
            status: "pending",
            processed_at: null,
            event_type: parsedEvent?.event || "unknown",
            payload: parsedEvent?.payload || null,
          })
          .eq("event_id", eventId)
          .eq("status", "failed")
          .select("status")
          .single();

        if (reclaimError || !reclaimed) {
          // Another request reclaimed it first
          res.status(202).json({ status: "already_in_progress" });
          return;
        }
        // Successfully reclaimed — fall through to process
      }
    }

    if (insertError && insertError.code !== "23505") {
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

      case "refund.created":
      case "refund.processed":
      case "refund.failed": {
        const refundEntity = event.payload?.refund?.entity;
        if (refundEntity?.id) {
          // Common resolver for all refund events
          const resolved = await resolveLocalRefund(refundEntity);

          if (!resolved.success) {
            if (resolved.critical) {
              // Record critical conflict, return 200 (don't retry)
              await admin
                .from("payment_webhook_events")
                .update({
                  status: "processed",
                  processed_at: new Date().toISOString(),
                  payload: { ...event.payload, critical_error: resolved.error },
                })
                .eq("event_id", eventId);
              res.json({ status: "critical_conflict" });
              return;
            }

            // Known business condition — don't retry
            console.warn(
              `[webhook] ${event.event}: resolve failed — ${resolved.error} ` +
              `(eventId=${eventId}, gatewayRefundId=${refundEntity.id})`
            );
            break;
          }

          // Dispatch by event type using resolved refund
          switch (event.event) {
            case "refund.created": {
              const result = await handleRefundCreatedWebhook(resolved.refund!, refundEntity);
              console.log(
                `[webhook] refund.created: gatewayRefundId=${refundEntity.id}, ` +
                `success=${result.success}, refundStatus=${result.refundStatus}`
              );
              break;
            }

            case "refund.processed": {
              const result = await handleRefundProcessedWebhook(resolved.refund!, refundEntity);
              if (result.error === "reconciliation_required") {
                console.warn(
                  `[webhook] refund.processed: reconciliation_required, ` +
                  `gatewayRefundId=${refundEntity.id}`
                );
                // Return 200 — known business condition, not retryable
              } else {
                console.log(
                  `[webhook] refund.processed: success=${result.success}, ` +
                  `walletMoved=${result.walletMoved || false}, ` +
                  `gatewayRefundId=${refundEntity.id}`
                );
              }
              break;
            }

            case "refund.failed": {
              const result = await handleRefundFailedWebhook(resolved.refund!, refundEntity);
              console.log(
                `[webhook] refund.failed: success=${result.success}, ` +
                `gatewayRefundId=${refundEntity.id}`
              );
              break;
            }
          }
        }
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

    // Mark event as failed — this allows Razorpay to retry
    try {
      const admin = createAdminClient();
      const eventId = req.headers["x-razorpay-event-id"] as string | undefined;
      if (eventId) {
        await admin
          .from("payment_webhook_events")
          .update({ status: "failed", processed_at: new Date().toISOString() })
          .eq("event_id", eventId);
      }
    } catch (markErr: any) {
      console.error("[webhook] Failed to mark event as failed:", markErr.message);
    }

    // Return 5xx so Razorpay can retry transient failures
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
