import type { VercelRequest, VercelResponse } from '@vercel/node'
import express from 'express'

// Import the Express app (without starting the server)
import app from '../server/index.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Let Express handle the request
  app(req, res)
}
