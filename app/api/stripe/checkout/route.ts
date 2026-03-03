import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { generateStripeLineItem, getPriceInCents } from "@/lib/utils";
import { Flow, Product } from "@/types";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export async function POST(req: NextRequest) {
  try {
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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}&flow=${flow}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing/${flow}`,
      locale: "nl",
      customer_email: undefined,
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Stripe error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
