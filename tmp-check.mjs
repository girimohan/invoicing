import { PrismaClient } from '@prisma/client'
const p = new PrismaClient({ datasources: { db: { url: 'file:./prisma/dev.db' } } })
const [c, i] = await Promise.all([p.client.count(), p.invoice.count()])
console.log('dev.db -> clients:', c, '  invoices:', i)
const p2 = new PrismaClient({ datasources: { db: { url: 'file:' + process.env.APPDATA + '/Barmo Bookkeeping/dev.db' } } })
const [c2, i2] = await Promise.all([p2.client.count(), p2.invoice.count()])
console.log('app db -> clients:', c2, '  invoices:', i2)
await Promise.all([p.$disconnect(), p2.$disconnect()])
