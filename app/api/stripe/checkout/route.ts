import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { generateStripeLineItem } from "@/lib/utils";
import { Flow, Product } from "@/types";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const isPlaceholder = (value?: string) =>
  !value || value.includes("YOUR_") || value.includes("YOUR-");

export async function POST(req: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (isPlaceholder(stripeSecretKey)) {
      return NextResponse.json(
        { error: "Stripe is niet geconfigureerd: STRIPE_SECRET_KEY ontbreekt of is een placeholder." },
        { status: 500 }
      );
    }

    if (!appUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_APP_URL ontbreekt in .env.local." },
        { status: 500 }
      );
    }

    const { flow, product } = await req.json() as {
      flow: Flow;
      product: Product;
    };

    if (!flow || !product) {
      return NextResponse.json(
        { error: "Missing flow or product" },
        { status: 400 }
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
