import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    const sig = event.headers['stripe-signature'];
    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Handle subscription events
    switch (stripeEvent.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = stripeEvent.data.object;
        const userId = subscription.metadata.userId;
        
        await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            status: subscription.status,
            plan_type: subscription.items.data[0].price.lookup_key,
            current_period_end: new Date(subscription.current_period_end * 1000),
            updated_at: new Date()
          });
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = stripeEvent.data.object;
        const deletedUserId = deletedSubscription.metadata.userId;
        
        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date()
          })
          .match({ user_id: deletedUserId });
        break;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message }),
    };
  }
}