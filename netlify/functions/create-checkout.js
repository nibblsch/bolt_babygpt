import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MONTHLY_PRICE_ID = 'prod_RkcmFAgddLLJfn'; // Replace with your Stripe price ID
const ANNUAL_PRICE_ID = 'prod_RkcnX78pXVNKpu';   // Replace with your Stripe price ID

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { planType, userId, email } = JSON.parse(event.body);
    
    // Determine price ID based on plan type
    const priceId = planType === 'annual' ? ANNUAL_PRICE_ID : MONTHLY_PRICE_ID;
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/pricing`,
      metadata: {
        userId,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ id: session.id }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}