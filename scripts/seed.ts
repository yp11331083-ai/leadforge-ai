import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // 建立 demo tenant
  const tenant = await db.tenant.upsert({
    where: { slug: 'forge-demo' },
    update: {},
    create: {
      id: 'tenant_demo',
      name: 'Forge Demo Inc.',
      slug: 'forge-demo',
      plan: 'pro',
      status: 'active',
    },
  })
  console.log(`✅ Tenant: ${tenant.name} (${tenant.slug})`)

  // 建立三個不同 role 的 user
  const password = 'demo1234'
  const hash = await bcrypt.hash(password, 10)

  const admin = await db.user.upsert({
    where: { email: 'admin@outrovo.com' },
    update: {},
    create: {
      email: 'admin@outrovo.com',
      name: 'Sarah Chen',
      passwordHash: hash,
      role: 'admin',
      tenantId: tenant.id,
    },
  })
  console.log(`✅ Admin: ${admin.email} (${admin.role})`)

  const manager = await db.user.upsert({
    where: { email: 'manager@outrovo.com' },
    update: {},
    create: {
      email: 'manager@outrovo.com',
      name: 'Marcus Wu',
      passwordHash: hash,
      role: 'sales_manager',
      tenantId: tenant.id,
    },
  })
  console.log(`✅ Manager: ${manager.email} (${manager.role})`)

  const sdr = await db.user.upsert({
    where: { email: 'sdr@outrovo.com' },
    update: {},
    create: {
      email: 'sdr@outrovo.com',
      name: 'Alex Chen',
      passwordHash: hash,
      role: 'sdr',
      tenantId: tenant.id,
    },
  })
  console.log(`✅ SDR: ${sdr.email} (${sdr.role})`)

  // 建立 EmailConfig
  await db.emailConfig.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      smartleadWebhookSecret: 'whsec_demo_smartlead_2024',
      calComWebhookSecret: 'whsec_demo_calcom_2024',
      stripeWebhookSecret: 'whsec_demo_stripe_2024',
    },
  })
  console.log('✅ EmailConfig (with webhook secrets)')

  // 建立 ServiceOffering
  await db.serviceOffering.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      serviceName: 'LeadForge AI',
      description: 'AI 驅動的 B2B 潛在客戶開發引擎。輸入公司網站，AI 自動瀏覽官網、LinkedIn、Crunchbase、徵才頁面、新聞，整理出 8 大維度情報。然後根據研究結果，AI 自動撰寫高回覆率的個人化冷郵件。',
      targetIndustries: 'B2B SaaS, Lead Gen Agency',
      targetCompanySize: '10-200 人',
      targetLocation: '美國、英國、新加坡',
      keyBenefits: '省 80% 業務研究時間、提升 3 倍冷郵件回覆率',
      idealCustomerSignals: '正在招募 SDR/AE、剛融資 Series A-B、使用 Salesforce/HubSpot',
    },
  })
  console.log('✅ ServiceOffering')

  // 建立 demo leads（分配給 sdr）
  const demoLeads = [
    {
      company: 'Notion',
      website: 'https://notion.so',
      contactName: 'Jane Doe',
      title: 'VP of Growth',
      email: 'jane@notion.so',
      industry: 'SaaS / 生產力工具',
      companySize: '500-1000',
      location: 'San Francisco',
      status: 'ready',
      score: 95,
      emailSubject: '關於 Notion AI 自動化的想法',
      emailBody: `Hi Jane,

注意到 Notion 正在擴展企業客戶群，特別是中大型組織的 AI 工作流程整合。我們幫助像 Notion 這樣的 SaaS 公司將 AI 功能無縫整合到客戶現有工作流程中，提升企業版採用率和付費轉化。

週二下午 15 分鐘聊聊？`,
      icebreaker: '注意到 Notion 正在擴展企業客戶群',
      painPoints: JSON.stringify({
        business_summary: 'Notion 是 AI 工作區平台',
        pain_points: ['企業客戶滲透率', 'AI 功能轉化為付費'],
        buying_signals: ['招募企業銷售'],
        outreach_angle: '以 AI 自動化切入',
      }),
      hiringSignals: JSON.stringify(['Enterprise Sales', 'Product Manager']),
      enrichedEmails: JSON.stringify({
        decisionMakers: [
          { name: 'Jane Doe', title: 'VP of Growth', email: 'jane@notion.so', seniority: 'vp', priority: 1, reason: '業務最高主管', confidence: 'medium', email_source: 'ai_predicted' }
        ],
        totalFound: 1,
        hasEmailCount: 1,
      }),
    },
    {
      company: 'Vercel',
      website: 'https://vercel.com',
      contactName: 'Guillermo Rauch',
      title: 'CEO',
      email: 'guillermo@vercel.com',
      industry: 'SaaS / DevOps',
      companySize: '200-500',
      location: 'San Francisco',
      status: 'ready',
      score: 92,
      emailSubject: 'Vercel 的銷售開發自動化',
      emailBody: `Hi Guillermo,

觀察到 Vercel 近期在擴大企業版業務。我們的平台能幫助 Vercel 的業務團隊用更少人力開發更多高品質潛在客戶，特別是針對 Fortune 500 的開發團隊。

下週三 15 分鐘聊聊？`,
      icebreaker: '觀察到 Vercel 近期在擴大企業版業務',
      painPoints: JSON.stringify({
        business_summary: 'Vercel 是前端雲平台',
        pain_points: ['企業版業務擴張', '客戶成功流程自動化'],
        buying_signals: ['招募企業業務'],
        outreach_angle: '以自動化銷售流程切入',
      }),
      hiringSignals: JSON.stringify(['Enterprise AE', 'Customer Success']),
      enrichedEmails: JSON.stringify({
        decisionMakers: [
          { name: 'Guillermo Rauch', title: 'CEO', email: 'guillermo@vercel.com', seniority: 'c_level', priority: 2, reason: 'CEO — 能做預算決定', confidence: 'medium', email_source: 'ai_predicted' }
        ],
        totalFound: 1,
        hasEmailCount: 1,
      }),
    },
    {
      company: 'Linear',
      website: 'https://linear.app',
      contactName: 'Karri Saarinen',
      title: 'CEO & Co-founder',
      email: 'karri@linear.app',
      industry: 'SaaS / 專案管理',
      companySize: '50-200',
      location: 'San Francisco',
      status: 'ready',
      score: 88,
      emailSubject: 'Linear 團隊的開發信策略',
      emailBody: `Hi Karri,

Linear 一直以設計感與速度著稱，但 B2B 業務開發往往跟不上產品迭代。我們幫助像 Linear 這樣的 SaaS 公司用 AI 自動研究每個潛在客戶，省下 80% 業務研究時間。

週四早上 15 分鐘？`,
      icebreaker: 'Linear 一直以設計感與速度著稱',
      painPoints: JSON.stringify({
        business_summary: 'Linear 是開發者專用的專案管理工具',
        pain_points: ['B2B 業務開發跟不上產品迭代'],
        buying_signals: ['招募業務團隊'],
        outreach_angle: '以設計感切入',
      }),
      hiringSignals: JSON.stringify(['Designer', 'Engineer']),
      enrichedEmails: JSON.stringify({
        decisionMakers: [
          { name: 'Karri Saarinen', title: 'CEO & Co-founder', email: 'karri@linear.app', seniority: 'c_level', priority: 2, reason: 'CEO — 能做預算決定', confidence: 'medium', email_source: 'ai_predicted' }
        ],
        totalFound: 1,
        hasEmailCount: 1,
      }),
    },
    {
      company: 'Monite',
      website: 'https://monite.com',
      contactName: 'Ivan Iashin',
      title: 'CEO & Co-founder',
      email: 'ivan@monite.com',
      industry: 'Fintech / B2B',
      companySize: '50-200',
      location: 'Berlin',
      status: 'ready',
      score: 90,
      emailSubject: 'Monite 的潛在客戶開發',
      emailBody: `Hi Ivan,

Monite 的 embedded finance 平台正在快速成長。我們幫助像 Monite 這樣的 fintech 公司用 AI 自動找出最契合的 B2B 客戶，省下大量 SDR 研究時間。

下週二 15 分鐘聊聊？`,
      icebreaker: 'Monite 的 embedded finance 平台正在快速成長',
      painPoints: JSON.stringify({
        business_summary: 'Monite 提供 embedded finance API',
        pain_points: ['B2B 客戶開發成本高'],
        buying_signals: ['招募銷售團隊'],
        outreach_angle: '以 embedded finance 切入',
      }),
      hiringSignals: JSON.stringify(['Sales Director', 'AE']),
      enrichedEmails: JSON.stringify({
        decisionMakers: [
          { name: 'Ivan Iashin', title: 'CEO & Co-founder', email: 'ivan@monite.com', seniority: 'c_level', priority: 2, reason: 'CEO — 能做預算決定', confidence: 'medium', email_source: 'ai_predicted' }
        ],
        totalFound: 1,
        hasEmailCount: 1,
      }),
    },
  ]

  for (const leadData of demoLeads) {
    const lead = await db.lead.create({
      data: {
        ...leadData,
        tenantId: tenant.id,
        assigneeId: sdr.id,
      } as any,
    })
    console.log(`✅ Lead: ${lead.company} (assignee: ${sdr.name})`)
  }

  // 建立 demo EmailEvent（模擬一些已開信、已回覆）
  const notionLead = await db.lead.findFirst({ where: { company: 'Notion', tenantId: tenant.id } })
  if (notionLead) {
    await db.emailEvent.createMany({
      data: [
        { tenantId: tenant.id, leadId: notionLead.id, eventType: 'sent', eventTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        { tenantId: tenant.id, leadId: notionLead.id, eventType: 'delivered', eventTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000) },
        { tenantId: tenant.id, leadId: notionLead.id, eventType: 'opened', eventTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        { tenantId: tenant.id, leadId: notionLead.id, eventType: 'opened', eventTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
        { tenantId: tenant.id, leadId: notionLead.id, eventType: 'replied', eventTime: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      ],
    })
    await db.lead.update({ where: { id: notionLead.id }, data: { status: 'replied' } })
    console.log(`✅ EmailEvents for Notion (sent → opened → replied)`)
  }

  const vercelLead = await db.lead.findFirst({ where: { company: 'Vercel', tenantId: tenant.id } })
  if (vercelLead) {
    await db.emailEvent.createMany({
      data: [
        { tenantId: tenant.id, leadId: vercelLead.id, eventType: 'sent', eventTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        { tenantId: tenant.id, leadId: vercelLead.id, eventType: 'delivered', eventTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 1000) },
        { tenantId: tenant.id, leadId: vercelLead.id, eventType: 'opened', eventTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
      ],
    })
    await db.lead.update({ where: { id: vercelLead.id }, data: { status: 'sent' } })
    console.log(`✅ EmailEvents for Vercel (sent → opened)`)
  }

  const moniteLead = await db.lead.findFirst({ where: { company: 'Monite', tenantId: tenant.id } })
  if (moniteLead) {
    await db.emailEvent.createMany({
      data: [
        { tenantId: tenant.id, leadId: moniteLead.id, eventType: 'sent', eventTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
        { tenantId: tenant.id, leadId: moniteLead.id, eventType: 'delivered', eventTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 2 * 60 * 1000) },
      ],
    })
    await db.lead.update({ where: { id: moniteLead.id }, data: { status: 'sent' } })
    console.log(`✅ EmailEvents for Monite (sent → delivered)`)
  }

  // 建立 demo Meeting（從回覆轉換）
  if (notionLead) {
    await db.meeting.create({
      data: {
        tenantId: tenant.id,
        leadId: notionLead.id,
        source: 'calcom',
        externalId: 'booking_demo_001',
        attendeeEmail: 'jane@notion.so',
        attendeeName: 'Jane Doe',
        eventTypeId: 'intro_call',
        startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
        status: 'scheduled',
      },
    })
    console.log(`✅ Meeting: Jane Doe (Notion) - 3 天後`)
  }

  // 建立 demo UsageEvent
  await db.usageEvent.createMany({
    data: [
      { tenantId: tenant.id, type: 'email_sent', leadId: notionLead?.id },
      { tenantId: tenant.id, type: 'email_sent', leadId: vercelLead?.id },
      { tenantId: tenant.id, type: 'email_sent', leadId: moniteLead?.id },
    ],
  })
  console.log(`✅ UsageEvents (3 emails sent)`)

  console.log('\n🎉 Seed 完成！')
  console.log('\n📋 登入資訊：')
  console.log('  Admin:    admin@outrovo.com / demo1234')
  console.log('  Manager:  manager@outrovo.com / demo1234')
  console.log('  SDR:      sdr@outrovo.com / demo1234')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
