import { signIn, useSession } from 'next-auth/client'
import { useRouter } from 'next/dist/client/router'
import { useCallback } from 'react'
import { api } from '../../services/axios'
import { getStripeJs } from '../../services/stripe-js'
import styles from './styles.module.scss'

interface SubscribeButtonProps {
  priceId: string
}

export const SubscribeButton: React.FC<SubscribeButtonProps> = () => {
  const [session] = useSession()
  const { push } = useRouter()

  const handleSubscribe = useCallback(async () => {
    if (!session) {
      signIn('github')
    }

    if (session.activeSubscription) {
      push('/posts')
      return
    }

    try {
      const { data } = await api.post('/subscribe')

      const { sessionId } = data

      const stripe = await getStripeJs()

      stripe.redirectToCheckout({ sessionId })
    } catch (err) {
      alert(err.message)
    }
  }, [session, push])
  return (
    <button
      type="button"
      className={styles.subscribeButton}
      onClick={handleSubscribe}
    >
      Subscribe now
    </button>
  )
}
