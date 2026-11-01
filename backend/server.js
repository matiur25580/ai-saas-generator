import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { body } from 'express-validator';
import Content from './models/Content.js';
import User from './models/User.js';
import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import adminRoutes from './routes/admin.js';
import { optionalAuth } from './utils/auth.js';
import { applyCreditChange } from './utils/credits.js';
import { ApiError, asyncHandler, errorHandler, validateRequest } from './utils/http.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const frontendOrigin = process.env.FRONTEND_URL;
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (isProduction) {
  const missingConfig = [
    ['FRONTEND_URL', frontendOrigin],
    ['MONGO_URI', mongoUri],
    ['JWT_SECRET', process.env.JWT_SECRET],
    ['GEMINI_API_KEY', process.env.GEMINI_API_KEY],
    ['BREVO_API_KEY', process.env.BREVO_API_KEY],
    ['BREVO_SENDER_EMAIL or EMAIL_USER', process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER]
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missingConfig.length) throw new Error(`Missing production configuration: ${missingConfig.join(', ')}`);
}
if (isProduction && frontendOrigin && new URL(frontendOrigin).protocol !== 'https:') {
  throw new Error('FRONTEND_URL must use HTTPS.');
}

// Middleware
app.use(helmet());
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    const localOrigin = !isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
    if (!origin || origin === frontendOrigin || localOrigin) return callback(null, true);
    callback(new ApiError(403, 'This origin is not allowed.', 'CORS_ORIGIN_DENIED'));
  }
}));
app.use(morgan((tokens, req, res) => JSON.stringify({
  level: 'info',
  timestamp: new Date().toISOString(),
  method: tokens.method(req, res),
  path: req.path,
  status: Number(tokens.status(req, res)),
  responseTimeMs: Number(tokens['response-time'](req, res))
})));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/admin', adminRoutes);

if (mongoUri) {
  mongoose.connect(mongoUri)
    .then(() => console.info(JSON.stringify({ level: 'info', event: 'database_connected' })))
    .catch((error) => console.error(JSON.stringify({ level: 'error', event: 'database_connection_failed', message: error.message })));
} else {
  console.warn(JSON.stringify({ level: 'warn', event: 'database_configuration_missing', message: 'Set MONGO_URI or MONGODB_URI.' }));
}

// Test Route
app.get('/', (req, res) => {
  res.json({ success: true, data: { message: 'AI SaaS Generator API' } });
});

app.get('/api/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  if (!databaseConnected) {
    return res.status(503).json({
      success: false,
      error: 'Database is unavailable.',
      code: 'DATABASE_UNAVAILABLE',
      data: { status: 'unhealthy' }
    });
  }
  res.json({ success: true, data: { status: 'healthy' } });
});

const PREFERRED_MODEL = 'gemini-3.8-flash';
const OUTPUT_TOKENS = { Short: 350, Medium: 700, Long: 1200 };
let cachedTextModels;
let workingModel;

function hasTextOutput(model) {
  const modalities = model.outputModalities || model.supportedOutputModalities || model.output?.modalities;
  if (Array.isArray(modalities)) return modalities.includes('TEXT');
  return model.name?.replace('models/', '') === PREFERRED_MODEL;
}

async function loadTextModels() {
  if (cachedTextModels) return cachedTextModels;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Model discovery returned HTTP ${response.status}`);
    const data = await response.json();
    const listedModels = data.models || [];
    const preferredFromList = listedModels.find((model) => model.name?.replace(/^models\//, '') === PREFERRED_MODEL);
    const preferredModalities = preferredFromList?.outputModalities || preferredFromList?.supportedOutputModalities || preferredFromList?.output?.modalities;
    const preferredIsText = !Array.isArray(preferredModalities) || preferredModalities.includes('TEXT');
    const discovered = listedModels
      .filter((model) => (model.supportedGenerationMethods || []).includes('generateContent'))
      .filter((model) => /flash/i.test(model.name || '') && !/(tts|image|audio|embedding|veo)/i.test(model.name || ''))
      .filter(hasTextOutput)
      .map((model) => model.name.replace(/^models\//, ''));
    cachedTextModels = [...new Set([...(preferredIsText ? [PREFERRED_MODEL] : []), ...discovered])];
  } catch (error) {
    console.error(JSON.stringify({ level: 'warn', event: 'gemini_model_discovery_failed', message: error.message }));
    cachedTextModels = [PREFERRED_MODEL];
  }
  return cachedTextModels;
}

app.post('/api/generate', optionalAuth, [
  body('prompt').isString().withMessage('Prompt must be text').bail().trim().isLength({ min: 1, max: 5000 }).withMessage('Prompt must be 1 to 5000 characters'),
  body('persona').optional({ nullable: true }).isString().withMessage('Persona must be text').bail().isLength({ max: 80 }).withMessage('Persona must be at most 80 characters'),
  body('aiTone').optional({ nullable: true }).isString().withMessage('Tone must be text').bail().isLength({ max: 40 }).withMessage('Tone must be at most 40 characters'),
  body('contentType').optional().isString().withMessage('Content type must be text').bail().isIn(['General', 'Blog post', 'Social post', 'Email', 'Product description']).withMessage('Choose a supported content type'),
  body('outputLength').optional().isString().withMessage('Output length must be text').bail().isIn(Object.keys(OUTPUT_TOKENS)).withMessage('Choose a supported output length'),
  body('temperature').optional().isFloat({ min: 0, max: 1 }).toFloat().withMessage('Temperature must be from 0 to 1'),
  validateRequest
], asyncHandler(async (req, res) => {
  const { prompt, persona, aiTone, contentType = 'General', outputLength = 'Medium' } = req.body;
  const temperature = req.body.temperature ?? 0.7;
  if (!process.env.GEMINI_API_KEY) {
    throw new ApiError(503, 'AI generation is temporarily unavailable. Please try again later.', 'AI_NOT_CONFIGURED');
  }
  if (req.userId) {
    const user = await User.findById(req.userId).select('credits');
    if (!user) throw new ApiError(401, 'Your session has expired. Please log in again.', 'AUTH_INVALID');
    if (user.credits < 1) throw new ApiError(400, 'You have no credits remaining.', 'INSUFFICIENT_CREDITS');
  }

  const selectedPersona = persona || 'Expert Copywriter';
  const selectedTone = aiTone || 'Professional';
  const fullPrompt = `You are ${selectedPersona}. Use a ${selectedTone} tone. Create a ${contentType} of ${outputLength.toLowerCase()} length. User request: ${prompt}`;
  const orderedModels = await loadTextModels();
  const modelsToTry = [...new Set([workingModel, ...orderedModels].filter(Boolean))];
  let aiResult;

  for (const modelName of modelsToTry) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { maxOutputTokens: OUTPUT_TOKENS[outputLength], temperature }
        }),
        signal: AbortSignal.timeout(30000)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      aiResult = result.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
      if (!aiResult) throw new Error('Empty text response');
      workingModel = modelName;
      cachedTextModels = [...new Set([modelName, ...orderedModels])];
      break;
    } catch (error) {
      console.error(JSON.stringify({ level: 'warn', event: 'gemini_model_failed', model: modelName, message: error.message }));
    }
  }

  if (!aiResult) {
    throw new ApiError(502, 'AI generation is temporarily unavailable. Please try again shortly.', 'AI_UNAVAILABLE');
  }

  let newContent;
  let credits;
  if (req.userId) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const user = await applyCreditChange({
          userId: req.userId,
          amount: -1,
          reason: 'AI content generation',
          source: 'generation',
          session
        });
        [newContent] = await Content.create([{
          userId: req.userId,
          prompt,
          persona: selectedPersona,
          tone: selectedTone,
          contentType,
          outputLength,
          response: aiResult
        }], { session });
        credits = user.credits;
      });
    } finally {
      await session.endSession();
    }
  }
  res.json({
    success: true,
    data: { result: aiResult, id: newContent?._id || null, credits },
    result: aiResult,
    id: newContent?._id || null,
    ...(credits === undefined ? {} : { credits })
  });
}));

app.use((req, res, next) => next(new ApiError(404, 'API endpoint not found.', 'NOT_FOUND')));
app.use(errorHandler);

app.listen(PORT, () => {
  console.info(JSON.stringify({ level: 'info', event: 'server_listening', port: PORT }));
});
