import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3001),
  APP_ORIGIN: Joi.string().uri().default('http://localhost:8083'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GOOGLE_CALLBACK_URL: Joi.string().uri().required(),
  ALLOWED_GOOGLE_EMAILS: Joi.string().required(),
  SESSION_SECRET: Joi.string().min(32).required(),
  SESSION_TTL_SECONDS: Joi.number().integer().positive().default(604800),
});
