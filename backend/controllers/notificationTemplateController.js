import NotificationTemplate from '../models/NotificationTemplate.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getDefaultTemplates } from '../services/notificationTemplateService.js';

function buildKey({ key, audience, channel, language }) {
  return `${key}|${audience}|${channel}|${language}`;
}

function normalizeTemplateInput(input = {}) {
  return {
    key: String(input.key || '').trim(),
    audience: String(input.audience || '').trim(),
    channel: String(input.channel || 'push').trim() || 'push',
    language: String(input.language || 'default').trim() || 'default',
    title: String(input.title || '').trim(),
    body: String(input.body || '').trim(),
    enabled: input.enabled !== false
  };
}

export const listNotificationTemplates = async (req, res) => {
  try {
    const { audience, channel, language } = req.query || {};
    const normalizedChannel = channel || 'push';

    const query = {};
    if (audience) query.audience = audience;
    if (channel) query.channel = normalizedChannel;
    if (language) query.language = language;

    const templates = await NotificationTemplate.find(query).lean();

    if (!language) {
      const defaults = getDefaultTemplates({
        audience,
        channel: normalizedChannel,
        language: 'default'
      });
      const defaultLabelMap = new Map(
        defaults.map((def) => [buildKey(def), def.label])
      );
      const templateMap = new Map(
        templates.map((t) => {
          const labelKey = buildKey({ ...t, language: 'default' });
          return [buildKey(t), { ...t, label: t.label || defaultLabelMap.get(labelKey) }];
        })
      );
      defaults.forEach((def) => {
        const defKey = buildKey(def);
        if (!templateMap.has(defKey)) {
          templateMap.set(defKey, { ...def, isFallback: true });
        }
      });
      return successResponse(res, 200, 'Notification templates fetched', {
        templates: Array.from(templateMap.values())
      });
    }

    const requestedLanguage = language;
    const defaultTemplates = getDefaultTemplates({
      audience,
      channel: normalizedChannel,
      language: 'default'
    });
    const defaultLabelMap = new Map(
      defaultTemplates.map((def) => [buildKey(def), def.label])
    );

    const requestedMap = new Map();
    defaultTemplates.forEach((def) => {
      requestedMap.set(buildKey({ ...def, language: requestedLanguage }), {
        ...def,
        language: requestedLanguage,
        isFallback: true
      });
    });

    const requestedDocs = templates;
    requestedDocs.forEach((doc) => {
      const key = buildKey(doc);
      const labelKey = buildKey({ ...doc, language: 'default' });
      requestedMap.set(key, { ...doc, label: doc.label || defaultLabelMap.get(labelKey) });
    });

    if (requestedLanguage !== 'default') {
      const fallbackDocs = await NotificationTemplate.find({
        ...(audience ? { audience } : {}),
        channel: normalizedChannel,
        language: 'default'
      }).lean();

      fallbackDocs.forEach((doc) => {
        const fallbackKey = buildKey({
          key: doc.key,
          audience: doc.audience,
          channel: doc.channel,
          language: requestedLanguage
        });
        if (!requestedMap.has(fallbackKey)) {
          requestedMap.set(fallbackKey, {
            ...doc,
            language: requestedLanguage,
            label: doc.label || defaultLabelMap.get(buildKey({ ...doc, language: 'default' })),
            isFallback: true
          });
        }
      });
    }

    return successResponse(res, 200, 'Notification templates fetched', {
      templates: Array.from(requestedMap.values())
    });
  } catch (error) {
    console.error('Error fetching notification templates:', error);
    return errorResponse(res, 500, 'Failed to fetch notification templates');
  }
};

export const upsertNotificationTemplates = async (req, res) => {
  try {
    const templates = req.body?.templates;
    if (!Array.isArray(templates)) {
      return errorResponse(res, 400, 'templates must be an array');
    }

    const adminId = req.admin?._id || req.user?._id || null;
    const ops = [];

    for (const item of templates) {
      const normalized = normalizeTemplateInput(item);
      if (!normalized.key || !normalized.audience || !normalized.title || !normalized.body) {
        return errorResponse(res, 400, 'Each template must include key, audience, title, and body');
      }

      ops.push({
        updateOne: {
          filter: {
            key: normalized.key,
            audience: normalized.audience,
            channel: normalized.channel,
            language: normalized.language
          },
          update: {
            $set: {
              title: normalized.title,
              body: normalized.body,
              enabled: normalized.enabled,
              updatedBy: adminId
            },
            $setOnInsert: {
              createdBy: adminId
            }
          },
          upsert: true
        }
      });
    }

    if (ops.length === 0) {
      return errorResponse(res, 400, 'No templates to update');
    }

    await NotificationTemplate.bulkWrite(ops, { ordered: false });

    return successResponse(res, 200, 'Notification templates updated', {
      updated: ops.length
    });
  } catch (error) {
    console.error('Error updating notification templates:', error);
    return errorResponse(res, 500, 'Failed to update notification templates');
  }
};
