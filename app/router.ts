import { createRouter } from 'remix/fetch-router'
import { staticFiles } from 'remix/static-middleware'

import { home } from './controllers/home.tsx'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [staticFiles('./public')],
})

router.map(routes.home, home)
