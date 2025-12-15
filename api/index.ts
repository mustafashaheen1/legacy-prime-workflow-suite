import { handle } from '@hono/node-server/vercel'
import app from '../backend/hono'

export default handle(app)
