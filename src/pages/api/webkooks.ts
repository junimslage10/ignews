import { NextApiRequest, NextApiResponse } from 'next'
import { Readable } from 'stream'
import { Stripe } from 'stripe'
import { saveSubscription } from './_lib/manageSubscription'
import { stripe } from '../../services/stripe'

const buffer = async (readable: Readable) => {
  const chunks = []

  // eslint-disable-next-line no-restricted-syntax
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  return Buffer.concat(chunks)
}

export const config = { api: { bodyParser: false } }

const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

export default async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method not allowed')
  }

  const buf = await buffer(req)
  const secret = req.headers['stripe-signature']

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      secret,
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`)
  }

  const { type } = event

  if (relevantEvents.has(type)) {
    try {
      switch (type) {
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const { id, customer } = event.data.object as Stripe.Subscription

          await saveSubscription(id, customer.toString(), false)
          break
        }
        case 'checkout.session.completed': {
          const { subscription, customer } = event.data
            .object as Stripe.Checkout.Session
          await saveSubscription(
            subscription.toString(),
            customer.toString(),
            true,
          )
          break
        }
        default:
          throw new Error('Unhandled event.')
      }
    } catch (err) {
      return res.json({ error: 'Webhook handler failed.' })
    }
  }

  return res.json({ received: true })
}
