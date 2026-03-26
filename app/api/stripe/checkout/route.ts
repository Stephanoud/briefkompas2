import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { isFlow } from "@/lib/flow";
import { generateStripeLineItem, isTestBypassDiscountCode } from "@/lib/utils";
import { Flow, Product } from "@/types";

export const runtime = "nodejs";

const isPlaceholder = (value?: string) =>
  !value || value.includes("YOUR_") || value.includes("YOUR-");

const isProduct = (value: unknown): value is Product =>
  value === "basis" || value === "uitgebreid";

function extractFlowFromReferer(referer: string | null): Flow | null {
  if (!referer) return null;
  try {
    const { pathname } = new URL(referer);
    const segments = pathname.split("/").filter(Boolean);
    const candidate = segments.find((segment) => isFlow(segment));
    return candidate ?? null;
  } catch {
    return null;
  }
}

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || isPlaceholder(key)) {
    return null;
  }
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  try {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : "");

    if (!appUrl) {
      return NextResponse.json(
        { error: "Kon app URL niet bepalen voor checkout redirect." },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const flowFromBody = body.flow;
    const productFromBody = body.product ?? body.selectedProduct ?? body.package;
    const discountCode = typeof body.discountCode === "string" ? body.discountCode : null;

    const flow = isFlow(flowFromBody)
      ? flowFromBody
      : extractFlowFromReferer(req.headers.get("referer"));
    const product = isProduct(productFromBody) ? productFromBody : null;

    if (!flow || !product) {
      return NextResponse.json(
        { error: "Ontbrekende of ongeldige flow/product. Vernieuw de pagina en kies je pakket opnieuw." },
        { status: 400 }
      );
    }

    if (isTestBypassDiscountCode(discountCode)) {
      return NextResponse.json({
        checkoutUrl: `${appUrl}/checkout/success?flow=${flow}&bypass_payment=1`,
        sessionId: null,
        bypassPayment: true,
      });
    }

    const stripe = getStripeClient();
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripe || isPlaceholder(stripeSecretKey)) {
      return NextResponse.json(
        { error: "Stripe is niet geconfigureerd: STRIPE_SECRET_KEY ontbreekt of is een placeholder." },
        { status: 500 }
      );
    }

    const lineItem = generateStripeLineItem(product, flow);

    const session = await stripe.checkout.sessions.create({
      line_items: [lineItem],
      mode: "payment",
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&flow=${flow}`,
      cancel_url: `${appUrl}/pricing/${flow}`,
      locale: "nl",
      customer_email: undefined,
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Stripe error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create checkout session";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
