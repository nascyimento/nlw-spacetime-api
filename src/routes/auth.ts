import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import axios from 'axios'
import { prismaClient } from '../lib/prisma'

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request) => {
    const bodySchema = z.object({
      code: z.string(),
    })

    const { code } = bodySchema.parse(request.body)

    const accessTokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      null,
      {
        params: {
          code,
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
        },
        headers: {
          Accept: 'application/json',
        },
      },
    )
    const { access_token } = accessTokenResponse.data

    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    const userSchema = z.object({
      id: z.number(),
      login: z.string(),
      name: z.string(),
      avatar_url: z.string().url(),
    })

    const userInfo = userSchema.parse(userResponse.data)

    let user = await prismaClient.user.findUnique({
      where: {
        githubId: userInfo.id,
      },
    })

    if (!user) {
      user = await prismaClient.user.create({
        data: {
          githubId: userInfo.id,
          avatarUrl: userInfo.avatar_url,
          login: userInfo.login,
          name: userInfo.name,
        },
      })
    }

    const token = app.jwt.sign(
      {
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      {
        sub: user.id,
        expiresIn: '1 day',
      },
    )

    return { token }
  })
}
