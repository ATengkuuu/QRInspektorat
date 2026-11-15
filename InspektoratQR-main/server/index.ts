import 'dotenv/config'
import cors from 'cors'
import express, { NextFunction, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Pool, PoolClient } from 'pg'
import nodemailer from 'nodemailer'
import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'

const isProduction = process.env.NODE_ENV === 'production'
function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

const databaseUrl = requiredEnvironment('DATABASE_URL')
const app = express()
app.set('trust proxy', process.env.VERCEL === '1' ? 1 : false)
const port = Number(process.env.API_PORT || 3001)
const jwtSecret = requiredEnvironment('JWT_SECRET')
if (isProduction && (jwtSecret.length < 32 || jwtSecret.toLowerCase().includes('change-me') || jwtSecret.toLowerCase().includes('placeholder'))) {
  throw new Error('JWT_SECRET must be a strong non-placeholder value in production')
}
const configuredRateLimitSecret = process.env.RATE_LIMIT_SECRET
if (configuredRateLimitSecret) {
  if (configuredRateLimitSecret.length < 32) {
    throw new Error('RATE_LIMIT_SECRET must be at least 32 characters')
  }
  if (isProduction && (configuredRateLimitSecret.toLowerCase().includes('change-me') || configuredRateLimitSecret.toLowerCase().includes('placeholder'))) {
    throw new Error('RATE_LIMIT_SECRET must be a strong non-placeholder value in production')
  }
}
const rateLimitSecret = configuredRateLimitSecret || jwtSecret

const databaseSsl = process.env.DATABASE_SSL !== 'false'
const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DATABASE_POOL_MAX || 5),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  ssl: databaseSsl ? { rejectUnauthorized: false } : undefined,
})

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('Origin is not allowed by CORS'))
  },
}))
app.use(express.json({ limit: '7mb' }))

const smtpPassword = process.env.SMTP_PASSWORD
const mailTransport = process.env.SMTP_HOST && process.env.SMTP_USER && smtpPassword
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: smtpPassword },
    })
  : null
const resetRequestLimit = 3

type AuthRequest = Request & { userId?: string }
type UserRow = {
  id: string
  username: string
  email: string
  password_hash?: string
  date_of_birth: string | null
  job_field: string
  profile_image: string | null
}
type ProductRow = {
  id: string
  name: string
  location: string
  quantity: number
  image: string | null
  timestamp: number
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

function validQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function validTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

async function consumeResetRateLimit(client: PoolClient, scope: 'email' | 'ip', identifier: string): Promise<boolean> {
  const normalizedIdentifier = scope === 'email' ? identifier.trim().toLowerCase() : identifier
  const identifierHash = createHmac('sha256', rateLimitSecret).update(normalizedIdentifier).digest('hex')
  const result = await client.query<{ request_count: number }>(
    `INSERT INTO password_reset_rate_limits (scope, identifier_hash, window_started_at, request_count)
     VALUES ($1, $2, statement_timestamp(), 1)
     ON CONFLICT (scope, identifier_hash)
     DO UPDATE SET
       window_started_at = CASE
         WHEN password_reset_rate_limits.window_started_at <= statement_timestamp() - INTERVAL '15 minutes'
         THEN statement_timestamp()
         ELSE password_reset_rate_limits.window_started_at
       END,
       request_count = CASE
         WHEN password_reset_rate_limits.window_started_at <= statement_timestamp() - INTERVAL '15 minutes'
         THEN 1
         ELSE password_reset_rate_limits.request_count + 1
       END
     RETURNING request_count`,
    [scope, identifierHash],
  )
  return (result.rows[0]?.request_count || resetRequestLimit + 1) > resetRequestLimit
}

async function invalidateResetToken(tokenId: string): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      'UPDATE password_reset_tokens SET invalidated_at = CURRENT_TIMESTAMP WHERE id = $1 AND otp_verified_at IS NULL AND used_at IS NULL',
      [tokenId],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError) => console.error('Reset token invalidation rollback failed:', rollbackError))
    throw error
  } finally {
    client.release()
  }
}

function userResponse(user: UserRow) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    dateOfBirth: user.date_of_birth,
    field: user.job_field,
    profileImage: user.profile_image,
  }
}

function tokenFor(id: string) {
  return jwt.sign({ userId: id }, jwtSecret, { expiresIn: '7d' })
}

function resetTokenFor(userId: string, tokenId: string) {
  return jwt.sign({ userId, purpose: 'password-reset' }, jwtSecret, { expiresIn: '15m', jwtid: tokenId })
}

function verifiedPayload(token: string): { userId: string; purpose?: string; jti?: string } {
  const payload = jwt.verify(token, jwtSecret)
  if (typeof payload === 'string' || typeof payload.userId !== 'string') {
    throw new Error('Invalid JWT payload')
  }
  return {
    userId: payload.userId,
    purpose: typeof payload.purpose === 'string' ? payload.purpose : undefined,
    jti: typeof payload.jti === 'string' ? payload.jti : undefined,
  }
}

async function logActivity(client: PoolClient, userId: string, action: 'add' | 'download_qr' | 'delete' | 'update', product: { id: string; name: string; location?: string; quantity?: number }) {
  const userResult = await client.query<{ username: string; job_field: string }>(
    'SELECT username, job_field FROM users WHERE id = $1',
    [userId],
  )
  const user = userResult.rows[0]
  await client.query(
    'INSERT INTO activity_logs (id, user_id, action, product_id, product_name, user_name, user_field, product_location, product_quantity, details) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [randomUUID(), userId, action, product.id, product.name, user?.username || 'Unknown', user?.job_field || '', product.location || '', product.quantity ?? null, `${action} product ${product.name}`],
  )
}

function requireAuth(request: AuthRequest, response: Response, next: NextFunction) {
  const token = request.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    response.status(401).json({ message: 'Authentication required' })
    return
  }
  try {
    const payload = verifiedPayload(token)
    if (payload.purpose !== undefined) {
      response.status(401).json({ message: 'Invalid or expired session' })
      return
    }
    request.userId = payload.userId
    next()
  } catch {
    response.status(401).json({ message: 'Invalid or expired session' })
  }
}

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1 AS result')
    response.json({ ok: true, database: 'supabase-postgresql' })
  } catch (error) {
    console.error('Database health check failed:', error)
    response.status(503).json({ message: 'Database connection failed' })
  }
})

app.post('/api/auth/signup', async (request, response) => {
  const { username, email, password, dateOfBirth, field } = request.body
  if (!nonEmptyString(username) || !validEmail(email) || typeof password !== 'string' || password.length < 6 || !validDate(dateOfBirth) || !nonEmptyString(field)) {
    response.status(400).json({ message: 'Semua field wajib diisi dan password minimal 6 karakter' })
    return
  }
  try {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const existing = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])
      if (existing.rowCount) {
        await client.query('ROLLBACK')
        response.status(409).json({ message: 'Email sudah terdaftar' })
        return
      }
      const id = randomUUID()
      const passwordHash = await bcrypt.hash(password, 12)
      await client.query(
        'INSERT INTO users (id, username, email, password_hash, date_of_birth, job_field) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, username, email, passwordHash, dateOfBirth, field],
      )
      await client.query('COMMIT')
      response.status(201).json({ token: tokenFor(id), user: { id, username, email, dateOfBirth, field, profileImage: null } })
    } catch (error) {
      await client.query('ROLLBACK').catch((rollbackError) => console.error('Signup rollback failed:', rollbackError))
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Signup failed:', error)
    if (isUniqueViolation(error)) {
      response.status(409).json({ message: 'Email sudah terdaftar' })
      return
    }
    response.status(500).json({ message: 'Pendaftaran gagal karena database tidak dapat diproses' })
  }
})

app.post('/api/auth/signin', async (request, response) => {
  const { email, password } = request.body
  if (!validEmail(email) || typeof password !== 'string' || password.length === 0) {
    response.status(400).json({ message: 'Email dan password wajib diisi' })
    return
  }
  try {
    const result = await pool.query<UserRow>(
      'SELECT id, username, email, password_hash, to_char(date_of_birth, \'YYYY-MM-DD\') AS date_of_birth, job_field, profile_image FROM users WHERE email = $1',
      [email],
    )
    const user = result.rows[0]
    if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      response.status(401).json({ message: 'Email atau password salah' })
      return
    }
    response.json({ token: tokenFor(user.id), user: userResponse(user) })
  } catch (error) {
    console.error('Signin failed:', error)
    response.status(500).json({ message: 'Login gagal karena database tidak dapat diproses' })
  }
})

app.post('/api/auth/password/forgot', async (request, response) => {
  const email = String(request.body.email || '').trim().toLowerCase()
  if (!email) {
    response.status(400).json({ message: 'Email wajib diisi' })
    return
  }
  const ipKey = request.ip || request.socket.remoteAddress
  if (!ipKey || isIP(ipKey) === 0) {
    response.status(503).json({ message: 'Permintaan reset password belum dapat diproses' })
    return
  }
  let rateLimitClient: PoolClient | undefined
  try {
    rateLimitClient = await pool.connect()
    await rateLimitClient.query('BEGIN')
    const emailRateLimited = await consumeResetRateLimit(rateLimitClient, 'email', email)
    const ipRateLimited = await consumeResetRateLimit(rateLimitClient, 'ip', ipKey)
    if (emailRateLimited || ipRateLimited) {
      await rateLimitClient.query('ROLLBACK')
      response.status(429).json({ message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' })
      return
    }
    await rateLimitClient.query('COMMIT')
  } catch (error) {
    await rateLimitClient?.query('ROLLBACK').catch((rollbackError) => console.error('Rate limit rollback failed:', rollbackError))
    console.error('Password reset rate limit failed:', error)
    response.status(503).json({ message: 'Permintaan reset password belum dapat diproses' })
    return
  } finally {
    rateLimitClient?.release()
  }
  if (!mailTransport) {
    response.status(503).json({ message: 'Email OTP belum dikonfigurasi. Isi SMTP_HOST, SMTP_USER, dan SMTP_PASSWORD di environment.' })
    return
  }
  try {
    const users = await pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])
    if (!users.rows[0]) {
      response.json({ ok: true })
      return
    }
    const code = String(randomInt(100000, 1000000))
    const codeHash = createHash('sha256').update(code).digest('hex')
    const tokenId = randomUUID()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const lockedUser = await client.query<{ id: string }>(
        'SELECT id FROM users WHERE id = $1 FOR UPDATE',
        [users.rows[0].id],
      )
      if (!lockedUser.rows[0]) {
        throw new Error('User disappeared before password reset token creation')
      }
      await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1 OR expires_at < CURRENT_TIMESTAMP', [lockedUser.rows[0].id])
      await client.query(
        "INSERT INTO password_reset_tokens (id, user_id, email, code_hash, expires_at, attempt_count, max_attempts) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '10 minutes', $5, $6)",
        [tokenId, lockedUser.rows[0].id, email, codeHash, 0, 5],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch((rollbackError) => console.error('Password reset token rollback failed:', rollbackError))
      throw error
    } finally {
      client.release()
    }
    try {
      await mailTransport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Kode OTP Reset Password QR Inspektorat',
        text: `Kode OTP Anda adalah ${code}. Kode ini berlaku selama 10 menit.`,
      })
    } catch (error) {
      await invalidateResetToken(tokenId).catch((invalidationError) => {
        console.error('Reset token invalidation failed after email error:', invalidationError)
      })
      throw error
    }
    response.json({ ok: true })
  } catch (error) {
    console.error('Password reset email failed:', error)
    response.status(500).json({ message: 'OTP gagal dikirim. Periksa konfigurasi SMTP.' })
  }
})

app.post('/api/auth/password/verify', async (request, response) => {
  let client: PoolClient | undefined
  try {
    client = await pool.connect()
    const email = String(request.body.email || '').trim().toLowerCase()
    const code = String(request.body.code || '').trim()
    if (!validEmail(email) || !/^\d{6}$/.test(code)) {
      response.status(400).json({ message: 'Email atau OTP tidak valid' })
      return
    }
    const codeHash = createHash('sha256').update(code).digest('hex')
    await client.query('BEGIN')
    const result = await client.query<{
      id: string
      user_id: string
      code_hash: string
      attempt_count: number
      max_attempts: number
      otp_verified_at: string | null
      invalidated_at: string | null
      used_at: string | null
      expires_at: string
    }>(
      `SELECT token.id, token.user_id, token.code_hash, token.attempt_count, token.max_attempts,
              token.otp_verified_at, token.invalidated_at, token.used_at, token.expires_at
       FROM password_reset_tokens token
       JOIN users user_record ON user_record.id = token.user_id
       WHERE token.email = $1
         AND user_record.email = $1
       ORDER BY token.created_at DESC
       LIMIT 1
       FOR UPDATE OF token`,
      [email],
    )
    if (!result.rows[0]) {
      await client.query('ROLLBACK')
      response.status(400).json({ message: 'OTP salah atau sudah kedaluwarsa' })
      return
    }
    const token = result.rows[0]
    if (token.otp_verified_at || token.invalidated_at || token.used_at || new Date(token.expires_at).getTime() <= Date.now() || token.attempt_count >= token.max_attempts) {
      await client.query('ROLLBACK')
      response.status(400).json({ message: 'OTP salah atau sudah kedaluwarsa' })
      return
    }
    const storedHash = Buffer.from(token.code_hash, 'hex')
    const submittedHash = Buffer.from(codeHash, 'hex')
    const hashMatches = storedHash.length === submittedHash.length && timingSafeEqual(storedHash, submittedHash)
    if (!hashMatches) {
      const attempt = await client.query(
        'UPDATE password_reset_tokens SET attempt_count = attempt_count + 1 WHERE id = $1 AND attempt_count < max_attempts',
        [token.id],
      )
      if (attempt.rowCount !== 1) {
        await client.query('ROLLBACK')
        response.status(400).json({ message: 'OTP salah atau sudah kedaluwarsa' })
        return
      }
      await client.query('COMMIT')
      response.status(400).json({ message: 'OTP salah atau sudah kedaluwarsa' })
      return
    }
    const verification = await client.query(
      'UPDATE password_reset_tokens SET otp_verified_at = CURRENT_TIMESTAMP WHERE id = $1 AND otp_verified_at IS NULL',
      [token.id],
    )
    if (verification.rowCount !== 1) {
      await client.query('ROLLBACK')
      response.status(400).json({ message: 'OTP salah atau sudah kedaluwarsa' })
      return
    }
    await client.query('COMMIT')
    response.json({ resetToken: resetTokenFor(token.user_id, token.id) })
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch((rollbackError) => console.error('OTP verification rollback failed:', rollbackError))
    }
    console.error('Password reset verification failed:', error)
    response.status(500).json({ message: 'Verifikasi OTP gagal' })
  } finally {
    client?.release()
  }
})

app.post('/api/auth/password/reset', async (request, response) => {
  const token = request.headers.authorization?.replace('Bearer ', '')
  const password = String(request.body.password || '')
  if (!token || password.length < 6) {
    response.status(400).json({ message: 'Password minimal 6 karakter dan token reset wajib ada' })
    return
  }
  try {
    const payload = verifiedPayload(token)
    if (payload.purpose !== 'password-reset' || !payload.jti || !validUuid(payload.jti)) {
      response.status(401).json({ message: 'Token reset tidak valid' })
      return
    }
    const passwordHash = await bcrypt.hash(password, 12)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const resetToken = await client.query<{ user_id: string }>(
        `SELECT user_id
         FROM password_reset_tokens
         WHERE id = $1
           AND user_id = $2
           AND otp_verified_at IS NOT NULL
           AND invalidated_at IS NULL
           AND used_at IS NULL
           AND expires_at > CURRENT_TIMESTAMP
         FOR UPDATE`,
        [payload.jti, payload.userId],
      )
      if (!resetToken.rows[0]) {
        await client.query('ROLLBACK')
        response.status(401).json({ message: 'Token reset tidak valid atau sudah kedaluwarsa' })
        return
      }
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [passwordHash, resetToken.rows[0].user_id],
      )
      await client.query(
        'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1 AND used_at IS NULL',
        [payload.jti],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch((rollbackError) => console.error('Password reset rollback failed:', rollbackError))
      throw error
    } finally {
      client.release()
    }
    response.json({ ok: true })
  } catch (error) {
    console.error('Password reset failed:', error)
    response.status(401).json({ message: 'Token reset tidak valid atau sudah kedaluwarsa' })
  }
})

app.get('/api/auth/me', requireAuth, async (request: AuthRequest, response) => {
  const result = await pool.query<UserRow>(
    'SELECT id, username, email, to_char(date_of_birth, \'YYYY-MM-DD\') AS date_of_birth, job_field, profile_image FROM users WHERE id = $1',
    [request.userId],
  )
  if (!result.rows[0]) {
    response.status(404).json({ message: 'User tidak ditemukan' })
    return
  }
  response.json(userResponse(result.rows[0]))
})

app.put('/api/auth/me', requireAuth, async (request: AuthRequest, response) => {
  const { username, email, dateOfBirth, field, profileImage } = request.body
  if (!nonEmptyString(username) || !validEmail(email) || (dateOfBirth !== null && dateOfBirth !== undefined && !validDate(dateOfBirth)) || (field !== undefined && typeof field !== 'string') || (profileImage !== null && profileImage !== undefined && typeof profileImage !== 'string')) {
    response.status(400).json({ message: 'Data profil tidak valid' })
    return
  }
  await pool.query(
    'UPDATE users SET username = $1, email = $2, date_of_birth = $3, job_field = $4, profile_image = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6',
    [username, email, dateOfBirth || null, field || '', profileImage || null, request.userId],
  )
  const result = await pool.query<UserRow>(
    'SELECT id, username, email, to_char(date_of_birth, \'YYYY-MM-DD\') AS date_of_birth, job_field, profile_image FROM users WHERE id = $1',
    [request.userId],
  )
  response.json(userResponse(result.rows[0]))
})

app.get('/api/history', requireAuth, async (request, response) => {
  const requestedLimit = Number(request.query.limit || 100)
  const requestedOffset = Number(request.query.offset || 0)
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100 || !Number.isInteger(requestedOffset) || requestedOffset < 0) {
    response.status(400).json({ message: 'Parameter pagination tidak valid' })
    return
  }
  const result = await pool.query(
    `SELECT id, action, product_id, product_name, user_name, user_field, product_location, product_quantity, details, created_at
     FROM activity_logs
     ORDER BY created_at DESC, id DESC
     LIMIT $1 OFFSET $2`,
    [requestedLimit + 1, requestedOffset],
  )
  const hasMore = result.rows.length > requestedLimit
  if (hasMore) result.rows.pop()
  response.setHeader('X-History-Limit', String(requestedLimit))
  response.setHeader('X-History-Offset', String(requestedOffset))
  response.setHeader('X-History-Has-More', String(hasMore))
  response.json(result.rows)
})

app.post('/api/history', requireAuth, async (request: AuthRequest, response) => {
  const { action, productId, productName, location, quantity } = request.body
  if (action !== 'download_qr' || !validUuid(productId) || !nonEmptyString(productName) || (location !== undefined && typeof location !== 'string') || (quantity !== undefined && !validQuantity(quantity))) {
    response.status(400).json({ message: 'Data aktivitas tidak valid' })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const product = await client.query<{ name: string; location: string; quantity: number }>(
      'SELECT name, location, quantity FROM products WHERE id = $1',
      [productId],
    )
    if (!product.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ message: 'Produk tidak ditemukan' })
      return
    }
    await logActivity(client, request.userId!, action, {
      id: productId,
      name: product.rows[0].name,
      location: product.rows[0].location,
      quantity: product.rows[0].quantity,
    })
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError) => console.error('Activity log rollback failed:', rollbackError))
    throw error
  } finally {
    client.release()
  }
  response.status(201).json({ ok: true })
})

app.get('/api/products', requireAuth, async (_request, response) => {
  const result = await pool.query('SELECT * FROM products ORDER BY timestamp DESC')
  response.json(result.rows)
})

app.get('/api/products/:id', requireAuth, async (request, response) => {
  if (!validUuid(request.params.id)) {
    response.status(400).json({ message: 'ID produk tidak valid' })
    return
  }
  const productId = String(request.params.id)
  const result = await pool.query<ProductRow>('SELECT * FROM products WHERE id = $1', [productId])
  if (!result.rows[0]) {
    response.status(404).json({ message: 'Produk tidak ditemukan' })
    return
  }
  response.json(result.rows[0])
})

app.get('/api/products/:id/public', async (request, response) => {
  if (!validUuid(request.params.id)) {
    response.status(400).json({ message: 'ID produk tidak valid' })
    return
  }
  const result = await pool.query(
    `SELECT p.*, added.user_name AS added_by, added.created_at AS added_at
     FROM products p
     LEFT JOIN (
       SELECT DISTINCT ON (product_id) product_id, user_name, created_at
       FROM activity_logs
       WHERE action = 'add'
       ORDER BY product_id, created_at ASC
     ) added ON added.product_id = p.id
     WHERE p.id = $1
     LIMIT 1`,
    [String(request.params.id)],
  )
  if (!result.rows[0]) {
    response.status(404).json({ message: 'Produk tidak ditemukan' })
    return
  }
  response.json(result.rows[0])
})

app.post('/api/products', requireAuth, async (request: AuthRequest, response) => {
  const { id, name, location, quantity, image, timestamp } = request.body
  if (!validUuid(id) || !nonEmptyString(name) || !nonEmptyString(location) || !validQuantity(quantity) || (image !== null && image !== undefined && typeof image !== 'string') || !validTimestamp(timestamp)) {
    response.status(400).json({ message: 'Data produk tidak valid' })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      'INSERT INTO products (id, name, location, quantity, image, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, name, location, quantity, image || null, timestamp],
    )
    await logActivity(client, request.userId!, 'add', { id, name, location, quantity })
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError) => console.error('Product insert rollback failed:', rollbackError))
    throw error
  } finally {
    client.release()
  }
  response.status(201).json({ id, name, location, quantity, image, timestamp })
})

app.put('/api/products/:id', requireAuth, async (request: AuthRequest, response) => {
  const { name, location, quantity, image, timestamp } = request.body
  if (!validUuid(request.params.id) || !nonEmptyString(name) || !nonEmptyString(location) || !validQuantity(quantity) || (image !== null && image !== undefined && typeof image !== 'string') || !validTimestamp(timestamp)) {
    response.status(400).json({ message: 'Data produk tidak valid' })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const updateResult = await client.query(
      'UPDATE products SET name = $1, location = $2, quantity = $3, image = $4, timestamp = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6',
      [name, location, quantity, image || null, timestamp, String(request.params.id)],
    )
    if (updateResult.rowCount !== 1) {
      await client.query('ROLLBACK')
      response.status(404).json({ message: 'Produk tidak ditemukan' })
      return
    }
    await logActivity(client, request.userId!, 'update', { id: String(request.params.id), name, location, quantity })
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError) => console.error('Product update activity rollback failed:', rollbackError))
    throw error
  } finally {
    client.release()
  }
  response.json({ ok: true })
})

app.delete('/api/products/:id', requireAuth, async (request: AuthRequest, response) => {
  if (!validUuid(request.params.id)) {
    response.status(400).json({ message: 'ID produk tidak valid' })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const products = await client.query<{ name: string; location: string; quantity: number }>(
      'SELECT name, location, quantity FROM products WHERE id = $1 FOR UPDATE',
      [String(request.params.id)],
    )
    if (!products.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ message: 'Produk tidak ditemukan' })
      return
    }
    await logActivity(client, request.userId!, 'delete', { id: String(request.params.id), name: products.rows[0].name, location: products.rows[0].location, quantity: products.rows[0].quantity })
    await client.query('DELETE FROM products WHERE id = $1', [String(request.params.id)])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError) => console.error('Product delete rollback failed:', rollbackError))
    throw error
  } finally {
    client.release()
  }
  response.json({ ok: true })
})

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  console.error('Unhandled API error:', error)
  if (response.headersSent) return
  response.status(500).json({ message: 'Terjadi kesalahan pada server' })
})

export { app }

if (!isProduction) {
  app.listen(port, () => console.log(`PostgreSQL API berjalan di http://127.0.0.1:${port}`))
}
