import 'dotenv/config'
import cors from 'cors'
import express, { NextFunction, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import mysql from 'mysql2/promise'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const app = express()
const port = Number(process.env.API_PORT || 3001)
const jwtSecret = process.env.JWT_SECRET || 'qr-inspektorat-local-secret'
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'qr_inspektorat',
  connectionLimit: 10,
})

type AuthRequest = Request & { userId?: string }

app.use(cors())
app.use(express.json({ limit: '7mb' }))

function tokenFor(id: string) {
  return jwt.sign({ userId: id }, jwtSecret, { expiresIn: '7d' })
}

function requireAuth(request: AuthRequest, response: Response, next: NextFunction) {
  const token = request.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    response.status(401).json({ message: 'Authentication required' })
    return
  }

  async function logActivity(userId: string, action: 'add' | 'download_qr' | 'delete' | 'update', product: { id: string; name: string; location?: string; quantity?: number }) {
    const [users] = await pool.query<mysql.RowDataPacket[]>('SELECT username, job_field FROM users WHERE id = ?', [userId])
    const user = users[0]
    await pool.query(
      'INSERT INTO activity_logs (id, user_id, action, product_id, product_name, user_name, user_field, product_location, product_quantity, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), userId, action, product.id, product.name, user?.username || 'Unknown', user?.job_field || '', product.location || '', product.quantity ?? null, `${action} product ${product.name}`],
    )
  }
  try {
    const payload = jwt.verify(token, jwtSecret) as { userId: string }
    request.userId = payload.userId
    next()
  } catch {
    response.status(401).json({ message: 'Invalid or expired session' })
  }
}

app.get('/api/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1')
    response.json({ ok: true, database: process.env.MYSQL_DATABASE || 'qr_inspektorat' })
  } catch (error) {
    console.error('Database health check failed:', error)
    response.status(503).json({ message: 'Database connection failed' })
  }
})

app.post('/api/auth/signup', async (request, response) => {
  const { username, email, password, dateOfBirth, field } = request.body
  if (!username || !email || !password || !dateOfBirth || !field || password.length < 6) {
    response.status(400).json({ message: 'Semua field wajib diisi dan password minimal 6 karakter' })
    return
  }
  try {
    const [existing] = await pool.query<mysql.RowDataPacket[]>('SELECT id FROM users WHERE email = ?', [email])
    if (existing.length) {
      response.status(409).json({ message: 'Email sudah terdaftar' })
      return
    }
    const id = randomUUID()
    const passwordHash = await bcrypt.hash(password, 12)
    await pool.query(
      'INSERT INTO users (id, username, email, password_hash, date_of_birth, job_field) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, email, passwordHash, dateOfBirth, field],
    )
    response.status(201).json({
      token: tokenFor(id),
      user: { id, username, email, dateOfBirth, field, profileImage: null },
    })
  } catch (error) {
    console.error('Signup failed:', error)
    response.status(500).json({ message: 'Pendaftaran gagal karena database tidak dapat diproses' })
  }
})

app.post('/api/auth/signin', async (request, response) => {
  const { email, password } = request.body
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM users WHERE email = ?', [email])
    const user = rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      response.status(401).json({ message: 'Email atau password salah' })
      return
    }
    response.json({ token: tokenFor(user.id), user: { id: user.id, username: user.username, email: user.email, dateOfBirth: user.date_of_birth, field: user.job_field, profileImage: user.profile_image } })
  } catch (error) {
    console.error('Signin failed:', error)
    response.status(500).json({ message: 'Login gagal karena database tidak dapat diproses' })
  }
})

app.get('/api/auth/me', requireAuth, async (request: AuthRequest, response) => {
  const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT id, username, email, date_of_birth, job_field, profile_image FROM users WHERE id = ?', [request.userId])
  if (!rows[0]) {
    response.status(404).json({ message: 'User tidak ditemukan' })
    return
  }
  response.json({ id: rows[0].id, username: rows[0].username, email: rows[0].email, dateOfBirth: rows[0].date_of_birth, field: rows[0].job_field, profileImage: rows[0].profile_image })
})

app.put('/api/auth/me', requireAuth, async (request: AuthRequest, response) => {
  const { username, email, dateOfBirth, field, profileImage } = request.body
  await pool.query('UPDATE users SET username = ?, email = ?, date_of_birth = ?, job_field = ?, profile_image = ? WHERE id = ?', [username, email, dateOfBirth || null, field || '', profileImage || null, request.userId])
  response.json({ ok: true })
})

app.get('/api/history', requireAuth, async (_request, response) => {
  const [rows] = await pool.query('SELECT id, action, product_id, product_name, user_name, user_field, product_location, product_quantity, details, created_at FROM activity_logs ORDER BY created_at DESC')
  response.json(rows)
})

app.post('/api/history', requireAuth, async (request: AuthRequest, response) => {
  const { action, productId, productName, location, quantity } = request.body
  if (action !== 'download_qr' || !productId || !productName) {
    response.status(400).json({ message: 'Data aktivitas tidak valid' })
    return
  }
  await logActivity(request.userId!, action, { id: productId, name: productName, location, quantity })
  response.status(201).json({ ok: true })
})

app.get('/api/products', requireAuth, async (_request, response) => {
  const [rows] = await pool.query('SELECT * FROM products ORDER BY timestamp DESC')
  response.json(rows)
})

app.get('/api/products/:id', requireAuth, async (request, response) => {
  const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM products WHERE id = ?', [request.params.id])
  if (!rows[0]) {
    response.status(404).json({ message: 'Produk tidak ditemukan' })
    return
  }
  response.json(rows[0])
})

app.post('/api/products', requireAuth, async (request: AuthRequest, response) => {
  const { id, name, location, quantity, image, timestamp } = request.body
  await pool.query('INSERT INTO products (id, name, location, quantity, image, timestamp) VALUES (?, ?, ?, ?, ?, ?)', [id, name, location, quantity, image || null, timestamp])
  await logActivity(request.userId!, 'add', { id, name, location, quantity })
  response.status(201).json({ id, name, location, quantity, image, timestamp })
})

app.put('/api/products/:id', requireAuth, async (request: AuthRequest, response) => {
  const { name, location, quantity, image, timestamp } = request.body
  await pool.query('UPDATE products SET name = ?, location = ?, quantity = ?, image = ?, timestamp = ? WHERE id = ?', [name, location, quantity, image || null, timestamp, request.params.id])
  await logActivity(request.userId!, 'update', { id: request.params.id, name, location, quantity })
  response.json({ ok: true })
})

app.delete('/api/products/:id', requireAuth, async (request: AuthRequest, response) => {
  const [products] = await pool.query<mysql.RowDataPacket[]>('SELECT name, location, quantity FROM products WHERE id = ?', [request.params.id])
  await pool.query('DELETE FROM products WHERE id = ?', [request.params.id])
  if (products[0]) await logActivity(request.userId!, 'delete', { id: request.params.id, name: products[0].name, location: products[0].location, quantity: products[0].quantity })
  response.json({ ok: true })
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, '../../dist')))
  app.get('*', (_request, response) => response.sendFile(path.resolve(__dirname, '../../dist/index.html')))
}

app.listen(port, () => console.log(`MySQL API berjalan di http://127.0.0.1:${port}`))
