import NotificationTemplate from '../models/NotificationTemplate.js';

const DEFAULT_NOTIFICATION_TEMPLATES = [
  {
    key: 'user.order_confirmed',
    audience: 'user',
    channel: 'push',
    language: 'default',
    label: 'User: Order Confirmed',
    title: '✅ Order Confirmed',
    body: 'Your order #{orderId} has been confirmed and is being sent to the kitchen.'
  },
  {
    key: 'user.order_preparing',
    audience: 'user',
    channel: 'push',
    language: 'default',
    label: 'User: Order Preparing',
    title: '👨‍🍳 Preparing your food',
    body: 'The restaurant has started preparing your delicious meal for order #{orderId}.'
  },
  {
    key: 'user.order_ready',
    audience: 'user',
    channel: 'push',
    language: 'default',
    label: 'User: Order Ready',
    title: '📦 Order Ready',
    body: 'Your order #{orderId} is ready and waiting for a delivery partner.'
  },
  {
    key: 'user.order_picked_up',
    audience: 'user',
    channel: 'push',
    language: 'default',
    label: 'User: Order Picked Up',
    title: '🛵 Food is on the way!',
    body: 'Your order #{orderId} has been picked up and is heading your way.'
  },
  {
    key: 'user.order_at_delivery',
    audience: 'user',
    channel: 'push',
    language: 'default',
    label: 'User: Order Arrived',
    title: '📍 Arrived!',
    body: 'The delivery partner has reached your location with order #{orderId}.'
  },
  {
    key: 'user.order_delivered',
    audience: 'user',
    channel: 'push',
    language: 'default',
    label: 'User: Order Delivered',
    title: '🎉 Enjoy your meal!',
    body: "Your order #{orderId} has been delivered. Don't forget to rate your experience!"
  },
  {
    key: 'user.order_cancelled',
    audience: 'user',
    channel: 'push',
    language: 'default',
    label: 'User: Order Cancelled',
    title: '❌ Order Cancelled',
    body: 'Your order #{orderId} has been cancelled.'
  },
  {
    key: 'user.order_update',
    audience: 'user',
    channel: 'push',
    language: 'default',
    label: 'User: Order Update (Generic)',
    title: 'Order Update',
    body: 'Your order #{orderId} status is now {status}.'
  },
  {
    key: 'restaurant.order_new',
    audience: 'restaurant',
    channel: 'push',
    language: 'default',
    label: 'Restaurant: New Order',
    title: '🛍️ New Order Received!',
    body: 'You have a new order #{orderId}. Open the app to accept it.'
  },
  {
    key: 'restaurant.order_delivered',
    audience: 'restaurant',
    channel: 'push',
    language: 'default',
    label: 'Restaurant: Order Delivered',
    title: '🎉 Order Delivered',
    body: 'Order #{orderId} has been successfully delivered to the customer.'
  },
  {
    key: 'restaurant.order_cancelled',
    audience: 'restaurant',
    channel: 'push',
    language: 'default',
    label: 'Restaurant: Order Cancelled',
    title: '❌ Order Cancelled',
    body: 'Order #{orderId} has been cancelled by the customer. Reason: {reason}'
  },
  {
    key: 'delivery.order_assigned',
    audience: 'delivery',
    channel: 'push',
    language: 'default',
    label: 'Delivery: Order Assigned',
    title: '🛍️ New Order Assigned!',
    body: 'Order #{orderId} is assigned to you. Head to {restaurantName} for pickup.'
  },
  {
    key: 'delivery.order_available',
    audience: 'delivery',
    channel: 'push',
    language: 'default',
    label: 'Delivery: Order Available',
    title: '🔔 New Delivery Opportunity',
    body: 'Order #{orderId} is available for pickup at {restaurantName}. First come first serve!'
  },
  {
    key: 'delivery.order_ready',
    audience: 'delivery',
    channel: 'push',
    language: 'default',
    label: 'Delivery: Order Ready',
    title: '📦 Order Ready for Pickup',
    body: 'Order #{orderId} is ready at {restaurantName}. Please head there for pickup.'
  }
];

const DEFAULT_TEMPLATE_MAP = new Map(
  DEFAULT_NOTIFICATION_TEMPLATES.map((t) => [
    `${t.key}|${t.audience}|${t.channel}|${t.language}`,
    t
  ])
);

export function getDefaultTemplates({ audience, channel = 'push', language = 'default' } = {}) {
  return DEFAULT_NOTIFICATION_TEMPLATES.filter((t) => {
    if (audience && t.audience !== audience) return false;
    if (channel && t.channel !== channel) return false;
    if (language && t.language !== language) return false;
    return true;
  });
}

export function renderTemplate(text, data = {}) {
  if (!text) return '';
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    const value = data[key];
    return value == null ? '' : String(value);
  });
}

function getDefaultTemplate({ key, audience, channel = 'push', language = 'default' }) {
  return DEFAULT_TEMPLATE_MAP.get(`${key}|${audience}|${channel}|${language}`) || null;
}

export async function resolveNotificationTemplate({
  key,
  audience,
  channel = 'push',
  language = 'default',
  data = {}
}) {
  const query = { key, audience, channel, language };
  let template = await NotificationTemplate.findOne(query).lean();

  if (!template && language !== 'default') {
    template = await NotificationTemplate.findOne({
      key,
      audience,
      channel,
      language: 'default'
    }).lean();
  }

  if (!template) {
    template = getDefaultTemplate({ key, audience, channel, language }) ||
      getDefaultTemplate({ key, audience, channel, language: 'default' });
  }

  if (!template) {
    return null;
  }

  return {
    key,
    audience,
    channel,
    language,
    enabled: template.enabled !== false,
    title: renderTemplate(template.title, data),
    body: renderTemplate(template.body, data)
  };
}
